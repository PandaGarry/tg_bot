// быстрый визуальный прогон: свежий игрок → основание → карта/приближение
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
import chromium, { inflate, setupLambdaEnvironment } from '@sparticuz/chromium';

const libs = await inflate(resolve('node_modules/@sparticuz/chromium/bin/al2023.tar.br'));
setupLambdaEnvironment(libs);
process.env.LD_LIBRARY_PATH = `${libs}/lib:${process.env.LD_LIBRARY_PATH ?? ''}`;
const OUT = 'art';
mkdirSync(OUT, { recursive: true });
const W = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  executablePath: await chromium.executablePath(),
  headless: true,
  userDataDir: '/tmp/ashfall-art',
  defaultViewport: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 200)));
const shot = async (name) => {
  await page.screenshot({ path: `${OUT}/${name}.png`, captureBeyondViewport: false, optimizeForSpeed: true });
  console.log('  ✓', name);
};

async function aimAt(tx, ty) {
  return page.evaluate(({ tx, ty }) => {
    const s = globalThis.__ashfall;
    s.camera.x = tx;
    s.camera.y = ty;
    return { x: s.camera.x, y: s.camera.y, zoom: s.camera.zoom };
  }, { tx, ty });
}

async function tileToScreen(tx, ty) {
  return page.evaluate(({ tx, ty }) => {
    const s = globalThis.__ashfall;
    const ts = Math.max(18, Math.min(window.innerWidth, window.innerHeight) / 22) * s.camera.zoom;
    return {
      x: (tx - s.camera.x) * ts + window.innerWidth / 2,
      y: (ty - s.camera.y) * ts + window.innerHeight / 2,
    };
  }, { tx, ty });
}

async function pickFreeTiles(worldId, limit = 12) {
  const res = await fetch(`http://127.0.0.1:3000/api/world/${worldId}`);
  const data = await res.json();
  const bin = atob(data.map);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const at = (x, y) => bytes[y * data.size + x];
  const busy = new Set(data.occupied.map(([px, py]) => `${px}:${py}`));
  const free = [];
  for (let y = 2; y < data.size - 2 && free.length < 4000; y++) {
    for (let x = 2; x < data.size - 2 && free.length < 4000; x++) {
      const code = at(x, y);
      if (code === 3 || code === 4 || busy.has(`${x}:${y}`)) continue;
      let ring = false;
      for (let oy = -1; oy <= 1 && !ring; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          if (ox === 0 && oy === 0) continue;
          if (busy.has(`${x + ox}:${y + oy}`)) { ring = true; break; }
        }
      }
      if (ring) continue;
      free.push({ x, y });
    }
  }
  return free.slice(0, limit * 100);
}

await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle2' });
await W(1000);
await shot('m1-вход');

