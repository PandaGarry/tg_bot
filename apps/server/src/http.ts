/**
 * Один процесс: клиент, API, сокет. Порт из окружения, адрес 0.0.0.0.
 * В разработке клиент отдаёт Vite в режиме middleware, на бою — статика сборки.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { Journal, WorldService } from "@tdl/host";

export interface HttpOptions {
  journal: Journal;
  /** Готовый слушатель: тесты поднимают свой и слушают нулевой порт. */
  server?: Server;
  worldId: string;
  service: () => WorldService | null;
  /** Смотр сети: соединения и медленные клиенты. Тесты могут не давать его. */
  net?: () => { connections: number; slowClients: number } | null;
  /** Папка сборки клиента: на бою отдаётся статикой. */
  clientDist?: string;
  /** В разработке клиент отдаёт Vite. */
  devClientRoot?: string;
}

export interface HttpHandle {
  server: Server;
  close(): Promise<void>;
}

export async function createHttpServer(options: HttpOptions): Promise<HttpHandle> {
  const middlewares: ((req: IncomingMessage, res: ServerResponse) => Promise<boolean>)[] = [];
  const hmrEnabled = process.env.TDL_HMR === "1";

  if (options.devClientRoot) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      root: options.devClientRoot,
      appType: "spa",
      // Кеш уходит из репозитория: иначе tsx watch и Vite гоняют друг друга
      // перезапусками на временных файлах.
      cacheDir: join(tmpdir(), "tdl-vite-cache"),
      server: {
        middlewareMode: true,
        // Песочница и VDS проксируют хост: свой список хостов не нужен.
        allowedHosts: true,
        // Через прокси живое обновление не доходит: включается TDL_HMR=1.
        // Без него отдельный порт обновлений не открывается вовсе.
        hmr: hmrEnabled,
        ws: hmrEnabled ? {} : false,
      },
    });
    middlewares.push(async (req, res) => {
      await new Promise<void>((done) => {
        vite.middlewares(req, res, () => {
          done();
        });
      });
      return res.writableEnded;
    });
    options.journal.write({ channel: "app", event: "http.vite", detail: { root: options.devClientRoot } });
  } else if (options.clientDist && existsSync(options.clientDist)) {
    const distRoot = resolve(options.clientDist);
    const indexHtml = join(distRoot, "index.html");
    const files = await import("node:fs/promises");
    middlewares.push(async (req, res) => {
      if (req.method !== "GET" && req.method !== "HEAD") return false;
      const url = new URL(req.url ?? "/", "http://localhost");
      // Служебные пути статике не отдаются: у них свой ответ и свой вид.
      if (url.pathname.startsWith("/api/")) return false;
      const wanted = resolve(distRoot, `.${decodeURIComponent(url.pathname)}`);
      // Выход из папки сборки закрыт: путь всегда внутри собранного клиента.
      const inside = wanted === distRoot || wanted.startsWith(`${distRoot}${sep}`);
      let target = indexHtml;
      if (inside && existsSync(wanted)) {
        const info = await files.stat(wanted);
        // Папка и всё нечитаемое отдают оболочку: клиент сам решает, что рисовать.
        if (info.isFile()) target = wanted;
      }
      if (!existsSync(target)) return false;
      const body = await files.readFile(target);
      res.writeHead(200, {
        "content-type": contentType(target),
        "cache-control": target === indexHtml ? "no-cache" : "public, max-age=31536000, immutable",
      });
      res.end(req.method === "HEAD" ? undefined : body);
      return true;
    });
  }

  const server = options.server ?? createServer();
  server.on("request", (req, res) => {
    void handle(req, res).catch((error: unknown) => {
      // Сбой обработчика не оставляет игрока ждать: ответ уходит всегда.
      options.journal.write({
        channel: "app",
        worldId: options.worldId,
        event: "http.failed",
        detail: { path: req.url ?? "/", error: String(error) },
      });
      if (res.headersSent) {
        res.end();
        return;
      }
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "порт не смог ответить" }));
    });
  });

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname === "/api/health") {
      const service = options.service();
      const stats = service?.stats() ?? null;
      // Смотр мира: сколько соединений, сколько медленных клиентов отключено.
      const net = options.net?.() ?? null;
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          ok: true,
          world: options.worldId,
          ready: service !== null,
          net,
          stats,
        }),
      );
      return;
    }
    if (url.pathname === "/api/kernel/rejections") {
      const service = options.service();
      const rows = service ? await service.rejections(100) : [];
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ rows }));
      return;
    }
    for (const middleware of middlewares) {
      if (await middleware(req, res)) return;
    }
    // Служебные пути отвечают как API, остальное — коротким текстом.
    if (url.pathname.startsWith("/api/")) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "нет такого пути" }));
      return;
    }
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("нет такого пути");
  }

  return {
    server,
    close: () =>
      new Promise<void>((done) => {
        server.close(() => done());
      }),
  };
}

function contentType(path: string): string {
  if (path.endsWith(".html")) return "text/html; charset=utf-8";
  if (path.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (path.endsWith(".css")) return "text/css; charset=utf-8";
  if (path.endsWith(".json")) return "application/json";
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".woff2")) return "font/woff2";
  return "application/octet-stream";
}

export function clientPaths(): { dist: string; devRoot: string } {
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(here, "..", "..", "..");
  return {
    dist: join(repoRoot, "apps", "client", "dist"),
    devRoot: join(repoRoot, "apps", "client"),
  };
}
