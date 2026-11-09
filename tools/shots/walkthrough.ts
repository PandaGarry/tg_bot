/**
 * Живая проходка до двора: `npx tsx tools/shots/walkthrough.ts [порт]`.
 *
 * Поднимается Chromium с программным WebGL, открывается игра, пропускается
 * вступление, заводится аккаунт и лорд, снимается двор с 3D-сценой.
 * Снимки — в docs/game/ui/client/: game-register.jpg, game-create.jpg, game-court-day.jpg.
 */

import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import chromium from "@sparticuz/chromium";
import puppeteer, { type Page } from "puppeteer-core";
import { prepareRuntime } from "./browser.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const outDir = join(root, "docs", "game", "ui", "client");
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

// Двор: проверяем актуальный HUD, а не селекторы предыдущего поколения.
await page.waitForSelector(".ch-profile", { timeout: 30_000 });
await page.waitForSelector(".ch-res", { timeout: 10_000 });
await sleep(1200);

async function measureTop(label: string): Promise<string> {
  const result = await page.evaluate(() => {
    const profileNode = document.querySelector(".ch-profile");
    const profileBox = profileNode?.getBoundingClientRect();
    const profile = profileBox ? {
      x: Math.round(profileBox.x),
      y: Math.round(profileBox.y),
      width: Math.round(profileBox.width),
      height: Math.round(profileBox.height),
      right: Math.round(profileBox.right),
      bottom: Math.round(profileBox.bottom),
    } : null;
    const resourcesNode = document.querySelector(".ch-res");
    const resourcesBox = resourcesNode?.getBoundingClientRect();
    const resources = resourcesBox ? {
      x: Math.round(resourcesBox.x),
      y: Math.round(resourcesBox.y),
      width: Math.round(resourcesBox.width),
      height: Math.round(resourcesBox.height),
      right: Math.round(resourcesBox.right),
      bottom: Math.round(resourcesBox.bottom),
    } : null;
    const firstNode = document.querySelector(".ch-res__item:first-child");
    const firstBox = firstNode?.getBoundingClientRect();
    const firstResource = firstBox ? {
      x: Math.round(firstBox.x), y: Math.round(firstBox.y),
      width: Math.round(firstBox.width), height: Math.round(firstBox.height),
      right: Math.round(firstBox.right), bottom: Math.round(firstBox.bottom),
    } : null;
    const lastNode = document.querySelector(".ch-res__item:last-child");
    const lastBox = lastNode?.getBoundingClientRect();
    const lastResource = lastBox ? {
      x: Math.round(lastBox.x), y: Math.round(lastBox.y),
      width: Math.round(lastBox.width), height: Math.round(lastBox.height),
      right: Math.round(lastBox.right), bottom: Math.round(lastBox.bottom),
    } : null;
    const overlap = profile && resources
      ? profile.x < resources.right && profile.right > resources.x &&
        profile.y < resources.bottom && profile.bottom > resources.y
      : null;
    const top = document.querySelector(".ch-top");
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      topBarWidth: top?.clientWidth ?? null,
      topBarScrollWidth: top?.scrollWidth ?? null,
      horizontalOverflow: top ? top.scrollWidth > top.clientWidth + 1 : true,
      profile,
      resources,
      firstResource,
      lastResource,
      profileResourceOverlap: overlap,
    };
  });
  const json = JSON.stringify(result);
  console.log(`  ${label}: ${json}`);
  return json;
}

let webgl = true;
try {
  await page.waitForSelector("canvas", { timeout: 15_000 });
} catch {
  webgl = false;
}
console.log(webgl ? "  двор: canvas доступен, снимаю сцену" : "  двор: canvas не найден, снимаю fallback");
await sleep(2500);
await page.screenshot({ path: join(outDir, "game-court-day.jpg"), type: "jpeg", quality: 88 });
console.log("сохранён game-court-day.jpg");

// Панель строительства открывается через актуальное быстрое действие ConceptHud.
await page.click('.ch-action[aria-label="Строительство"]');
await page.waitForSelector(".concept-build-panel", { timeout: 10_000 });
await sleep(500);
await page.screenshot({ path: join(outDir, "game-court-build.jpg"), type: "jpeg", quality: 88 });
console.log("сохранён game-court-build.jpg");
async function assertCurrentBuildTab(label: string): Promise<void> {
  const missing = await page.$$eval(".concept-building-card", (cards) =>
    cards.filter((card) => {
      const art = card.querySelector(".concept-building-art");
      const image = art?.querySelector("img") as HTMLImageElement | null;
      return !art || (!art.querySelector("svg") && !(image?.complete && image.naturalWidth > 0));
    }).map((card) => card.getAttribute("data-building-id") ?? "unknown"),
  );
  if (missing.length > 0) {
    throw new Error(`Building cards without artwork on ${label}: ${missing.join(", ")}`);
  }
  console.log(`  ${label}: все карточки имеют загруженный PNG или SVG fallback`);
}

