/**
 * Живая проходка до двора: `npx tsx tools/shots/walkthrough.ts [порт]`.
 *
 * Поднимается Chromium с программным WebGL, открывается игра, пропускается
 * вступление, заводится аккаунт и лорд, снимается двор с 3D-сценой.
 * Снимки — в docs/game/ui/court3d/: game-register.jpg, game-create.jpg, game-court-day.jpg.
 */

import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import chromium from "@sparticuz/chromium";
import puppeteer, { type Page } from "puppeteer-core";
import { prepareRuntime } from "./browser.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const outDir = join(root, "docs", "game", "ui", "court3d");
mkdirSync(outDir, { recursive: true });

const port = process.argv[2] ?? "3000";
const origin = `http://127.0.0.1:${port}`;
const suffix = Date.now().toString(36);

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

const page: Page = await browser.newPage();
page.on("pageerror", (error) => console.warn(`  страница: ${String(error)}`));
page.on("console", (message) => console.log(`  консоль[${message.type()}]: ${message.text()}`.slice(0, 300)));

/** Клик по кнопке с точным текстом. */
async function clickButton(text: string): Promise<void> {
  await page.waitForFunction(
    (want: string) => [...document.querySelectorAll("button")].some((b) => b.textContent?.trim() === want),
    { timeout: 20_000 },
    text,
  );
  await page.evaluate((want: string) => {
    const button = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === want);
    button?.click();
  }, text);
}

async function waitText(text: string): Promise<void> {
  await page.waitForFunction(
    (want: string) => document.body?.textContent?.includes(want) ?? false,
    { timeout: 20_000 },
    text,
  );
}

const sleep = (ms: number) => page.evaluate((m: number) => new Promise((r) => setTimeout(r, m)), ms);

console.log("открываем", origin);
await page.evaluateOnNewDocument(`(() => {
  const origSend = WebSocket.prototype.send;
  WebSocket.prototype.send = function (data) {
    console.log("[ws send " + this.readyState + "] " + String(data).slice(0, 140));
    return origSend.call(this, data);
  };
  const origAdd = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, listener, options) {
    if (this instanceof WebSocket && type === "message") {
      const self = this;
      const wrapped = function (event) {
        console.log("[ws recv] " + String(event.data).slice(0, 160));
        listener.call(self, event);
      };
      return origAdd.call(this, type, wrapped, options);
    }
    return origAdd.call(this, type, listener, options);
  };
})()`);
await page.goto(origin, { waitUntil: "load", timeout: 60_000 });

// вступление: со второго кадра появляется «Пропустить»
await clickButton("Дальше");
await clickButton("Пропустить");

// окно входа → регистрация
await clickButton("Регистрация аккаунта");
await waitText("Логин");
const inputs = await page.$$("input:not([type=checkbox])");
if (inputs.length < 4) throw new Error(`ожидали 4 поля регистрации, нашли ${inputs.length}`);
await inputs[0]!.type(`probe-${suffix}`);
await inputs[1]!.type(`probe-${suffix}@example.com`);
await inputs[2]!.type("probe-password-123");
await inputs[3]!.type("probe-password-123");
const checks = await page.$$("input[type=checkbox]");
await checks[0]!.click(); // согласие с правилами
await page.screenshot({ path: join(outDir, "game-register.jpg"), type: "jpeg", quality: 85 });
await clickButton("Зарегистрироваться");

// создание лорда
await waitText("Имя");
const nameInput = await page.$("input");
await nameInput!.type(`Проба ${suffix.slice(-5)}`);
await page.screenshot({ path: join(outDir, "game-create.jpg"), type: "jpeg", quality: 85 });
const btnState = await page.evaluate(() => {
  const button = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Занять двор");
  return { found: Boolean(button), disabled: button?.disabled ?? null };
});
console.log("  кнопка «Занять двор»:", JSON.stringify(btnState));
await clickButton("Занять двор");

