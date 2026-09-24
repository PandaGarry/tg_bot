/**
 * Проверка KvK-контура: переселение в Пылающий предел, захват жар-колодца,
 * начисление Жара. Требует запущенного сервера.
 *
 *   node scripts/kvk-smoke.mjs
 */
import { DatabaseSync } from 'node:sqlite';
import { existsSync, readdirSync } from 'node:fs';
import WebSocket from 'ws';

const BASE = process.env.ASHFALL_URL ?? 'http://127.0.0.1:8787';
const DB_PATH = process.env.ASHFALL_DB ?? 'data/ashfall.db';

if (!existsSync(DB_PATH)) {
  console.error(`нет базы ${DB_PATH} (сначала запусти сервер)`);
  process.exit(1);
}
const db = new DatabaseSync(DB_PATH);

const ws = new WebSocket(`${BASE.replace('http', 'ws')}/ws`);
const st = { snapshot: null, id: 1, waiters: [] };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m) => {
  failures++;
  console.error(`  ✗ ${m}`);
};
const assert = (c, m) => (c ? ok(m) : bad(m));

function cmd(command) {
  const id = st.id++;
  ws.send(JSON.stringify({ t: 'cmd', id, cmd: command }));
  return new Promise((resolve, reject) => {
    st.waiters.push({ id, resolve, reject });
    setTimeout(() => reject(new Error(`timeout ${command.op}`)), 30_000);
  });
}

ws.on('message', (raw) => {
  const msg = JSON.parse(String(raw));
  if (msg.t === 'snapshot') st.snapshot = msg.snapshot;
  if (msg.t === 'patch') {
    if (msg.patch.player) st.snapshot = { ...st.snapshot, player: msg.patch.player };
    if (msg.patch.reports) st.snapshot = { ...st.snapshot, reports: msg.patch.reports };
    if (msg.patch.leaders) st.snapshot = { ...st.snapshot, leaders: msg.patch.leaders };
  }
  if (msg.t === 'res') {
    const i = st.waiters.findIndex((w) => w.id === msg.id);
    if (i >= 0) {
      const w = st.waiters[i];
      st.waiters.splice(i, 1);
      msg.ok ? w.resolve() : w.reject(new Error(msg.error));
    }
  }
});

function freeSpot(size, occupied) {
  const taken = new Set(occupied.map(([x, y]) => `${x}:${y}`));
  for (let y = 8; y < size - 8; y += 2) {
    for (let x = 8; x < size - 8; x += 2) {
      let blocked = false;
      for (let dy = -1; dy <= 1 && !blocked; dy++)
        for (let dx = -1; dx <= 1 && !blocked; dx++)
          if (taken.has(`${x + dx}:${y + dy}`)) blocked = true;
      if (!blocked) return { x, y };
    }
  }
  return null;
}

ws.on('open', async () => {
  try {
    const nick = `КвК-${Math.floor(Math.random() * 900 + 100)}`;
    await sleep(200);
    await cmd({ op: 'register', nick, house: 'order' });
    await sleep(600);
    const world = st.snapshot.world;
    const spot = freeSpot(
      world.size,
      st.snapshot.entities.map((e) => [e.x, e.y]),
    );
    await cmd({ op: 'foundCity', x: spot.x, y: spot.y });
    await sleep(800);
    ok(`город основан в ${world.name} (${spot.x}, ${spot.y})`);

    // готовим игрока к KvK напрямую в базе (тест инфраструктуры, а не экономики)
    const playerId = st.snapshot.player.id;
    db.prepare("UPDATE buildings SET level = 5 WHERE player_id = ? AND key = 'town_hall'").run(playerId);
    db.prepare('UPDATE troops SET cavalry = 900 WHERE player_id = ?').run(playerId);
    ok('ратуша 5 и 900 всадников выданы для теста');

    const preview = await (await fetch(`${BASE}/api/world/3`)).json();
    assert(preview.map.length > 1000, `карта Пылающего предела получена (${preview.occupied.length} занятых тайлов)`);
    const kvkSpot = freeSpot(preview.size, preview.occupied);
    await cmd({ op: 'migrate', worldId: 3, x: kvkSpot.x, y: kvkSpot.y });
    await sleep(1200);
    assert(st.snapshot.player.worldId === 3, 'город переселён в Пылающий предел');

    const wells = st.snapshot.entities.filter((e) => e.kind === 'well');
    assert(wells.length > 0, `жар-колодцы на карте: ${wells.length}`);
    const me = st.snapshot.player;
    const well = wells
      .map((e) => ({ e, d: (e.x - me.x) ** 2 + (e.y - me.y) ** 2 }))
      .sort((a, b) => a.d - b.d)[0].e;

    await cmd({
      op: 'march',
      kind: 'attack',
      targetId: well.id,
      troops: { infantry: 0, archers: 0, cavalry: 900 },
    });
    await sleep(1000);
    assert(st.snapshot.player.marches.length === 1, 'марш на колодец отправлен');

    const deadline = Date.now() + 180_000;
    while (Date.now() < deadline && st.snapshot.player.marches.length > 0) await sleep(1000);
    assert(st.snapshot.player.marches.length === 0, 'марш завершён');

    const kvkReport = (st.snapshot.reports ?? []).find((r) => r.type === 'kvk' || r.title.includes('колодец'));
    assert(!!kvkReport, 'отчёт о колодце получен');

    await sleep(12_000);
    const ember = st.snapshot.player.resources?.ember ?? st.snapshot.player.kvkEmber;
    assert(ember > 0, `жар капает: ${Number(ember).toFixed(1)} 🔥`);

    // игрок появляется в KvK-рейтинге
    const leaders = await new Promise((resolve) => {
      const handler = setInterval(() => {
        if (st.snapshot.leaders?.length) {
          clearInterval(handler);
          resolve(st.snapshot.leaders);
        }
      }, 500);
      setTimeout(() => { clearInterval(handler); resolve([]); }, 10_000);
    });
    assert(leaders.some((l) => l.id === playerId), 'игрок виден в рейтинге KvK');

    console.log(failures === 0 ? '\nKvK-смоук пройден.' : `\nKvK-смоук: ошибок ${failures}`);
    ws.close();
    process.exit(failures === 0 ? 0 : 1);
  } catch (err) {
    bad(err.message);
    ws.close();
    process.exit(1);
  }
});

void readdirSync;