await assertCurrentBuildTab("economy");
await page.click(".concept-build-tabs button:nth-child(2)");
await sleep(300);
await assertCurrentBuildTab("military");
await page.screenshot({ path: join(outDir, "game-court-military.jpg"), type: "jpeg", quality: 88 });
console.log("сохранён game-court-military.jpg");
await page.click(".concept-build-tabs button:nth-child(3)");
await sleep(300);
await assertCurrentBuildTab("decor");
// Проверяем вкладку декора и карточку мощения; постановку не подтверждаем,
// чтобы скриншотный сценарий не изменял состояние тестового королевства.
await page.evaluate(() => {
  const tab = [...document.querySelectorAll(".concept-build-tabs button")]
    .find((button) => /украшения|decor/i.test(button.textContent ?? ""));
  (tab as HTMLButtonElement | undefined)?.click();
});
await sleep(350);
await page.screenshot({ path: join(outDir, "game-court-decor.jpg"), type: "jpeg", quality: 88 });
console.log("сохранён game-court-decor.jpg");

// Закрываем панель и наполняем одноразовый CI-мир реальными серверными зданиями.
// Это не мок состояния: каждое здание проходит обычный court.place → patch → Pixi redraw.
await page.click(".concept-build-panel .concept-panel-close");
await sleep(300);

async function clickCourtCell(x: number, z: number): Promise<void> {
  const point = await page.evaluate(({ x: cellX, z: cellZ }) => {
    const canvas = document.querySelector("#pixi-root canvas") as HTMLCanvasElement | null;
    if (!canvas) throw new Error("Pixi canvas missing before building placement");
    const rect = canvas.getBoundingClientRect();
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const size = 10; // стартовая серверная сетка двора, проверяется после court.enter
    const viewportWidth = Math.min(width, 820);
    const centerX = width / 2;
    const centerY = height * (height < 440 ? 0.52 : 0.55);
    const availableWidth = Math.max(140, viewportWidth - 36);
    const availableHeight = Math.max(130, height - 238);
    const fitScale = Math.min(availableWidth / (size * 71.4), availableHeight / (size * 41.4)) * 0.96;
    const localX = centerX + ((cellX - cellZ) * 35.7) * fitScale;
    const localY = centerY + (((cellX + cellZ + 1) * 20.7 - (size * 41.4) / 2)) * fitScale;
    return {
      x: rect.left + (localX / width) * rect.width,
      y: rect.top + (localY / height) * rect.height,
    };
  }, { x, z });
  await page.mouse.click(point.x, point.y);
  await page.waitForFunction(
    () => [...document.querySelectorAll(".concept-placement button")]
      .some((button) => button.textContent?.trim() === "Поставить"),
    { timeout: 10_000 },
  );
  await clickButton("Поставить");
  await sleep(650);
}

async function placeBuilding(id: "pen" | "sawmill", x: number, z: number): Promise<void> {
  await page.click('.ch-action[aria-label="Строительство"]');
  await page.waitForSelector(".concept-build-panel", { timeout: 10_000 });
  await page.click(`[data-building-id="${id}"]`);
  await page.waitForSelector(".concept-placement", { timeout: 5_000 });
  await clickCourtCell(x, z);
  console.log(`  размещено через серверную команду: ${id} @ ${x},${z}`);
}

// Стартовая Цитадель занимает центральные клетки; два свободных края подходят
// под реальные пятна 2×2 загона и лесопилки и не пересекают стартовую дорогу.
await placeBuilding("pen", 1, 1);
await placeBuilding("sawmill", 8, 1);
await page.waitForFunction(() => !document.querySelector(".concept-placement"), { timeout: 5_000 });
await sleep(1800);
await page.screenshot({ path: join(outDir, "game-court-buildings.jpg"), type: "jpeg", quality: 90 });
console.log("сохранён game-court-buildings.jpg — Цитадель + Загон + Лесопилка");
await measureTop("desktop HUD");

// Портретный кадр на целевом мобильном размере.
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await sleep(1000);
const courtLayout = await measureTop("mobile 390 HUD");
await page.screenshot({ path: join(outDir, "game-court-portrait.jpg"), type: "jpeg", quality: 88 });
console.log("сохранён game-court-portrait.jpg");

// Узкий экран: сохраняем метрики для визуального контроля переполнения.
await page.setViewport({ width: 320, height: 690, deviceScaleFactor: 1 });
await sleep(900);
const narrowLayout = await measureTop("narrow 320 HUD");
await page.screenshot({ path: join(outDir, "game-court-narrow.jpg"), type: "jpeg", quality: 88 });
console.log("сохранён game-court-narrow.jpg");

// Жёсткая проверка геометрии: критические HUD-узлы должны существовать;
// горизонтальное переполнение фиксируется как ошибка, а не теряется в логе.
const layouts = [JSON.parse(courtLayout), JSON.parse(narrowLayout)] as {
  profile: unknown;
  resources: unknown;
  horizontalOverflow: boolean;
}[];
for (const layout of layouts) {
  if (!layout.profile || !layout.resources) {
    throw new Error("HUD layout incomplete: profile or resource board is missing");
  }
  if (layout.horizontalOverflow) {
    throw new Error("HUD causes horizontal document overflow at a target mobile viewport");
  }
}

await browser.close();
