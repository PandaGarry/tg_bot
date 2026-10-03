/**
 * Замер верхней строки HUD: `corepack pnpm exec tsx tools/shots/measure-hud.ts [порт] [префикс]`.
 *
 * Нужен запущенный dev-сервер (`bash tools/replit-dev.sh`). Проходит регистрацию до двора, печатает
 * прямоугольники карточки лорда, аватара, рамки и ресурсной строки, проверяет, что они не пересекаются
 * и что карточка не выходит за пределы экрана. Снимок — `.tmp/<префикс>-hud.png`.
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
const prefix = process.argv[3] ?? "hud";
const origin = `http://127.0.0.1:${port}`;
const suffix = Date.now().toString(36);

const browser = await puppeteer.launch({
  executablePath: prepareRuntime(),
  args: [...chromium.args, "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--hide-scrollbars"],
  headless: true,
  defaultViewport: { width: 390, height: 844, deviceScaleFactor: 1, hasTouch: true, isMobile: true },
  protocolTimeout: 180_000,
  timeout: 120_000,
});
const page = await browser.newPage();
page.on("pageerror", (error) => console.warn(`  страница: ${String(error)}`));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function clickButton(text: string) {
  await page.waitForFunction(
    `[...document.querySelectorAll("button")].some((b) => (b.textContent?.trim() === ${JSON.stringify(text)} || b.getAttribute('aria-label') === ${JSON.stringify(text)}))`,
    { timeout: 30_000 },
  );
  await page.evaluate(
    `(() => { const b = [...document.querySelectorAll("button")].find((x) => (x.textContent?.trim() === ${JSON.stringify(text)} || x.getAttribute('aria-label') === ${JSON.stringify(text)})); b && b.click(); })()`,
  );
}

await page.goto(origin, { waitUntil: "load", timeout: 90_000 });
await clickButton("Дальше");
await clickButton("Пропустить");
await clickButton("Регистрация аккаунта");
await page.waitForFunction(`document.body.textContent.includes("Логин")`, { timeout: 30_000 });
const inputs = await page.$$("input:not([type=checkbox])");
await inputs[0]!.type(`measure-${suffix}`);
await inputs[1]!.type(`measure-${suffix}@example.com`);
await inputs[2]!.type("measure-password-123");
await inputs[3]!.type("measure-password-123");
await (await page.$$("input[type=checkbox]"))[0]!.click();
await clickButton("Зарегистрироваться");
await page.waitForFunction(`document.body.textContent.includes("Имя")`, { timeout: 30_000 });
await (await page.$("input"))!.type(`Замер ${suffix.slice(-4)}`);
await clickButton("Занять двор");
await page.waitForSelector(".hud-lord", { timeout: 60_000 });
await sleep(5_000);

const report = await page.evaluate(`(() => {
  const r = (sel) => { const el = document.querySelector(sel); if (!el) return null;
    const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
  const lord = r(".hud-lord"); const res = r(".hud-res");
  const portrait = r(".hud-lord .portrait"); const face = r(".hud-lord .portrait .face");
  const frame = r(".hud-lord .portrait .frame"); const tag = r(".hud-lord .portrait .lvl-tag");
  const overlap = lord && res ? !(lord.x + lord.w <= res.x + 1 || res.x + res.w <= lord.x + 1) : null;
  return { lord, res, portrait, face, frame, tag, overlap, screen: window.innerWidth };
})()`);
console.log("Замер верхней строки HUD:");
console.log(JSON.stringify(report, null, 2));
await page.screenshot({ path: join(outDir, `${prefix}-hud.png`) });
console.log(`снимок: .tmp/${prefix}-hud.png`);
await browser.close();
