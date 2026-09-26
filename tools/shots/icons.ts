/**
 * Нарезка листа иконок: `pnpm icons hud/icons/sheet-a.png --prefix a [--pad 3]`.
 *
 * Лист сгенерирован на ровном пурпурном фоне (#FF00FF). Скрипт открывает его в Chromium,
 * убирает фон по цвету (с расшивкой полупрозрачных краёв), находит связные пятна — отдельные
 * иконки, — сортирует их по рядам и столбцам и сохраняет каждую отдельным PNG с прозрачностью
 * рядом с листом: `<prefix>-01.png`, `<prefix>-02.png`, … плюс `<prefix>.json` с рамками.
 * Библиотек для картинок в песочнице нет, поэтому вся работа с пикселями — в canvas страницы.
 */

import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AddressInfo } from "node:net";
import { launchBrowser, openPage } from "./browser.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const uiDir = join(root, "docs", "game", "ui");
const args = process.argv.slice(2);
const argValue = (flag: string): string | undefined => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};
const sheet = args.find((a) => !a.startsWith("--") && a.endsWith(".png"));
if (!sheet) {
  console.error("укажите лист: pnpm icons hud/icons/sheet-a.png --prefix a");
  process.exit(1);
}
const prefix = argValue("--prefix") ?? basename(sheet, ".png");
const pad = Number(argValue("--pad") ?? 3);
const outDir = join(uiDir, dirname(sheet));