// двор: ждём HUD-блок лорда; canvas появляется, только если поднялся WebGL
await page.waitForSelector(".hud-lord", { timeout: 30_000 });
// замер верхней строки: карточка лорда и ресурсы не должны пересекаться
await sleep(1200);
const layout = (await page.evaluate(`(() => {
  const rect = function (sel) {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right) };
  };
  return JSON.stringify({
    top: rect(".hud-top"),
    lord: rect(".hud-lord"),
    res: rect(".hud-res"),
    firstChip: rect(".hud-res .chip"),
    lastChip: rect(".hud-res .chip:last-child"),
  });
})()`)) as string;
console.log("  замер:", layout);
let webgl = true;
try {
  await page.waitForSelector("canvas", { timeout: 15_000 });
} catch {
  webgl = false;
}
console.log(webgl ? "  двор: WebGL поднят, снимаю 3D" : "  двор: WebGL нет, запасной кадр");
await sleep(5000);
await page.screenshot({ path: join(outDir, "game-court-day.jpg"), type: "jpeg", quality: 88 });
console.log("сохранён game-court-day.jpg");

// --- этап C3: панель, подтверждение постановки, перенос, дорога ---
await page.click(".hud-rb");
await page.waitForSelector(".hud-build", { timeout: 10_000 });
await sleep(600);
await page.screenshot({ path: join(outDir, "game-court-build.jpg"), type: "jpeg", quality: 88 });
console.log("сохранён game-court-build.jpg");
await page.evaluate(() => {
  const card = [...document.querySelectorAll(".bcard")].find((b) => b.textContent?.includes("Жилой дом"));
  (card as HTMLElement | undefined)?.click();
});
await page.waitForSelector(".place-bar", { timeout: 10_000 });
await sleep(400);
// клетка слева-выше Ратуши: свободная, вне дороги
await page.mouse.click(450, 430);
await sleep(500);
await page.screenshot({ path: join(outDir, "game-court-confirm.jpg"), type: "jpeg", quality: 88 });
console.log("сохранён game-court-confirm.jpg");
await page.evaluate(() => {
  const button = [...document.querySelectorAll(".place-bar button")].find((b) => b.textContent?.includes("Подтвердить"));
  (button as HTMLElement | undefined)?.click();
});
await sleep(1500);
await page.screenshot({ path: join(outDir, "game-court-placed.jpg"), type: "jpeg", quality: 88 });
console.log("сохранён game-court-placed.jpg");

// перенос долгим нажатием: дом стоит в клетке под (450, 430)
await page.mouse.move(450, 430);
await page.mouse.down();
await sleep(800);
await page.mouse.up();
await sleep(400);
await page.screenshot({ path: join(outDir, "game-court-pickup.jpg"), type: "jpeg", quality: 88 });
console.log("сохранён game-court-pickup.jpg");
await page.mouse.click(450, 300);
await sleep(400);
await page.evaluate(() => {
  const button = [...document.querySelectorAll(".place-bar button")].find((b) => b.textContent?.includes("Подтвердить"));
  (button as HTMLElement | undefined)?.click();
});
await sleep(900);
await page.screenshot({ path: join(outDir, "game-court-moved.jpg"), type: "jpeg", quality: 88 });
console.log("сохранён game-court-moved.jpg");

// гравийная дорога: вкладка «Украшения» → карточка дороги → тап по клетке
await page.click(".hud-rb");
await page.waitForSelector(".hud-build", { timeout: 10_000 });
await sleep(400);
await page.evaluate(() => {
  const tab = [...document.querySelectorAll(".btabs button")].find((b) => b.textContent?.includes("Украшения"));
  (tab as HTMLElement | undefined)?.click();
});
await sleep(300);
await page.evaluate(() => {
  const road = [...document.querySelectorAll(".th-up.road")][0];
  (road as HTMLElement | undefined)?.click();
});
await page.waitForSelector(".place-bar", { timeout: 10_000 });
await sleep(300);
await page.mouse.click(350, 350);
await sleep(700);
await page.mouse.click(350, 460);
await sleep(700);
await page.screenshot({ path: join(outDir, "game-court-road.jpg"), type: "jpeg", quality: 88 });
console.log("сохранён game-court-road.jpg");
await page.evaluate(() => {
  const button = [...document.querySelectorAll(".place-bar button")].find((b) => b.textContent?.includes("Готово"));
  (button as HTMLElement | undefined)?.click();
});
await sleep(300);

