/**
 * Кадр окна входа: `npx tsx shots/boot-shot.ts [port]` → docs/game/ui/court3d/game-boot-portrait.jpg.
 */

import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser, openPage } from "./browser.js";

const port = process.argv[2] ?? "3000";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const out = join(root, "docs", "game", "ui", "court3d", "game-boot-portrait.jpg");
mkdirSync(dirname(out), { recursive: true });

const browser = await launchBrowser();
const page = await openPage(browser, `http://127.0.0.1:${port}`);
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle2", timeout: 60000 });
await new Promise((r) => setTimeout(r, 1200));
// листаем вступительные слайды до окна входа (8 кадров + «Начать»)
for (let i = 0; i < 9; i++) {
  const btn = await page.$('[data-testid="slide-text"] ~ * button, footer button');
  if (!btn) break;
  await btn.click().catch(() => undefined);
  await new Promise((r) => setTimeout(r, 250));
}
await new Promise((r) => setTimeout(r, 800));
await page.screenshot({ path: out, type: "jpeg", quality: 88 });
await browser.close();
console.log(`сохранён ${out.split("/").pop()}`);
