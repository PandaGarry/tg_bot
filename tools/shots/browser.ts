/**
 * Chromium без системной установки: берётся из npm-пакета `@sparticuz/chromium`
 * (сборка для Amazon Linux 2023 — на Debian ей не хватает только NSS/NSPR, они лежат
 * в том же пакете), распаковывается один раз в кэш и запускается через `puppeteer-core`.
 *
 * Почему прежняя попытка «висла»: библиотеки `al2023.tar.br` пакет распаковывает только
 * внутри AWS Lambda, а без них бинарник не стартует; плюс страницу ждали до `networkidle`
 * при закрытой сети. Здесь библиотеки распаковываются всегда, внешние запросы режутся,
 * а ожидание — `load` с таймаутом.
 */

import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { brotliDecompressSync } from "node:zlib";
import chromium from "@sparticuz/chromium";
import puppeteer, { type Browser, type Page } from "puppeteer-core";

const require = createRequire(import.meta.url);

/** Каталог с бинарником и библиотеками; создаётся при первом запуске. */
export const runtimeDir = join(tmpdir(), "tdl-chromium-153");

/** `bin/` пакета: `exports` не отдаёт package.json, поэтому идём от точки входа (`build/index.js`) вверх. */
function packBin(): string {
  let dir = dirname(require.resolve("@sparticuz/chromium"));
  while (!existsSync(join(dir, "bin", "chromium.br"))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error("в пакете @sparticuz/chromium нет bin/chromium.br");
    dir = parent;
  }
  return join(dir, "bin");
}

function unpackTar(name: string, into: string): void {
  if (existsSync(into)) return;
  mkdirSync(into, { recursive: true });
  const tar = join(runtimeDir, `${name}.tar`);
  writeFileSync(tar, brotliDecompressSync(readFileSync(join(packBin(), `${name}.tar.br`))));
  execFileSync("tar", ["-xf", tar, "-C", into]);
}

/** Шрифты: системные DejaVu (кириллица) + Open Sans из пакета; веб-имена сводятся к ним. */
function writeFontConfig(): string {
  const dir = join(runtimeDir, "fontconfig");
  mkdirSync(join(dir, "cache"), { recursive: true });
  const alias = (family: string, prefer: string[]) =>
    `  <alias><family>${family}</family><prefer>${prefer.map((f) => `<family>${f}</family>`).join("")}</prefer></alias>`;
  const conf = [
    `<?xml version="1.0"?>`,
    `<!DOCTYPE fontconfig SYSTEM "fonts.dtd">`,
    `<fontconfig>`,
    `  <dir>/usr/share/fonts</dir>`,
    `  <dir>${join(runtimeDir, "fonts", "fonts")}</dir>`,
    `  <cachedir>${join(dir, "cache")}</cachedir>`,
    alias("Georgia", ["DejaVu Serif"]),
    alias("Times New Roman", ["DejaVu Serif"]),
    alias("serif", ["DejaVu Serif"]),
    alias("Inter", ["Open Sans", "DejaVu Sans"]),
    alias("Arial", ["Open Sans", "DejaVu Sans"]),
    alias("system-ui", ["Open Sans", "DejaVu Sans"]),
    alias("sans-serif", ["Open Sans", "DejaVu Sans"]),
    alias("Courier New", ["DejaVu Sans Mono"]),
    alias("monospace", ["DejaVu Sans Mono"]),
    `</fontconfig>`,
    "",
  ].join("\n");
  writeFileSync(join(dir, "fonts.conf"), conf);
  return dir;
}

/** Готовит бинарник, библиотеки и шрифты; возвращает путь к Chromium. */
export function prepareRuntime(): string {
  mkdirSync(runtimeDir, { recursive: true });
  const exe = join(runtimeDir, "chromium");
  if (!existsSync(exe)) {
    writeFileSync(exe, brotliDecompressSync(readFileSync(join(packBin(), "chromium.br"))));
    chmodSync(exe, 0o755);
  }
  unpackTar("al2023", join(runtimeDir, "al2023"));
  // Библиотеки ANGLE/SwiftShader Chromium ищет строго рядом с бинарником — иначе SIGTRAP на старте.
  if (!existsSync(join(runtimeDir, "libEGL.so"))) {
    unpackTar("swiftshader", join(runtimeDir, "swiftshader-pack"));
    execFileSync("cp", ["-a", `${join(runtimeDir, "swiftshader-pack")}/.`, runtimeDir]);
  }
  unpackTar("fonts", join(runtimeDir, "fonts"));
  const fontDir = writeFontConfig();

  const libs = [join(runtimeDir, "al2023", "lib")];
  process.env.LD_LIBRARY_PATH = [...libs, process.env.LD_LIBRARY_PATH ?? ""].filter(Boolean).join(":");
  process.env.FONTCONFIG_PATH = fontDir;
  process.env.FONTCONFIG_FILE = join(fontDir, "fonts.conf");
  return exe;
}

export interface LaunchOptions {
  width?: number;
  height?: number;
  scale?: number;
}

export async function launchBrowser(options: LaunchOptions = {}): Promise<Browser> {
  const executablePath = prepareRuntime();
  // Без WebGL/SwiftShader: с ними в песочнице без GPU страница не догружается (то самое «виснет»).
  chromium.setGraphicsMode = false;
  return puppeteer.launch({
    executablePath,
    args: [...chromium.args, "--disable-gpu", "--font-render-hinting=none", "--lang=ru-RU", "--hide-scrollbars"],
    headless: true,
    defaultViewport: {
      width: options.width ?? 1440,
      height: options.height ?? 900,
      deviceScaleFactor: options.scale ?? 1,
    },
    protocolTimeout: 90_000,
    timeout: 60_000,
  });
}

/** Страница, которая ходит только на локальный адрес: сеть песочницы закрыта, ждать нечего. */
export async function openPage(browser: Browser, allowedOrigin: string): Promise<Page> {
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const url = request.url();
    if (url.startsWith(allowedOrigin) || url.startsWith("data:") || url.startsWith("blob:") || url.startsWith("about:")) {
      void request.continue();
    } else {
      void request.abort();
    }
  });
  page.on("pageerror", (error: unknown) => console.warn(`  страница: ${error instanceof Error ? error.message : String(error)}`));
  return page;
}
