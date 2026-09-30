/**
 * Снимки 3D-пробы двора: `pnpm shots:court3d [порт]`.
 *
 * Живой dev-сервер `apps/court3d` должен быть поднят (start_process / pnpm dev).
 * В отличие от обычных снимков, здесь Chromium запускается с программным WebGL
 * (SwiftShader), чтобы three.js отрисовался в песочнице без GPU; если контекст
 * не поднимается — кадр будет пустым, и 3D проверяется живым предпросмотром.
 */

import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { prepareRuntime } from "./browser.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const outDir = join(root, "docs", "game", "ui", "court3d");
mkdirSync(outDir, { recursive: true });

const port = process.argv[2] ?? "5199";
const origin = `http://127.0.0.1:${port}`;

const views: [string, string][] = [
  ["overview", "court3d-overview.jpg"],
  ["near", "court3d-near.jpg"],
  ["gate", "court3d-gate.jpg"],
];

const executablePath = prepareRuntime();
const browser = await puppeteer.launch({
  executablePath,
  args: [
    ...chromium.args,
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--hide-scrollbars",
  ],
  headless: true,
  defaultViewport: { width: 1376, height: 768, deviceScaleFactor: 1 },
  protocolTimeout: 120_000,
  timeout: 90_000,
});

for (const [cam, file] of views) {
  const page = await browser.newPage();
  page.on("pageerror", (error) => console.warn(`  страница: ${String(error)}`));
  page.on("console", (message) => {
    if (message.type() === "error") console.warn(`  консоль: ${message.text()}`);
  });
  await page.goto(`${origin}/?cam=${cam}`, { waitUntil: "load", timeout: 60_000 });
  // даём SwiftShader отрисовать несколько кадров (строкой — без сериализации функций)
  await page.evaluate(
    `new Promise((done) => {
      let frames = 0;
      const tick = () => (frames += 1) >= 30 ? done(null) : requestAnimationFrame(tick);
      requestAnimationFrame(tick);
      setTimeout(() => done(null), 12000);
    })`,
  );
  const webgl = await page.evaluate(
    `(() => { const c = document.createElement("canvas"); return Boolean(c.getContext("webgl2") || c.getContext("webgl")); })()`,
  );
  console.log(`  ${cam}: webgl=${webgl ? "да" : "НЕТ"}`);
  await page.screenshot({ path: join(outDir, file), type: "jpeg", quality: 88 });
  await page.close();
  console.log("сохранён", file);
}

await browser.close();
