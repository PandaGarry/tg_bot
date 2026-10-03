/**
 * Снимки двора глазами телефона: `corepack pnpm exec tsx tools/shots/yard.ts [порт] [префикс]`.
 *
 * Нужен запущенный сервер (`bash tools/replit-dev.sh`, порт 3000). Скрипт проходит вступление,
 * заводит пробный аккаунт и снимает двор: общий план и ближний (колёсиком). Результат в `.tmp/`: far, near, gate, forest.
 * Пишется строкой-IIFE в page.evaluate: функции esbuild ломает (`__name is not defined`).
 */

import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { prepareRuntime } from "./browser.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const outDir = join(root, ".tmp");
mkdirSync(outDir, { recursive: true });
const port = process.argv[2] ?? "3000";
const prefix = process.argv[3] ?? "yard";
const origin = `http://127.0.0.1:${port}`;
const suffix = Date.now().toString(36);

const browser = await puppeteer.launch({
  executablePath: prepareRuntime(),
  args: [...chromium.args, "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--hide-scrollbars"],
  headless: true,
  defaultViewport: { width: 390, height: 844, deviceScaleFactor: 1.86 },
  protocolTimeout: 180_000,
  timeout: 120_000,
});
const page = await browser.newPage();
page.on("pageerror", (error) => console.warn(`  страница: ${String(error)}`));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function clickButton(text: string) {
  await page.waitForFunction(
    `[...document.querySelectorAll("button")].some((b) => b.textContent?.trim() === ${JSON.stringify(text)})`,
    { timeout: 30_000 },
  );
  await page.evaluate(
    `(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.trim() === ${JSON.stringify(text)}); b && b.click(); })()`,
  );
}

await page.goto(origin, { waitUntil: "load", timeout: 90_000 });
await clickButton("Дальше");
await clickButton("Пропустить");
await clickButton("Регистрация аккаунта");
await page.waitForFunction(`document.body.textContent.includes("Логин")`, { timeout: 30_000 });
const inputs = await page.$$("input:not([type=checkbox])");
await inputs[0]!.type(`shot-${suffix}`);
await inputs[1]!.type(`shot-${suffix}@example.com`);
await inputs[2]!.type("shot-password-123");
await inputs[3]!.type("shot-password-123");
await (await page.$$("input[type=checkbox]"))[0]!.click();
await clickButton("Зарегистрироваться");
await page.waitForFunction(`document.body.textContent.includes("Имя")`, { timeout: 30_000 });
await (await page.$("input"))!.type(`Снимок ${suffix.slice(-4)}`);
await clickButton("Занять двор");
await page.waitForSelector(".hud-lord", { timeout: 60_000 });
await page.waitForSelector("canvas", { timeout: 60_000 });
await sleep(6_000);
// случайное событие закрывает часть кадра: «Ясно» убирает плашку
await page.evaluate(`(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.trim() === "Ясно"); b && b.click(); })()`);
await sleep(6_000); // текстуры и первые кадры SwiftShader
await page.screenshot({ path: join(outDir, `${prefix}-far.png`), type: "png" });
console.log("far");
await page.mouse.move(195, 420);
for (let i = 0; i < 2; i++) {
  await page.mouse.wheel({ deltaY: -250 });
  await sleep(600);
}
await sleep(4000);
await page.screenshot({ path: join(outDir, `${prefix}-near.png`), type: "png" });
// ворота: тянем сцену, чтобы подъезд оказался в кадре
await page.mouse.move(330, 650);
await page.mouse.down();
for (let i = 1; i <= 12; i++) {
  await page.mouse.move(330 - i * 30, 650 - i * 24);
  await sleep(40);
}
await page.mouse.up();
await sleep(4000);
await page.screenshot({ path: join(outDir, `${prefix}-gate.png`), type: "png" });
// лес: возвращаем общий план и тянем сцену вниз, чтобы опушка заняла кадр
await page.mouse.move(195, 420);
for (let i = 0; i < 2; i++) {
  await page.mouse.wheel({ deltaY: 250 });
  await sleep(600);
}
await page.mouse.move(195, 300);
await page.mouse.down();
for (let i = 1; i <= 10; i++) {
  await page.mouse.move(195 + i * 6, 300 + i * 38);
  await sleep(40);
}
await page.mouse.up();
await sleep(4000);
await page.screenshot({ path: join(outDir, `${prefix}-forest.png`), type: "png" });
console.log("ok");
await browser.close();
