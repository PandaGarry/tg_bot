/**
 * Смоук-тест игрового цикла через WebSocket: регистрация → основание города →
 * постройка → обучение войска → марш на лагерь → бой → отчёт.
 *
 *   node scripts/smoke.mjs [wsUrl]
 */
import WebSocket from 'ws';

const url = process.argv[2] ?? 'ws://127.0.0.1:8787/ws';
const ws = new WebSocket(url);
const state = { snapshot: null, waiters: [], id: 1, log: [] };

function send(msg) {
  ws.send(JSON.stringify(msg));
}

function cmd(command) {
  const id = state.id++;
  send({ t: 'cmd', id, cmd: command });
  return new Promise((resolve, reject) => {
    state.waiters.push({ id, resolve, reject });
    setTimeout(() => reject(new Error(`timeout: ${command.op}`)), 30_000);
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (msg) => console.log(`  ✓ ${msg}`);
const fail = (msg) => {
  console.error(`  ✗ ${msg}`);
  process.exitCode = 1;
};

ws.on('message', (raw) => {
  const msg = JSON.parse(String(raw));
  if (msg.t === 'snapshot') state.snapshot = msg.snapshot;
  if (msg.t === 'patch') {
    state.snapshot = {
      ...state.snapshot,
      now: msg.patch.now,
      player: msg.patch.player ?? state.snapshot?.player ?? null,
      reports: msg.patch.reports ?? state.snapshot?.reports ?? [],
    };
  }
  if (msg.t === 'res') {
    const idx = state.waiters.findIndex((w) => w.id === msg.id);
    if (idx >= 0) {
      const w = state.waiters[idx];
      state.waiters.splice(idx, 1);
      msg.ok ? w.resolve(msg) : w.reject(new Error(msg.error ?? 'команда отклонена'));
    }
  }
  if (msg.t === 'patch' && msg.patch.toasts) {
    for (const t of msg.patch.toasts) state.log.push(t.text);
  }
});

ws.on('open', async () => {
  try {
    await sleep(300);
    const nick = `Смоук-${Math.floor(Math.random() * 9999)}`;
    send({ t: 'auth', token: null });
    await sleep(300);
    console.log(`▶ регистрация «${nick}»`);
    await cmd({ op: 'register', nick, house: 'clans' });
    await sleep(500);
    const snap = state.snapshot;
    if (!snap) throw new Error('нет снапшота');
    ok(`мир «${snap.world.name}», сущностей: ${snap.entities.length}`);

    // ищем свободный тайл под город
    const bytes = Buffer.from(snap.map, 'base64');
    const size = snap.world.size;
    const taken = new Set(snap.entities.map((e) => `${e.x}:${e.y}`));
    let spot = null;
    for (let y = 6; y < size - 6 && !spot; y++) {
      for (let x = 6; x < size - 6 && !spot; x++) {
        const code = bytes[y * size + x];
        if (code === 3 || code === 4) continue;
        let free = true;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++)
            if (taken.has(`${x + dx}:${y + dy}`)) free = false;
        if (free) spot = { x, y };
      }
    }
    if (!spot) throw new Error('нет свободного тайла');
    console.log('▶ основание города');
    await cmd({ op: 'foundCity', x: spot.x, y: spot.y });
    await sleep(600);
    ok(`город основан в (${spot.x}, ${spot.y})`);

    const player = () => state.snapshot.player;
    if (player().x !== spot.x) throw new Error('город не появился в снапшоте');

    console.log('▶ улучшение склада');
    await cmd({ op: 'upgrade', building: 'warehouse' });
    await sleep(1600);
    const wh = player().buildings.find((b) => b.key === 'warehouse');
    if (!wh.upgradingTo) throw new Error('улучшение не началось');
    ok(`склад → ур. ${wh.upgradingTo} (ETA ${Math.round((wh.finishAt - Date.now()) / 1000)} с)`);

    console.log('▶ обучение 50 щитоносцев');
    await cmd({ op: 'train', unit: 'infantry', count: 50 });
    await sleep(1600);
    if (player().training.length === 0) throw new Error('очередь пуста');
    const eta = Math.round((player().training[0].finishAt - Date.now()) / 1000);
    ok(`в очереди ${player().training[0].count}, готово через ${eta} с`);
    await sleep(Math.min(eta * 1000 + 3000, 120_000));
    if (player().troops.infantry < 50) {
      throw new Error(`войско не обучено: ${player().troops.infantry}`);
    }
    ok(`обучено: ${player().troops.infantry} щитоносцев`);

    console.log('▶ марш на ближайший лагерь');
    const camps = state.snapshot.entities
      .filter((e) => e.kind === 'camp' && e.level <= 2)
      .map((e) => ({ e, d: (e.x - spot.x) ** 2 + (e.y - spot.y) ** 2 }))
      .sort((a, b) => a.d - b.d);
    const camp = camps[0]?.e;
    if (!camp) throw new Error('нет лагерей');
    await cmd({
      op: 'march',
      kind: 'attack',
      targetId: camp.id,
      troops: { infantry: 50, archers: 0, cavalry: 0 },
    });
    await sleep(1600);
    if (player().marches.length === 0) throw new Error('марш не создан');
    ok(`марш вышел, ETA ${Math.round((player().marches[0].arriveAt - Date.now()) / 1000)} с`);

    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline && player().marches.length > 0) await sleep(1000);
    if (player().marches.length > 0) throw new Error('марш не вернулся');
    ok('марш вернулся домой');

    const reports = await new Promise((resolve) => {
      const handler = setInterval(() => {
        const battle = (state.snapshot.reports ?? []).find((r) => r.type === 'battle');
        if (battle) {
          clearInterval(handler);
          resolve(battle);
        }
      }, 500);
      setTimeout(() => {
        clearInterval(handler);
        resolve(null);
      }, 10_000);
    });
    console.log('  · события:', state.log.slice(-4).join(' | '));
    if (!reports) throw new Error('нет боевого отчёта');
    ok(`бой: «${reports.title}», победил атакующий: ${reports.data.winner}`);
    console.log('\nСмоук-тест пройден.');
    ws.close();
    process.exit(process.exitCode ?? 0);
  } catch (err) {
    fail(err.message);
    console.error(err);
    ws.close();
    process.exit(1);
  }
});

ws.on('error', (err) => {
  console.error('WS ошибка:', err.message);
  process.exit(1);
});
