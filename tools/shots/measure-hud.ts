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
  defaultViewport: {
    width: Number(process.argv[4] ?? 390),
    height: Number(process.argv[5] ?? 844),
    deviceScaleFactor: Number(process.argv[6] ?? 1),
    hasTouch: true,
    isMobile: true,
  },
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
await inputs[0]!.type(`Lord${suffix.slice(-3)}`);
await inputs[1]!.type(`lord-${suffix}@example.com`);
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
    const b = el.getBoundingClientRect(); return { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) }; };
  const lord = r(".hud-lord"); const res = r(".hud-res");
  const portrait = r(".hud-lord .portrait"); const face = r(".hud-lord .portrait .face");
  const frame = r(".hud-lord .portrait .frame"); const tag = r(".hud-lord .portrait .lvl-tag");
  const rows = r(".hud-lord .rows");
  /* теперь это два яруса: пересечение считаем по обеим осям, а не только по горизонтали */
  const overlap = lord && res
    ? !(lord.x + lord.w <= res.x + 1 || res.x + res.w <= lord.x + 1 ||
        lord.y + lord.h <= res.y + 1 || res.y + res.h <= lord.y + 1)
    : null;

  /* Ожидаемая геометрия — измеренные доли подложки lord-plate.png (1566x754). */
  /* Подложка n1 (1316x617): гнездо аватара и три зоны надписей, измеренные по пикселям. */
  const P = { fx: 0.1216, fy: 0.2058, fw: 0.2690, fh: 0.5737,
              zones: [[0.44, null, 0.2578, 0.0903], [0.56, null, 0.46, 0.125], [0.54, null, 0.67, 0.11]],
              zoneW: [0.36, 0.24, 0.40] };
  const exp = (px, py, pw, ph) => ({ x: +(lord.x + px * lord.w).toFixed(1), y: +(lord.y + py * lord.h).toFixed(1),
                                     w: +(pw * lord.w).toFixed(1), h: +(ph * lord.h).toFixed(1) });
  const dev = (a, b) => a && b ? { dx: +(a.x - b.x).toFixed(1), dy: +(a.y - b.y).toFixed(1),
                                   dw: +(a.w - b.w).toFixed(1), dh: +(a.h - b.h).toFixed(1) } : null;
  const expPortrait = exp(P.fx, P.fy, P.fw, P.fh);
  const expRows = P.zones.map((z, i) => exp(z[0], z[2], P.zoneW[i], z[3]));

  const rowSel = [".hud-lord .rows .name", ".hud-lord .power-row", ".hud-lord .state-row"];
  const gotRows = rowSel.map(r);

  /* центр лица и рамки против центра слота: должны совпадать */
  const center = (b) => b ? { cx: +(b.x + b.w / 2).toFixed(1), cy: +(b.y + b.h / 2).toFixed(1) } : null;
  const cPortrait = center(portrait), cFace = center(face), cFrame = center(frame);

  /* текст не должен вылезать из своей ячейки по высоте */
  const fit = gotRows.map((g, i) => {
    const el = document.querySelector(rowSel[i]);
    if (!el || !g) return null;
    const inner = [...el.children].reduce((m, c) => Math.max(m, c.getBoundingClientRect().height), 0);
    return { row: +(g.h).toFixed(1), content: +inner.toFixed(1), free: +(g.h - inner).toFixed(1),
             font: getComputedStyle(el).fontSize, scrollX: el.scrollWidth - el.clientWidth };
  });

  const chips = [...document.querySelectorAll(".hud-res .chip")].map((c) => {
    const b = c.getBoundingClientRect();
    const ic = c.querySelector(".hud-ic");
    const ib = ic ? ic.getBoundingClientRect() : null;
    const num = c.querySelector("b");
    return { w: +b.width.toFixed(1), h: +b.height.toFixed(1), minH: getComputedStyle(c).minHeight,
             overflow: Math.max(0, c.scrollWidth - c.clientWidth),
             icFillW: ib ? +(ib.width / b.width * 100).toFixed(0) : null,
             icFillH: ib ? +(ib.height / b.height * 100).toFixed(0) : null,
             numFont: num ? getComputedStyle(num).fontSize : null };
  });

  const cs = (sel, prop) => { const el = document.querySelector(sel); return el ? getComputedStyle(el)[prop] : null; };
  const styles = {
    supportCqh: CSS.supports("height", "1cqh"),
    containerType: cs(".hud-lord", "containerType"),
    lordFont: cs(".hud-lord", "fontSize"),
    nameFont: cs(".hud-lord .rows .name", "fontSize"),
    powerImg: { w: cs(".hud-lord .power-row img", "width"), h: cs(".hud-lord .power-row img", "height") },
    powerNum: cs(".hud-lord .power-row b", "fontSize"),
    vipb: { h: cs(".hud-lord .vipb", "height"), font: cs(".hud-lord .vipb", "fontSize") },
    tagFont: cs(".hud-lord .portrait .lvl-tag", "fontSize"),
  };

  const topBox = (() => { const e = document.querySelector(".hud-top"); if (!e) return null;
    const b = e.getBoundingClientRect(); return { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) }; })();
  return { styles, topBox, lord, res, overlap, screen: window.innerWidth,
           portrait: { got: portrait, exp: expPortrait, dev: dev(portrait, expPortrait) },
           frame: { got: frame, face, cPortrait, cFrame, cFace },
           tag,
           rows: { got: rows, cells: gotRows.map((g, i) => ({ got: g, exp: expRows[i], dev: dev(g, expRows[i]), fit: fit[i] })) },
           chips };
})()`);
console.log("Замер верхней строки HUD:");
console.log(JSON.stringify(report, null, 2));
await page.screenshot({ path: join(outDir, `${prefix}-hud.png`) });
console.log(`снимок: .tmp/${prefix}-hud.png`);
await browser.close();
