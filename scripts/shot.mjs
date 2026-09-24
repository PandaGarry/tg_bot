/**
 * Живые скриншоты игры в настройках телефона (390×844).
 * Браузер ставится из npm-пакета: внешние CDN в песочнице недоступны.
 *
 *   node scripts/shot.mjs [baseUrl] [outDir]
 */
import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import puppeteer from 'puppeteer-core';
import chromium, { inflate, setupLambdaEnvironment } from '@sparticuz/chromium';

const base = process.argv[2] ?? 'http://127.0.0.1:3000';
const outDir = process.argv[3] ?? 'shots';
const profile = '/tmp/ashfall-profile';
const dbPath = process.env.ASHFALL_DB ?? 'data/ashfall.db';
mkdirSync(outDir, { recursive: true });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const VW = 390;
const VH = 844;
const TILE = 18; // baseTileSize из рендерера при 390×844

const libs = await inflate(resolve('node_modules/@sparticuz/chromium/bin/al2023.tar.br'));
setupLambdaEnvironment(libs);
process.env.LD_LIBRARY_PATH = `${libs}/lib:${process.env.LD_LIBRARY_PATH ?? ''}`;

async function withBrowser(fn) {
  const browser = await puppeteer.launch({
    args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    executablePath: await chromium.executablePath(),
    headless: true,
    userDataDir: profile,
    defaultViewport: { width: VW, height: VH, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
  });
  try {
    await fn(browser);
  } finally {
    await browser.close().catch(() => {});
  }
}

async function screen(page, name) {
  await page.screenshot({ path: `${outDir}/${name}.png` });
  console.log('  ✓', `${outDir}/${name}.png`);
}

async function open(browser) {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message.slice(0, 120)));
  await page.goto(base, { waitUntil: 'networkidle2', timeout: 60_000 });
  await wait(2000);
  return page;
}


/** Наводит камеру так, чтобы свой город и цель были видны вместе. */
async function aimAt(page, tx, ty) {
  return page.evaluate(
    ({ x, y }) => {
      const st = globalThis.__ashfall;
      if (!st?.snapshot) return null;
      const p = st.snapshot.player;
      st.camera.x = (p.x + x) / 2;
      st.camera.y = (p.y + y) / 2;
      const dist = Math.hypot(p.x - x, p.y - y) * 18;
      st.camera.zoom = Math.max(0.5, Math.min(1.6, 320 / Math.max(1, dist)));
      return { x: st.camera.x, y: st.camera.y, zoom: st.camera.zoom, px: p.x, py: p.y };
    },
    { x: tx, y: ty },
  );
}

/** Координаты тайла на экране по текущей камере. */
async function tileToScreen(page, tx, ty) {
  return page.evaluate(
    ({ x, y }) => {
      const st = globalThis.__ashfall;
      const cam = st.camera;
      const ts = 18 * cam.zoom;
      return { x: (x - cam.x) * ts + 195, y: (y - cam.y) * ts + 422 };
    },
    { x: tx, y: ty },
  );
}


/** Подбирает пригодные для города тайлы в указанном мире (вода/горы/соседи отсекаются). */
async function pickFreeTiles(worldId, limit = 12) {
  const res = await fetch(`${base}/api/world/${worldId}`);
  const data = await res.json();
  const bytes = Uint8Array.from(Buffer.from(data.map, 'base64'));
  const taken = new Set(data.occupied.map(([x, y]) => `${x}:${y}`));
  const found = [];
  for (let r = 0; r < 2; r++) {
    for (let y = 6; y < data.size - 6; y += 2) {
      for (let x = 6; x < data.size - 6; x += 2) {
        const code = bytes[y * data.size + x];
        if (code === 3 || code === 4) continue;
        let blocked = false;
        for (let dy = -1; dy <= 1 && !blocked; dy++)
          for (let dx = -1; dx <= 1 && !blocked; dx++)
            if (taken.has(`${x + dx}:${y + dy}`)) blocked = true;
        if (!blocked) {
          found.push({ x, y });
          if (found.length >= limit) return found;
        }
      }
    }
  }
  return found.length ? found : [{ x: Math.floor(data.size / 2), y: Math.floor(data.size / 2) }];
}

