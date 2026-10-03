/**
 * Автотест касанием двора (мобильный режим, настоящие touch-события): `corepack pnpm exec tsx tools/shots/touch.ts [порт] [префикс]`.
 * Нужен запущенный dev-сервер (`bash tools/replit-dev.sh`). Проверяет серию тапов по зданию (в том числе по крыше),
 * перенос перетаскиванием, поворот кнопками и поворот камеры двумя пальцами; печатает счёт успехов и
 * сохраняет снимки в `.tmp/<префикс>-*.png`. Опирается на dev-хуки `window.__yardProject` и `window.__yardState`.
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
await sleep(4_000);

// Касания шлём событиями указателя прямо в странице одной задачей: у SwiftShader кадры по секундам,
// и «настоящий» CDP-тап растягивался бы между нажатием и отпусканием, превращаясь в долгое нажатие.
await page.evaluate(`(() => {
  const c = document.querySelector("canvas");
  const ev = (type, id, x, y) => c.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: "touch", isPrimary: id === 1, clientX: x, clientY: y, bubbles: true, cancelable: true, button: 0, buttons: type === "pointerup" ? 0 : 1 }));
  window.__t = {
    tap(x, y) { ev("pointerdown", 1, x, y); ev("pointerup", 1, x, y); },
    drag(pts) { ev("pointerdown", 1, pts[0][0], pts[0][1]); for (const p of pts.slice(1)) ev("pointermove", 1, p[0], p[1]); const l = pts[pts.length - 1]; ev("pointerup", 1, l[0], l[1]); },
    two(a, b) {
      ev("pointerdown", 1, a[0][0], a[0][1]); ev("pointerdown", 2, b[0][0], b[0][1]);
      for (let i = 1; i < a.length; i++) { ev("pointermove", 1, a[i][0], a[i][1]); ev("pointermove", 2, b[i][0], b[i][1]); }
      ev("pointerup", 1, a[a.length - 1][0], a[a.length - 1][1]); ev("pointerup", 2, b[b.length - 1][0], b[b.length - 1][1]);
    },
  };
})()`);
const tap = (x: number, y: number) => page.evaluate(`window.__t.tap(${x}, ${y})`);
const drag = (pts: [number, number][]) => page.evaluate(`window.__t.drag(${JSON.stringify(pts)})`);
const two = (a: [number, number][], b: [number, number][]) => page.evaluate(`window.__t.two(${JSON.stringify(a)}, ${JSON.stringify(b)})`);
const project = async (gx: number, gz: number, y = 0): Promise<[number, number]> =>
  (await page.evaluate(`window.__yardProject(${gx}, ${gz}, ${y})`)) as [number, number];
const state = async () => (await page.evaluate(`window.__yardState()`)) as { pending: { type: string; x: number; z: number; rot: number } | null; selected: unknown; az: number };
const has = (sel: string) => page.evaluate(`!!document.querySelector(${JSON.stringify(sel)})`) as Promise<boolean>;
const clickText = (text: string) =>
  page.evaluate(`(() => { const b = [...document.querySelectorAll("button")].find((x) => (x.textContent?.includes(${JSON.stringify(text)}) || x.getAttribute('aria-label')?.includes(${JSON.stringify(text)}))); b && b.click(); return !!b; })()`);
const shot = (name: string) => page.screenshot({ path: join(outDir, `${prefix}-${name}.png`), type: "png" });
const results: Record<string, [number, number]> = {};
const score = (name: string, ok: boolean) => {
  const r = (results[name] ??= [0, 0]);
  r[1] += 1;
  if (ok) r[0] += 1;
  console.log(`  ${ok ? "ok " : "НЕТ"} ${name}`);
};
/** Ждём условие до `ms`: SwiftShader рисует медленно, React обновляется с задержкой. */
const until = async (fn: () => Promise<boolean>, ms = 3000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return true;
    await sleep(100);
  }
  return fn();
};
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

// 1. тапы по Цитадели: стена, дверь, крыша; затем тап по пустому месту снимает выбор
const TAPS = Number(process.env.TAPS ?? 8);
for (let i = 0; i < TAPS; i++) {
  const [x, y] = await project(7 + rnd(-1, 1), 7 + rnd(-1, 1), rnd(0.4, 2.2));
  await tap(x, y);
  score("тап по Цитадели выбирает её", await until(() => has(".select-bar")));
  const [ex, ey] = await project(2, 11);
  await tap(ex, ey);
  score("тап по пустому месту снимает выбор", await until(async () => !(await has(".select-bar"))));
}
await shot("0-start");

