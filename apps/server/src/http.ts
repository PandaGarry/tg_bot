/**
 * Один процесс: клиент, API, сокет. Порт из окружения, адрес 0.0.0.0.
 * В разработке клиент отдаёт Vite в режиме middleware, на бою — статика сборки.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
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
  /**
   * Токен оператора: им включают и гасят модули, пока нет админской панели.
   * Пусто — путь закрыт целиком.
   */
  adminToken?: string;
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
      // Конфиг клиента читает загрузчик Node, а не esbuild: иначе Vite пишет
      // рядом временный файл конфига, tsx watch видит его и перезапускает мир по кругу.
      configLoader: "runner",
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
          // Двое часов названы явно: календарь — настоящий (окна событий и сроки
          // оператора), ход мира — игровой (он стоит, пока процесс не работает).
          calendarNow: service?.calendarNow() ?? Date.now(),
          worldNow: service?.now() ?? Date.now(),
          // Состояния модулей: видно, что выключено и что включено обратно.
          modules: service?.statesOfModules() ?? [],
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
    if (url.pathname === "/api/modules") {
      await handleModules(req, res, url);
      return;
    }
    if (url.pathname === "/api/schedule") {
      await handleSchedule(req, res, url);
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

  /**
   * Переключатель модулей для оператора. До админской панели это единственный
   * внешний путь: GET отдаёт список, POST меняет состояние. Без токена — отказ,
   * пустой токен в настройках закрывает путь целиком.
   */
  async function handleModules(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    const token = options.adminToken ?? "";
    if (token.length === 0) {
      res.writeHead(403, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "путь выключен: ADMIN_TOKEN не задан" }));
      return;
    }
    const given = req.headers["x-admin-token"];
    if (typeof given !== "string" || given.length !== token.length || !timingSafeEqual(Buffer.from(given), Buffer.from(token))) {
      options.journal.write({ channel: "security", worldId: options.worldId, event: "admin.denied", detail: { path: url.pathname } });
      res.writeHead(403, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "нет доступа" }));
      return;
    }
    const service = options.service();
    if (!service) {
      res.writeHead(503, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "мир ещё не открыт" }));
      return;
    }
    if (req.method === "GET") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          ok: true,
          modules: service.statesOfModules(),
          units: service.statesOfUnits(),
          // Карантин ядра: видно, что чинится и когда вернётся.
          quarantines: service.quarantinesInForce(),
        }),
      );
      return;
    }
    if (req.method !== "POST") {
      res.writeHead(405, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "нужен GET или POST" }));
      return;
    }
    const body = await readJson(req);
    const id = typeof body?.id === "string" ? body.id : "";
    // auto — «вернуть календарю»: снять примерку без следа (см. 10-modules-kinds.md).
    const state =
      body?.state === "enabled" || body?.state === "disabled" || body?.state === "auto" ? body.state : "";
    if (id.length === 0 || state === "") {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "нужны id и state: enabled, disabled или auto" }));
      return;
    }
    if (!service.statesOfModules().some((module) => module.id === id)) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "такого модуля нет в сборке мира" }));
      return;
    }
    // Срок и причина — необязательны: карантин вместо глухого запрета.
    const untilRaw = body?.until;
    const until =
      typeof untilRaw === "number" && Number.isFinite(untilRaw) && untilRaw > 0
        ? untilRaw
        : typeof untilRaw === "string" && Number.isFinite(Date.parse(untilRaw))
          ? Date.parse(untilRaw)
          : 0;
    const reason = typeof body?.reason === "string" ? body.reason.slice(0, 200) : undefined;
    const unitId = typeof body?.unitId === "string" ? body.unitId : "";
    if (unitId.length > 0) {
      const key = `${id}.${unitId}`;
      if (!service.statesOfUnits(id).some((unit) => unit.key === key)) {
        res.writeHead(404, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "такой единицы нет в модуле" }));
        return;
      }
      await service.setUnitState(id, unitId, state, { until, reason });
      options.journal.write({
        channel: "access",
        worldId: options.worldId,
        moduleId: id,
        event: `admin.unit.${state}`,
        detail: { key, until, ...(reason ? { reason } : {}), path: url.pathname },
      });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, modules: service.statesOfModules(), units: service.statesOfUnits() }));
      return;
    }
    await service.setModuleState(id, state, { until, reason });
    options.journal.write({
      channel: "access",
      worldId: options.worldId,
      moduleId: id,
      event: `admin.module.${state}`,
      detail: { until, ...(reason ? { reason } : {}), path: url.pathname },
    });
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, modules: service.statesOfModules(), units: service.statesOfUnits() }));
  }

  /**
   * Расписание мира: идущие и будущие окна. Ручка открыта, потому что в ней нет
   * ничего тайного: те же даты игрок видит в панели событий.
   */
  async function handleSchedule(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    const service = options.service();
    if (!service) {
      res.writeHead(503, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "мир ещё не открыт" }));
      return;
    }
    const days = Math.min(Math.max(Number(url.searchParams.get("days") ?? 30) || 30, 1), 120);
    // Окна расписания живут по календарю: сроки считаются в том же времени.
    const now = service.calendarNow();
    const horizon = now + days * 86_400_000;
    const windows = service
      .schedulePlan()
      .filter((window) => window.stop > now && window.start < horizon)
      .map((window) => ({
        key: window.key,
        moduleId: window.moduleId,
        unitId: window.unitId,
        lane: window.lane,
        source: window.source,
        start: window.start,
        stop: window.stop,
      }));
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        from: now,
        to: horizon,
        days,
        windows,
        units: service.statesOfUnits(),
      }),
    );
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

/** Тело запроса: у админских точек только JSON и только небольшого размера. */
async function readJson(req: IncomingMessage, limit = 4_096): Promise<Record<string, unknown> | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    if (size > limit) return null;
    chunks.push(buffer);
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