/* ── 1. Вход, основание города, карта, город, войско ── */
const only = process.env.PHASE;
if (!only) rmSync(profile, { recursive: true, force: true });

if (!only || only === '1') await withBrowser(async (browser) => {
  const page = await open(browser);
  await screen(page, '01-вход');

  const nick = `Воевода${Math.floor(Math.random() * 90 + 10)}`;
  await page.type('#auth input.text', nick);
  await page.click('#auth .house:nth-child(2)');
  await page.click('#auth button.primary');
  await wait(3500);
  await screen(page, '02-выбор-места');

  // ставим город в центр экрана
  await page.touchscreen.tap(VW / 2, VH / 2);
  await wait(600);
  await screen(page, '03-место-выбрано');
  const chips = await page.$$('#banner .chip');
  for (const chip of chips) {
    const text = await chip.evaluate((el) => el.textContent);
    if (text === 'Основать') {
      await chip.click();
      break;
    }
  }
  await wait(4000);
  await screen(page, '04-карта');

  // приближаем карту
  const zoomBtns = await page.$$('.map-btn');
  await zoomBtns[0].click();
  await wait(400);
  await zoomBtns[0].click();
  await wait(800);
  await screen(page, '05-карта-приближено');

  await page.click('#tab-city');
  await wait(1000);
  await screen(page, '06-город');

  await page.click('#tab-army');
  await wait(1000);
  await screen(page, '07-войско');

  await page.click('#tab-rating');
  await wait(2000);
  await screen(page, '08-рейтинг');
  await page.click('.panel-head .close-btn');
  await wait(500);
});

/* ── 2. Лагерь: шторка и композер марша ── */
const db = new DatabaseSync(dbPath);
const me = db
  .prepare("SELECT * FROM players WHERE is_bot = 0 AND x >= 0 ORDER BY created_at DESC LIMIT 1")
  .get();

if (me && (!only || only === '2')) {
  await withBrowser(async (browser) => {
    const page = await open(browser);
    await wait(2500);
    const camps = db
      .prepare(
        `SELECT * FROM entities WHERE kind = 'camp' AND world_id = ? AND level <= 3
         ORDER BY (x - ?) * (x - ?) + (y - ?) * (y - ?) LIMIT 1`,
      )
      .all(me.world_id, me.x, me.x, me.y, me.y);
    const camp = camps[0];
    if (!camp) {
      console.log('  ! лагерь рядом не найден');
      return;
    }
    await aimAt(page, camp.x, camp.y);
    await wait(700);
    const pos = await tileToScreen(page, camp.x + 0.5, camp.y + 0.5);
    console.log(`  · лагерь (${camp.x}, ${camp.y}) → экран (${Math.round(pos.x)}, ${Math.round(pos.y)})`);
    await page.touchscreen.tap(pos.x, pos.y);
    await wait(900);
    await screen(page, '09-лагерь-шторка');

    const sheetChips = await page.$$('#sheet .chip');
    for (const chip of sheetChips) {
      const text = await chip.evaluate((el) => el.textContent ?? '');
      if (text.includes('Атаковать')) {
        await chip.click();
        break;
      }
    }
    await wait(900);
    await screen(page, '10-композер-марша');
  });
}