const needsAuth = await page.evaluate(() => !!document.querySelector('#auth input.text'));
if (needsAuth) {
  await page.type('#auth input.text', `Арт${Math.floor(Math.random() * 900 + 100)}`);
  await W(300);
  await page.evaluate(() => document.querySelector('#auth button.primary')?.click());
  await W(2600);
  await shot('m2-выбор-места');

  // основание: ближайший к центру свободный тайл в ТОМ мире, куда посадил сервер
  const myWorld = await page.evaluate(() => globalThis.__ashfall?.snapshot?.world?.id ?? 1);
  console.log('  · игроку назначен мир', myWorld);
  const spots = await pickFreeTiles(myWorld, 40);
  spots.sort((a, b) => ((a.x - 48) ** 2 + (a.y - 48) ** 2) - ((b.x - 48) ** 2 + (b.y - 48) ** 2));
  const target = spots[0];
  console.log('  · тайл для города:', JSON.stringify(target));
  await aimAt(target.x + 0.5, target.y + 0.5);
  await W(600);
  // тапаем и проверяем выбор: гонок снапшота не ждём, а повторяем попытку
  for (let attempt = 0; attempt < 5; attempt++) {
    await W(1000);
    const pos = await tileToScreen(target.x + 0.5, target.y + 0.5);
    await page.touchscreen.tap(pos.x, pos.y);
    await W(900);
    const selected = await page.evaluate(() => globalThis.__ashfall?.placing?.selected ?? null);
    if (selected) { console.log('  · тайл выбран:', JSON.stringify(selected)); break; }
    console.log('  · повтор тапа (selected пуст), попытка', attempt + 1);
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const kicked = await page.evaluate(() => {
      const chip = [...document.querySelectorAll('#banner button')].find((c) => (c.textContent ?? '').includes('Основать'));
      if (!chip) return false;
      chip.click();
      return true;
    });
    if (kicked) break;
    console.log('  · повтор клика «Основать», попытка', attempt + 1);
    await W(900);
  }
  await W(2600);
  let founded = await page.evaluate(() => globalThis.__ashfall?.snapshot?.player?.x ?? -1);
  if (founded < 0) {
    // город не встал — читаем тост и пробуем соседний тайл из списка
    const toast = await page.evaluate(() => [...document.querySelectorAll('#toasts .toast')].map((el) => el.textContent)[0] ?? '');
    console.log('  · основание не удалось:', toast);
    for (const alt of spots.slice(1, 5)) {
      await aimAt(alt.x + 0.5, alt.y + 0.5);
      await W(700);
      const pos = await tileToScreen(alt.x + 0.5, alt.y + 0.5);
      await page.touchscreen.tap(pos.x, pos.y);
      await W(800);
      const ok = await page.evaluate(() => {
        const chip = [...document.querySelectorAll('#banner button')].find((c) => (c.textContent ?? '').includes('Основать'));
        if (!chip) return false;
        chip.click();
        return true;
      });
      await W(2000);
      founded = await page.evaluate(() => globalThis.__ashfall?.snapshot?.player?.x ?? -1);
      if (ok && founded >= 0) break;
    }
  }
  console.log('  · город основан на x=', founded);
} else {
  console.log('  · профиль уже в игре, вход пропускаем');
}
await shot('m3-город-на-карте');

await page.evaluate(() => { globalThis.__ashfall.camera.zoom = 2.1; });
await W(600);
await shot('m4-приближено');
await page.evaluate(() => { globalThis.__ashfall.camera.zoom = 0.7; });
await W(600);
await shot('m5-мир-сверху');

// шторка лагеря — ближайший лагерь
const camp = await page.evaluate(() => {
  const s = globalThis.__ashfall;
  const p = s.snapshot.player;
  const camps = s.snapshot.entities
    .filter((e) => e.kind === 'camp')
    .map((e) => ({ id: e.id, x: e.x, y: e.y, d: (e.x - p.x) ** 2 + (e.y - p.y) ** 2 }))
    .sort((a, b) => a.d - b.d);
  return camps[0] ?? null;
});
if (camp) {
  await page.evaluate(() => { globalThis.__ashfall.camera.zoom = 1.3; });
  await aimAt(camp.x + 0.5, camp.y + 0.5);
  await W(700);
  const cp = await tileToScreen(camp.x + 0.5, camp.y + 0.5);
  await page.touchscreen.tap(cp.x, cp.y);
  await W(900);
  await shot('m6-лагерь-шторка');
  await page.evaluate(() => {
    const chip = [...document.querySelectorAll('#sheet .chip')].find((c) => (c.textContent ?? '').includes('Атаковать'));
    chip?.click();
  });
  await W(1000);
  await shot('m7-композер');
  await page.evaluate(() => {
    const close = [...document.querySelectorAll('#sheet .chip, #sheet button')].find((c) => (c.textContent ?? '').includes('Закрыть') || (c.textContent ?? '').includes('Назад'));
    close?.click();
  });
  await W(500);
}

// город и войско — табы
await page.evaluate(() => document.querySelector('#tab-city')?.click());
await W(900);
await shot('m8-город');
await page.evaluate(() => document.querySelector('#tab-army')?.click());
await W(900);
await shot('m9-войско');
await page.evaluate(() => document.querySelector('#tab-army')?.click());
await W(500);

console.log('готово');
await browser.close();