// дорога перемещается: долгое нажатие на плиту у ворот, тап по новой клетке, «Подтвердить»
await page.mouse.move(1036, 152);
await page.mouse.down();
await sleep(800);
await page.mouse.up();
await sleep(400);
await page.mouse.click(1036, 89);
await sleep(400);
await page.evaluate(() => {
  const button = [...document.querySelectorAll(".place-bar button")].find((b) => b.textContent?.includes("Подтвердить"));
  (button as HTMLElement | undefined)?.click();
});
await sleep(900);
await page.screenshot({ path: join(outDir, "game-court-road-move.jpg"), type: "jpeg", quality: 88 });
console.log("сохранён game-court-road-move.jpg");

// перенос Ратуши долгим нажатием: нажатие на тело башни, тап по клетке (9,9), «Подтвердить»
await page.mouse.move(688, 390);
await page.mouse.down();
await sleep(800);
await page.mouse.up();
await sleep(400);
await page.screenshot({ path: join(outDir, "game-court-pickup-hall.jpg"), type: "jpeg", quality: 88 });
console.log("сохранён game-court-pickup-hall.jpg");
// клетка (4,9): мир (-2.75, 2.75), проекция (516, 376) при камере dist 24
await page.mouse.click(516, 376);
await sleep(400);
await page.screenshot({ path: join(outDir, "game-court-hall-target.jpg"), type: "jpeg", quality: 88 });
await page.evaluate(() => {
  const button = [...document.querySelectorAll(".place-bar button")].find((b) => b.textContent?.includes("Подтвердить"));
  (button as HTMLElement | undefined)?.click();
});
await sleep(1300);
await page.screenshot({ path: join(outDir, "game-court-hall-moved.jpg"), type: "jpeg", quality: 88 });
console.log("сохранён game-court-hall-moved.jpg");

// замер верхней строки ИМЕННО во дворе и ИМЕННО на телефонной ширине (иначе не ловится)
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await sleep(1200);
const courtLayout = (await page.evaluate(`(() => {
  const rect = function (sel) {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right) };
  };
  return JSON.stringify({
    top: rect(".hud-top"),
    lord: rect(".hud-lord"),
    res: rect(".hud-res"),
    firstChip: rect(".hud-res .chip"),
    lastChip: rect(".hud-res .chip:last-child"),
  });
})()`)) as string;
console.log("  замер-двор:", courtLayout);

// портретный кадр: как на телефоне заказчика
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await sleep(2500);
await page.screenshot({ path: join(outDir, "game-court-portrait.jpg"), type: "jpeg", quality: 88 });
console.log("сохранён game-court-portrait.jpg");

// узкий экран 320: сетка ресурсов обязана уместиться и не задеть профиль
await page.setViewport({ width: 320, height: 690, deviceScaleFactor: 1 });
await sleep(1200);
const narrowLayout = (await page.evaluate(`(() => {
  const rect = function (sel) {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right) };
  };
  return JSON.stringify({
    top: rect(".hud-top"),
    lord: rect(".hud-lord"),
    res: rect(".hud-res"),
    firstChip: rect(".hud-res .chip"),
    lastChip: rect(".hud-res .chip:last-child"),
  });
})()`)) as string;
console.log("  замер-узкий:", narrowLayout);
await page.screenshot({ path: join(outDir, "game-court-narrow.jpg"), type: "jpeg", quality: 88 });
console.log("сохранён game-court-narrow.jpg");

await browser.close();