const types: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".html": "text/html; charset=utf-8" };
function serveUi(): Promise<{ origin: string; close: () => void }> {
  const server = createServer((request, response) => {
    const path = decodeURIComponent((request.url ?? "/").split("?")[0] ?? "/");
    const file = normalize(join(uiDir, path));
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

interface Item { x: number; y: number; w: number; h: number; png: string }

const { origin, close } = await serveUi();
const browser = await launchBrowser();
const page = await openPage(browser, origin);
await page.goto(`${origin}/`, { waitUntil: "load" }).catch(() => undefined);
await page.setContent("<!doctype html><title>icons</title>");

const result = await page.evaluate(
  async (src: string, padPx: number): Promise<{ w: number; h: number; key: number[]; items: Item[] }> => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const W = img.naturalWidth;
    const H = img.naturalHeight;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, W, H);
    const p = data.data;

    // Цвет фона — среднее по четырём углам.
    let kr = 0;
    let kg = 0;
    let kb = 0;
    let n = 0;
    for (const [cx, cy] of [[0, 0], [W - 12, 0], [0, H - 12], [W - 12, H - 12]]) {
      for (let y = cy; y < cy + 12; y++) {
        for (let x = cx; x < cx + 12; x++) {
          const i = (y * W + x) * 4;
          kr += p[i]!; kg += p[i + 1]!; kb += p[i + 2]!; n++;
        }
      }
    }
    kr /= n; kg /= n; kb /= n;

    // Альфа по расстоянию до цвета фона, расшивка краёв.
    const T0 = 55;
    const T1 = 150;
    const mask = new Uint8Array(W * H);
    for (let i = 0, j = 0; i < W * H; i++, j += 4) {
      const dr = p[j]! - kr;
      const dg = p[j + 1]! - kg;
      const db = p[j + 2]! - kb;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);
      let a = (dist - T0) / (T1 - T0);
      a = a < 0 ? 0 : a > 1 ? 1 : a;
      if (a <= 0) {
        p[j + 3] = 0;
        continue;
      }
      if (a < 1) {
        p[j] = Math.max(0, Math.min(255, (p[j]! - (1 - a) * kr) / a));
        p[j + 1] = Math.max(0, Math.min(255, (p[j + 1]! - (1 - a) * kg) / a));
        p[j + 2] = Math.max(0, Math.min(255, (p[j + 2]! - (1 - a) * kb) / a));
      }
      p[j + 3] = Math.round(a * 255);
      if (a > 0.5) mask[i] = 1;
    }
    ctx.putImageData(data, 0, 0);

    // Связные области (4-связность).
    const label = new Int32Array(W * H);
    const boxes: Array<{ x0: number; y0: number; x1: number; y1: number; count: number }> = [];
    const stack: number[] = [];
    for (let s = 0; s < W * H; s++) {
      if (!mask[s] || label[s]) continue;
      const id = boxes.length + 1;
      const box = { x0: W, y0: H, x1: 0, y1: 0, count: 0 };
      stack.push(s);
      label[s] = id;
      while (stack.length) {
        const i = stack.pop()!;
        const x = i % W;
        const y = (i - x) / W;
        box.count++;
        if (x < box.x0) box.x0 = x;
        if (x > box.x1) box.x1 = x;
        if (y < box.y0) box.y0 = y;
        if (y > box.y1) box.y1 = y;
        const near = [i - 1, i + 1, i - W, i + W];
        if (x === 0) near[0] = -1;
        if (x === W - 1) near[1] = -1;
        for (const k of near) {
          if (k >= 0 && k < W * H && mask[k] && !label[k]) {
            label[k] = id;
            stack.push(k);
          }
        }
      }
      boxes.push(box);
    }

    // Мусор — прочь; соседние рамки (ближе 6 px) — вместе.
    let items = boxes.filter((b) => b.count >= 150);
    const gap = 6;
    let merged = true;
    while (merged) {
      merged = false;
      outer: for (let a = 0; a < items.length; a++) {
        for (let b = a + 1; b < items.length; b++) {
          const A = items[a]!;
          const B = items[b]!;
          if (A.x0 - gap <= B.x1 && B.x0 - gap <= A.x1 && A.y0 - gap <= B.y1 && B.y0 - gap <= A.y1) {
            items[a] = { x0: Math.min(A.x0, B.x0), y0: Math.min(A.y0, B.y0), x1: Math.max(A.x1, B.x1), y1: Math.max(A.y1, B.y1), count: A.count + B.count };
            items.splice(b, 1);
            merged = true;
            break outer;
          }
        }
      }
    }
    items = items.filter((b) => b.x1 - b.x0 > 24 && b.y1 - b.y0 > 24);

    // Порядок: ряды по центру Y, внутри ряда — по X.
    const avgH = items.reduce((s, b) => s + (b.y1 - b.y0), 0) / Math.max(1, items.length);
    const rows: Array<{ cy: number; list: typeof items }> = [];
    for (const b of items.slice().sort((u, v) => (u.y0 + u.y1) - (v.y0 + v.y1))) {
      const cy = (b.y0 + b.y1) / 2;
      const row = rows.find((r) => Math.abs(r.cy - cy) < avgH * 0.55);
      if (row) {
        row.list.push(b);
        row.cy = row.list.reduce((s, q) => s + (q.y0 + q.y1) / 2, 0) / row.list.length;
      } else rows.push({ cy, list: [b] });
    }
    rows.sort((u, v) => u.cy - v.cy);
    const ordered = rows.flatMap((r) => r.list.sort((u, v) => (u.x0 + u.x1) - (v.x0 + v.x1)));

    const out: Item[] = [];
    for (const b of ordered) {
      const x = Math.max(0, b.x0 - padPx);
      const y = Math.max(0, b.y0 - padPx);
      const w = Math.min(W, b.x1 + padPx + 1) - x;
      const h = Math.min(H, b.y1 + padPx + 1) - y;
      const c2 = document.createElement("canvas");
      c2.width = w;
      c2.height = h;
      c2.getContext("2d")!.drawImage(canvas, x, y, w, h, 0, 0, w, h);
      out.push({ x, y, w, h, png: c2.toDataURL("image/png") });
    }
    return { w: W, h: H, key: [Math.round(kr), Math.round(kg), Math.round(kb)], items: out };
  },
  `${origin}/${sheet}`,
  pad,
);

mkdirSync(outDir, { recursive: true });
const manifest = result.items.map((item, index) => {
  const name = `${prefix}-${String(index + 1).padStart(2, "0")}.png`;
  writeFileSync(join(outDir, name), Buffer.from(item.png.split(",")[1]!, "base64"));
  return { name, x: item.x, y: item.y, w: item.w, h: item.h };
});
writeFileSync(join(outDir, `${prefix}.json`), `${JSON.stringify({ sheet, size: [result.w, result.h], key: result.key, icons: manifest }, null, 2)}\n`);
console.log(`лист ${sheet} ${result.w}×${result.h}, фон rgb(${result.key.join(",")}) → ${manifest.length} иконок в ${outDir.replace(`${root}/`, "")}/`);
for (const m of manifest) console.log(`  ${m.name}  ${m.w}×${m.h} @ ${m.x},${m.y}`);
await page.close();
await browser.close();
close();
process.exit(0);