// 2. перенос: выбрать, «Переместить», перетащить призрак в разные клетки (палец ниже цели на длину подъёма)
const targets: [number, number][] = [[4, 4], [10, 10], [4, 10], [10, 4], [7, 3], [3, 7]];
await tap(...(await project(7, 7, 1.2)));
await until(() => has(".select-bar"));
await clickText("Переместить");
score("«Переместить» берёт здание в руки", await until(async () => (await state()).pending !== null));
for (const [tx, tz] of targets) {
  const st = await state();
  const [fx, fy] = await project(st.pending?.x ?? 7, st.pending?.z ?? 7);
  const [gx, gy] = await project(tx, tz);
  const path: [number, number][] = [[fx, fy + 56]];
  for (let k = 1; k <= 12; k++) path.push([fx + ((gx - fx) * k) / 12, fy + 56 + ((gy + 56 - (fy + 56)) * k) / 12]);
  await drag(path);
  await until(async () => {
    const s = await state();
    return s.pending?.x === tx && s.pending?.z === tz;
  }, 2000);
  const after = await state();
  score("перенос за призраком попадает в клетку", after.pending?.x === tx && after.pending?.z === tz);
}
await shot("1-moved");

// 3. поворот кнопками: четыре нажатия возвращают исходный поворот
const r0 = (await state()).pending?.rot ?? 0;
const seen: number[] = [];
for (let i = 0; i < 4; i++) {
  await page.evaluate(`document.querySelector(".place-bar button[aria-label^='Повернуть'][aria-label$='вправо']")?.click()`);
  await until(async () => ((await state()).pending?.rot ?? -1) !== (seen.at(-1) ?? r0), 1500);
  seen.push((await state()).pending?.rot ?? -1);
}
score("поворот на 90° четыре раза даёт круг", seen.join() === [1, 2, 3, 0].map((v) => (v + r0) % 4).join() || seen[3] === r0);
await page.evaluate(`document.querySelector(".place-bar button[aria-label^='Повернуть'][aria-label$='вправо']")?.click()`);
await sleep(300);
await shot("2-rotated");

// 4. отмена: здание остаётся на месте
await clickText("Отмена");
score("после отмены здание не в руках", await until(async () => (await state()).pending === null));

// 5. камера: два пальца крутят вид
const az0 = (await state()).az;
const pa: [number, number][] = [[150, 450]];
const pb: [number, number][] = [[250, 450]];
for (let k = 1; k <= 10; k++) {
  pa.push([150 + k * 3, 450 - k * 6]);
  pb.push([250 - k * 3, 450 + k * 6]);
}
await two(pa, pb);
await sleep(800);
const az1 = (await state()).az;
score("два пальца вращают камеру", Math.abs(az1 - az0) > 0.1);
await shot("3-camera");

// 6. постановка новой постройки перетаскиванием с карточки
await page.evaluate(`document.querySelector(".hud-rb")?.click()`);
await sleep(500);
await page.evaluate(`(() => { const c = [...document.querySelectorAll(".bcard")].find((x) => x.textContent?.includes("Жилой дом")); c && c.click(); })()`);
await sleep(400);
const [px, py] = await project(4, 4);
const [qx, qy] = await project(10, 10);
const path2: [number, number][] = [[px, py + 56]];
for (let k = 1; k <= 10; k++) path2.push([px + ((qx - px) * k) / 10, py + 56 + ((qy - py) * k) / 10]);
await drag(path2);
await until(async () => (await state()).pending?.x === 10, 2000);
const placed = (await state()).pending;
score("новая постройка ставится в клетку под призраком", placed?.type === "cottage" && placed.x === 10 && placed.z === 10);
await shot("4-place");

console.log("\nРезультаты касания (успехов / попыток):");
for (const [k, [ok, n]] of Object.entries(results)) console.log(`  ${ok === n ? "OK " : "ЛОЖЬ"} ${k}: ${ok}/${n}`);
await browser.close();
