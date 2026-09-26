/**
 * Снимки рабочего интерфейса: `pnpm shots [--only часть-имени] [--out каталог]`.
 *
 * Поднимает локальный статический сервер над `docs/game/ui`, открывает страницы в Chromium
 * (см. browser.ts) и складывает JPG в `docs/game/ui/shots/`:
 *   - обзор галереи десяти направлений и каждое направление на трёх экранах (двор, карта/марш, отчёт боя);
 *   - прежний рабочий макет двора в четырёх настроениях сцены и с открытой панелью постройки;
 *   - страницы концептов Bone-Wood (главный экран, единая система, десять первых картинок).
 * Заказчик смотрит их файлами — живой предпросмотр ему недоступен.
 */

import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AddressInfo } from "node:net";
import type { Browser, Page } from "puppeteer-core";
import { launchBrowser, openPage } from "./browser.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const uiDir = join(root, "docs", "game", "ui");

const args = process.argv.slice(2);
const argValue = (flag: string): string | undefined => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};
const only = argValue("--only");
const outDir = resolve(argValue("--out") ?? join(uiDir, "shots"));
mkdirSync(outDir, { recursive: true });

const types: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".md": "text/plain; charset=utf-8",
};

function serveUi(): Promise<{ origin: string; close: () => void }> {
  const server = createServer((request, response) => {
    const path = decodeURIComponent((request.url ?? "/").split("?")[0] ?? "/");
    const file = normalize(join(uiDir, path.endsWith("/") ? `${path}index.html` : path));
    if (!file.startsWith(uiDir) || !existsSync(file) || statSync(file).isDirectory()) {
      response.writeHead(404);
      response.end();
      return;
    }
    response.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
    response.end(readFileSync(file));
  });
  return new Promise((done) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      done({ origin: `http://127.0.0.1:${port}`, close: () => server.close() });
    });
  });
}

const JPEG = { type: "jpeg" as const, quality: 82 };
const PHONE = { width: 390, height: 844 };

const styles: Array<[id: string, slug: string, name: string]> = [
  ["01", "chronicle", "Хроника двора"],
  ["02", "soot-bone", "Сажа и кость"],
  ["03", "carved-oak", "Резной дуб"],
  ["04", "snow-stone", "Снег на камне"],
  ["05", "march-map", "Походная карта"],
  ["06", "seal-archive", "Печать и архив"],
  ["07", "quiet-mycelium", "Тихое подгрибье"],
  ["08", "garrison-ledger", "Гарнизонная ведомость"],
  ["09", "ash-charred-wood", "Зола и обугленное дерево"],
  ["10", "stone-banner", "Камень и знамя"],
];

interface Frame {
  label: string;
  png: Buffer;
}

/** Склейка кадров в один лист: три телефона в ряд с подписями — тем же браузером. */
async function composeSheet(page: Page, title: string, frames: Frame[], file: string): Promise<void> {
  const cards = frames
    .map(
      (frame) => `<figure><img src="data:image/png;base64,${frame.png.toString("base64")}" width="${PHONE.width}" height="${PHONE.height}"><figcaption>${frame.label}</figcaption></figure>`,
    )
    .join("");
  await page.setContent(
    `<!doctype html><html lang="ru"><meta charset="utf-8"><style>
      body{margin:0;background:#e9e5dc;font:13px/1.3 "Open Sans",Arial,sans-serif;color:#2b2a26}
      #sheet{display:inline-block;padding:18px 20px 16px}
      h1{margin:0 0 12px;font:600 18px Georgia,serif}
      .row{display:flex;gap:18px}
      figure{margin:0}
      img{display:block;border-radius:18px;box-shadow:0 10px 28px rgba(0,0,0,.18)}
      figcaption{margin-top:8px;text-align:center;font-weight:600}
    </style><div id="sheet"><h1>${title}</h1><div class="row">${cards}</div></div></html>`,
    { waitUntil: "load" },
  );
  const sheet = await page.$("#sheet");
  if (!sheet) throw new Error("лист не собрался");
  await sheet.screenshot({ path: file, ...JPEG });
}

async function settle(page: Page, ms = 400): Promise<void> {
  await page.evaluate(() => (document as Document & { fonts?: FontFaceSet }).fonts?.ready);
  await new Promise((done) => setTimeout(done, ms));
}

type Shot = (browser: Browser, origin: string) => Promise<string[]>;