/* ── 3. KvK: выдаём ратушу 5 и войско, переселяемся через UI ── */
if (me && (!only || only === '3')) {
  db.prepare("UPDATE buildings SET level = 5 WHERE player_id = ? AND key = 'town_hall'").run(me.id);
  db.prepare('UPDATE troops SET cavalry = 400, infantry = 400 WHERE player_id = ?').run(me.id);

  await withBrowser(async (browser) => {
    const page = await open(browser);
    await wait(2500);
    await page.click('#tab-menu');
    await wait(1200);
    await screen(page, '11-меню-переселение');

    // в меню строк несколько: нужен именно Пылающий предел
    const started = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('#panel .kv-row')];
      const row = rows.find((r) => (r.textContent ?? '').includes('Пылающий'));
      if (!row) return 'нет строки';
      const btn = row.querySelector('button');
      if (!btn) return 'нет кнопки';
      if ((btn.textContent ?? '').trim() === 'ты здесь') return 'уже там';
      if ((btn.textContent ?? '').trim() !== 'выбрать') return `кнопка: ${btn.textContent}`;
      btn.click();
      return 'ok';
    });
    console.log('  · переселение:', started);

    if (started === 'ok') {
      await wait(2500);
      await screen(page, '12-выбор-места-в-KvK');
      // перебираем заведомо пригодные тайлы, пока сервер не примет переселение
      const spots = await pickFreeTiles(3);
      for (const spot of spots) {
        await page.evaluate((t) => {
          const st = globalThis.__ashfall;
          if (!st.placing) return;
          st.camera.x = t.x;
          st.camera.y = t.y;
          st.camera.zoom = 1;
        }, spot);
        await wait(500);
        await page.touchscreen.tap(VW / 2, VH / 2);
        await wait(700);
        const bannerChips = await page.$$('#banner .chip');
        for (const chip of bannerChips) {
          const text = await chip.evaluate((el) => el.textContent);
          if (text === 'Переселить') {
            await chip.click();
            break;
          }
        }
        await wait(2500);
        const nowWorld = await page.evaluate(() => globalThis.__ashfall?.snapshot?.player?.worldId);
        console.log(`  · тайл (${spot.x}, ${spot.y}) → мир ${nowWorld}`);
        if (nowWorld === 3) break;
      }
    }
    // панель меню закрываем: дальше нужна карта
    await page.evaluate(() => document.querySelector('.panel-head .close-btn')?.click());
    await wait(900);
    await screen(page, '13-KvK-карта');

    // захватываем ближайший жар-колодец: координаты берём из самого клиента
    const target = await page.evaluate(() => {
      const s = globalThis.__ashfall;
      const p = s.snapshot.player;
      const wells = s.snapshot.entities
        .filter((e) => e.kind === 'well' && e.ownerId !== p.id)
        .map((e) => ({ id: e.id, x: e.x, y: e.y, d: (e.x - p.x) ** 2 + (e.y - p.y) ** 2 }))
        .sort((a, b) => a.d - b.d);
      return wells[0] ?? null;
    });
    if (target) {
      const cam = await aimAt(page, target.x, target.y);
      console.log(`  · колодец (${target.x}, ${target.y}), камера`, cam && { x: Math.round(cam.x), y: Math.round(cam.y), zoom: Number(cam.zoom.toFixed(2)) });
      await wait(800);
      const pos = await tileToScreen(page, target.x + 0.5, target.y + 0.5);
      await page.touchscreen.tap(pos.x, pos.y);
      await wait(1000);
      const picked = await page.evaluate(() => globalThis.__ashfall?.selectedEntityId);
      console.log('  · выбран объект:', picked === target.id ? 'колодец' : picked);
      await screen(page, '14-KvK-колодец');

      const opened = await page.evaluate(() => {
        const chip = [...document.querySelectorAll('#sheet .chip')].find((c) =>
          (c.textContent ?? '').includes('Захватить'),
        );
        if (!chip) return false;
        chip.click();
        return true;
      });
      console.log('  · композер открыт:', opened);
      await wait(900);

      for (let i = 0; i < 8; i++) {
        await page.evaluate(() => {
          const plus = [...document.querySelectorAll('#sheet .chip')].filter((c) => c.textContent === '+');
          plus[2]?.click();
        });
        await wait(140);
      }
      await wait(400);
      await screen(page, '15-KvK-марш');
      await page.evaluate(() => document.querySelector('#sheet button.primary')?.click());
      await wait(3000);
      const sent = await page.evaluate(() => globalThis.__ashfall?.snapshot?.player?.marches?.length ?? 0);
      console.log('  · маршей в пути:', sent);
      await screen(page, '16-KvK-марш-в-пути');
      await wait(30_000);
      await page.click('#tab-reports');
      await wait(1500);
      await screen(page, '17-KvK-отчёт');
      await page.click('.panel-head .close-btn');
      await wait(500);
      await screen(page, '18-KvK-карта-после-боя');
    }
  });
}

console.log('готово');
