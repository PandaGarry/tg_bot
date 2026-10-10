/**
 * Смоук-приёмка этапа 1 (Pixi-ядро): страница отдаёт canvas в #pixi-root,
 * в консоли «[Pixi] Initialized», HUD смонтирован в #hud-root, ошибок страницы нет.
 * `npx tsx tools/shots/pixi-smoke.ts [port]` → docs/game/ui/client/pixi-stage1.jpg
 */

import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser, openPage } from "./browser.js";

const port = process.argv[2] ?? "3000";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const out = join(root, "docs", "game", "ui", "client", "pixi-stage1.jpg");
mkdirSync(dirname(out), { recursive: true });

const origin = `http://127.0.0.1:${port}`;
const browser = await launchBrowser();
const page = await openPage(browser, origin);
await page.setViewport({ width: 1376, height: 768, deviceScaleFactor: 1.5 });

const consoleLines: string[] = [];
const pageErrors: string[] = [];
page.on("console", (message) => consoleLines.push(message.text()));
page.on("pageerror", (error) => pageErrors.push(error.message));

await page.goto(`${origin}/`, { waitUntil: "load", timeout: 60_000 });
// Pixi инициализируется асинхронно после загрузки модулей.
await page.waitForSelector("#pixi-root canvas", { timeout: 30_000 });
await new Promise((r) => setTimeout(r, 1500));
await page.screenshot({ path: out, type: "jpeg", quality: 88 });

const hudMounted = await page.evaluate(() => (document.getElementById("hud-root")?.childElementCount ?? 0) > 0);
const canvasSize = await page.evaluate(() => {
  const canvas = document.querySelector("#pixi-root canvas");
  return canvas ? { w: canvas.clientWidth, h: canvas.clientHeight } : null;
});
const initialized = consoleLines.some((line) => line.includes("[Pixi] Initialized"));

await browser.close();

// knownHarnessNoise — артефакт headless-среза: openPage режет WebSocket (ws:// не
// проходит allowlist http://origin). В реальном браузере/Replit это не происходит.
const KNOWN_HARNESS_NOISE = /WebSocket closed without opened/i;
const realErrors = pageErrors.filter((e) => !KNOWN_HARNESS_NOISE.test(e));

console.log(`canvas: ${canvasSize ? `${canvasSize.w}x${canvasSize.h}` : "НЕТ"}`);
console.log(`[Pixi] Initialized в консоли: ${initialized}`);
console.log(`HUD смонтирован в #hud-root: ${hudMounted}`);
console.log(`реальных ошибок страницы: ${realErrors.length ? realErrors.join("; ") : "нет"}`);
if (pageErrors.length && !realErrors.length) {
  console.log(`(игнорируем артефакт headless-среза: ${[...new Set(pageErrors)].join("; ")})`);
}
console.log(`кадр: ${out}`);

if (!initialized || !hudMounted || realErrors.length > 0 || !canvasSize) {
  console.error("ПРИЁМКА ЭТАПА 1 НЕ ПРОЙДЕНА");
  process.exit(1);
}
console.log("ПРИЁМКА ЭТАПА 1 ПРОЙДЕНА");