const shots: Record<string, Shot> = {
  /** Обзор галереи: описание, короткий список, телефон и сетка десяти примеров. */
  async "gallery-overview"(browser, origin) {
    const page = await openPage(browser, origin);
    await page.setViewport({ width: 1540, height: 1000, deviceScaleFactor: 1 });
    await page.goto(`${origin}/index.html`, { waitUntil: "load" });
    await settle(page);
    const file = join(outDir, "gallery-overview.jpg");
    await page.screenshot({ path: file, fullPage: true, ...JPEG });
    await page.close();
    return [file];
  },

  /** Каждое из десяти направлений: двор, карта/марш, отчёт боя — экран телефона 390×844. */
  async "gallery-styles"(browser, origin) {
    const page = await openPage(browser, origin);
    await page.setViewport({ width: 1600, height: 1200, deviceScaleFactor: 2 });
    await page.goto(`${origin}/index.html`, { waitUntil: "load" });
    await settle(page);
    const sheetPage = await openPage(browser, origin);
    await sheetPage.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 1.5 });
    const files: string[] = [];
    for (const [id, slug, name] of styles) {
      if (only && !`style-${id}-${slug}`.includes(only) && only !== "gallery-styles") continue;
      const frames: Frame[] = [];
      for (const [view, label] of [
        ["court", "Двор · частокол"],
        ["map", "Карта · подготовка марша"],
        ["report", "Отчёт боя"],
      ] as const) {
        await page.evaluate(
          (styleId, viewName) => {
            const w = window as Window & { selectStyle?: (id: string) => void; selectExample?: (name: string) => void };
            w.selectStyle?.(styleId);
            w.selectExample?.(viewName);
          },
          id,
          view,
        );
        await settle(page, 250);
        const screen = await page.$(".phone-screen");
        if (!screen) throw new Error("экран телефона не найден");
        frames.push({ label, png: Buffer.from(await screen.screenshot({ type: "png" })) });
      }
      const file = join(outDir, `style-${id}-${slug}.jpg`);
      await composeSheet(sheetPage, `${id} · ${name}`, frames, file);
      files.push(file);
    }
    await sheetPage.close();
    await page.close();
    return files;
  },

  /** Прежний рабочий макет двора: четыре настроения сцены и открытая панель постройки. */
  async "mockup-court"(browser, origin) {
    const page = await openPage(browser, origin);
    await page.setViewport({ ...PHONE, deviceScaleFactor: 2 });
    await page.goto(`${origin}/mockup.html`, { waitUntil: "load" });
    await settle(page);
    const sheetPage = await openPage(browser, origin);
    await sheetPage.setViewport({ width: 1800, height: 1000, deviceScaleFactor: 1.5 });
    const frames: Frame[] = [];
    for (const [key, label] of [
      ["1", "1 · яркое дневное"],
      ["2", "2 · холодное сумеречное"],
      ["3", "3 · крафтовое земляное"],
      ["4", "4 · светящееся ночное"],
    ] as const) {
      await page.click(`#lab button[data-s="${key}"]`);
      await settle(page, 300);
      frames.push({ label, png: Buffer.from(await page.screenshot({ type: "png" })) });
    }
    await page.click(`#lab button[data-s="1"]`);
    await page.click(".tile.sel");
    await settle(page, 600);
    frames.push({ label: "панель постройки открыта", png: Buffer.from(await page.screenshot({ type: "png" })) });
    const file = join(outDir, "mockup-court.jpg");
    await composeSheet(sheetPage, "Рабочий макет двора (mockup.html)", frames, file);
    await sheetPage.close();
    await page.close();
    return [file];
  },

  /** Страницы концептов: главный экран Bone-Wood №08, единая система round-08, первые десять картинок. */
  async "concept-pages"(browser, origin) {
    const pages: Array<[path: string, file: string]> = [
      ["/concepts/bone-wood-main-screen/index.html", "concept-bone-wood-main-screen.jpg"],
      ["/concepts/bone-wood-round-08/index.html", "concept-bone-wood-round-08.jpg"],
      ["/concepts/index.html", "concept-first-ten.jpg"],
    ];
    const files: string[] = [];
    for (const [path, name] of pages) {
      if (only && !name.includes(only) && only !== "concept-pages") continue;
      const page = await openPage(browser, origin);
      await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
      await page.goto(`${origin}${path}`, { waitUntil: "load" });
      // Ленивые картинки: прокрутить страницу, чтобы всё загрузилось.
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 700) {
          window.scrollTo(0, y);
          await new Promise((done) => setTimeout(done, 60));
        }
        window.scrollTo(0, 0);
        await Promise.all([...document.images].map((img) => (img.complete ? null : new Promise((done) => img.addEventListener("load", done, { once: true })))));
      });
      await settle(page);
      const file = join(outDir, name);
      await page.screenshot({ path: file, fullPage: true, ...JPEG });
      files.push(file);
      await page.close();
    }
    return files;
  },
};

const started = Date.now();
const { origin, close } = await serveUi();
const browser = await launchBrowser();
console.log(`Chromium ${await browser.version()} · сервер ${origin} · вывод ${outDir}`);
const made: string[] = [];
try {
  for (const [name, shot] of Object.entries(shots)) {
    const matches = !only || name.includes(only) || name === "gallery-styles" || name === "concept-pages";
    if (!matches) continue;
    const files = await shot(browser, origin);
    for (const file of files) console.log(`  ${file.replace(`${root}/`, "")}`);
    made.push(...files);
  }
} finally {
  await browser.close();
  close();
}

if (made.length === 0) {
  console.error(`Нет снимков по фильтру «${only}». Имена: ${Object.keys(shots).join(", ")}, style-NN-*, concept-*.`);
  process.exit(1);
}
writeFileSync(
  join(outDir, "README.md"),
  [
    "# Снимки интерфейса",
    "",
    "Собраны командой `pnpm shots` (Chromium из npm-пакета, без системной установки). Не править вручную —",
    "перегенерировать. Это снимки макетов и страниц концептов, не игровые экраны.",
    "",
    ...made.map((file) => `- \`${file.replace(`${outDir}/`, "")}\``),
    "",
  ].join("\n"),
);
console.log(`Готово: ${made.length} файл(ов) за ${((Date.now() - started) / 1000).toFixed(1)} с.`);
