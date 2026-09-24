/**
 * Проверка клиента без браузера: поднимаем DOM через jsdom, подменяем canvas и
 * WebSocket (настоящий, до реального сервера) и проходим основной сценарий игрока:
 * вход → выбор места → город → панели → обучение → марш → бой.
 *
 *   npx tsx scripts/ui-smoke.ts
 */
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import WS from 'ws';

const BASE = process.env.ASHFALL_URL ?? 'http://127.0.0.1:8787';
const html = readFileSync(new URL('../apps/client/index.html', import.meta.url), 'utf8');

const dom = new JSDOM(html, { url: `${BASE}/`, pretendToBeVisual: true });
const { window } = dom;

/* ── окружение ── */
const anyGlobal = globalThis as unknown as Record<string, unknown>;
const define = (key: string, value: unknown) =>
  Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
define('window', window);
define('document', window.document);
define('navigator', window.navigator);
define('location', window.location);
define('localStorage', window.localStorage);
define('HTMLElement', window.HTMLElement);
define('HTMLInputElement', window.HTMLInputElement);
define('HTMLCanvasElement', window.HTMLCanvasElement);
define('Node', window.Node);
define('Event', window.Event);
define('MouseEvent', window.MouseEvent);
define('getComputedStyle', window.getComputedStyle.bind(window));
define('requestAnimationFrame', (cb: FrameRequestCallback) => window.setTimeout(() => cb(Date.now()), 32));
define('cancelAnimationFrame', (id: number) => window.clearTimeout(id));
define('fetch', (input: string, init?: RequestInit) =>
  fetch(typeof input === 'string' && input.startsWith('/') ? `${BASE}${input}` : input, init),
);

// canvas: заглушка контекста + размеры экрана телефона
const ctxStub = new Proxy(
  {
    canvas: null,
    setTransform: () => {},
    measureText: () => ({ width: 10 }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  } as Record<string, unknown>,
  {
    get(target, prop) {
      if (prop in target) return target[prop as string];
      return () => undefined;
    },
    set(target, prop, value) {
      target[prop as string] = value;
      return true;
    },
  },
);
window.HTMLCanvasElement.prototype.getContext = (() => ctxStub) as never;
(window.HTMLCanvasElement.prototype as unknown as Record<string, unknown>).setPointerCapture = () => {};
Object.defineProperty(window.HTMLCanvasElement.prototype, 'clientWidth', { value: 390 });
Object.defineProperty(window.HTMLCanvasElement.prototype, 'clientHeight', { value: 780 });

// WebSocket: мост на библиотеку ws
class NodeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  readyState = 0;
  onopen: ((ev: unknown) => void) | null = null;
  onclose: ((ev: unknown) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  private socket: WS;

  constructor(url: string) {
    this.socket = new WS(url.replace('ws://127.0.0.1', 'ws://127.0.0.1'));
    this.socket.on('open', () => {
      this.readyState = 1;
      this.onopen?.({});
    });
    this.socket.on('message', (data: WS.RawData) => {
      this.onmessage?.({ data: data.toString() });
    });
    this.socket.on('close', () => {
      this.readyState = 3;
      this.onclose?.({});
    });
    this.socket.on('error', (err: Error) => this.onerror?.(err));
  }

  send(data: string): void {
    this.socket.send(data);
  }
  close(): void {
    this.socket.close();
  }
}
define('WebSocket', NodeWebSocket);

/* ── утилиты теста ── */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const $ = (sel: string) => window.document.querySelector(sel) as HTMLElement | null;
const $$ = (sel: string) => [...window.document.querySelectorAll(sel)] as HTMLElement[];
let failures = 0;
const ok = (msg: string) => console.log(`  ✓ ${msg}`);
const bad = (msg: string) => {
  failures++;
  console.error(`  ✗ ${msg}`);
};
const assert = (cond: unknown, msg: string) => (cond ? ok(msg) : bad(msg));

async function waitFor(fn: () => boolean, timeoutMs = 20_000, label = 'условие'): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (fn()) return true;
    await sleep(120);
  }
  bad(`не дождались: ${label}`);
  return false;
}

function tap(el: HTMLElement, x = 5, y = 5): void {
  for (const type of ['pointerdown', 'pointerup']) {
    const ev = new window.MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
    Object.defineProperty(ev, 'pointerId', { value: 1 });
    el.dispatchEvent(ev);
  }
}

function click(el: HTMLElement | null): void {
  el?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
}

/** Координаты тайла на экране — та же формула, что в рендерере карты. */
function tileToScreen(tileX: number, tileY: number): { x: number; y: number } {
  const state = (window as unknown as { __state?: { camera: { x: number; y: number; zoom: number } } }).__state;
  const cam = state?.camera ?? { x: 0, y: 0, zoom: 1 };
  const ts = Math.max(18, Math.min(390, 780) / 22) * cam.zoom;
  return { x: (tileX - cam.x) * ts + 195, y: (tileY - cam.y) * ts + 390 };
}

async function main(): Promise<void> {
  process.on('uncaughtException', (err) => console.error('[uncaught]', err));
  process.on('unhandledRejection', (err) => console.error('[unhandled]', err));
  window.addEventListener('error', (ev) => console.error('[window error]', (ev as ErrorEvent).message));
  console.log('▶ загрузка клиента');
  const mod = await import('../apps/client/src/main');
  void mod;
  const state = (await import('../apps/client/src/store')).state;
  (window as unknown as { __state?: unknown }).__state = state;

  await waitFor(() => !!$('.game-title'), 8000, 'экран входа');
  assert($('.game-title')?.textContent === 'ЭШФОЛЛ', 'заголовок игры на месте');
  assert($$('.house').length === 3, 'три дома на выбор');

  const nick = `Жар-${Math.floor(Math.random() * 900 + 100)}`;
  const input = $('#auth input.text') as HTMLInputElement;
  input.value = nick;
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  click($$('.house')[2]);
  click($$('#auth button.primary')[0]);
  ok(`входим как «${nick}»`);

  await sleep(1500);
  console.log('  · кнопка входа:', $$('#auth button.primary')[0]?.textContent);
  await waitFor(() => state.snapshot !== null, 20_000, 'снапшот');
  assert(!$('#tabs')?.classList.contains('hidden'), 'нижние табы появились');
  assert(($('#hud')?.textContent ?? '').includes(nick), 'HUD показывает правителя');
  assert($$('.res').length === 5, 'пять ресурсов в HUD');

  // ── выбор места под город
  assert(state.placing !== null, 'режим выбора места активен');
  const placingMap = state.placing!;
  const bytes = Buffer.from(placingMap.map, 'base64');
  let spot = { x: 0, y: 0 };
  outer: for (let y = 8; y < placingMap.size - 8; y += 2) {
    for (let x = 8; x < placingMap.size - 8; x += 2) {
      const code = bytes[y * placingMap.size + x];
      if (code === 3 || code === 4) continue;
      let blocked = false;
      for (let dy = -1; dy <= 1 && !blocked; dy++) {
        for (let dx = -1; dx <= 1 && !blocked; dx++) {
          if (placingMap.occupied.has(`${x + dx}:${y + dy}`)) blocked = true;
        }
      }
      if (blocked) continue;
      spot = { x, y };
      break outer;
    }
  }
  state.camera.x = spot.x;
  state.camera.y = spot.y;
  const canvas = $('#map')!;
  tap(canvas, 195, 390);
  await sleep(200);
  assert(state.placing?.selected !== null, 'тайл выбран касанием карты');
  const banner = $('#banner');
  assert(!!banner && !banner.classList.contains('hidden'), 'баннер размещения показан');

  const foundBtn = $$('#banner .chip').find((b) => b.textContent === 'Основать');
  assert(!!foundBtn, 'кнопка «Основать» в баннере');
  click(foundBtn ?? null);

  await waitFor(() => (state.snapshot?.player.x ?? -1) >= 0, 20_000, 'город основан');
  assert(state.placing === null, 'режим размещения завершён');
  ok(`город в (${state.snapshot!.player.x}, ${state.snapshot!.player.y})`);

  // ── панель города
  click($('#tab-city'));
  await sleep(300);
  assert($$('.build').length === 9, '9 зданий в городе');
  const upgradeBtn = $$('.build button')[2] as HTMLButtonElement;
  assert(upgradeBtn.textContent === 'Улучшить', 'кнопка улучшения доступна');
  click(upgradeBtn);
  await sleep(1200);
  assert(
    ($$('.build')[2]?.textContent ?? '').includes('строится'),
    'улучшение запустилось (пошёл таймер)',
  );
  click($$('.panel-head .close-btn')[0]);

  // ── войско: обучение 5 всадников
  click($('#tab-army'));
  await sleep(300);
  assert($$('.unit-row').length === 3, 'три типа войск');
  click($$('#panel .chip')[2]); // всадники
  await sleep(200);
  const countInput = $('#panel input.text') as HTMLInputElement;
  countInput.value = '5';
  countInput.dispatchEvent(new window.Event('input', { bubbles: true }));
  await sleep(200);
  const trainBtn = $$('#panel button.primary')[0] as HTMLButtonElement;
  click(trainBtn);
  await sleep(1200);
  assert(state.snapshot!.player.training.length > 0, 'обучение встало в очередь');

  await waitFor(() => state.snapshot!.player.troops.cavalry >= 5, 60_000, 'войско обучено');
  ok(`обучено всадников: ${state.snapshot!.player.troops.cavalry}`);

  // ── марш на лагерь
  const p = state.snapshot!.player;
  const camps = state.snapshot!.entities
    .filter((e: { kind: string; level: number }) => e.kind === 'camp' && e.level <= 2)
    .map((e: { x: number; y: number; id: string }) => ({
      e,
      d: (e.x - p.x) ** 2 + (e.y - p.y) ** 2,
    }))
    .sort((a: { d: number }, b: { d: number }) => a.d - b.d);
  const camp = camps[0]?.e as { x: number; y: number; id: string } | undefined;
  assert(!!camp, 'лагерь найден');
  if (camp) {
    state.camera.x = (p.x + camp.x) / 2;
    state.camera.y = (p.y + camp.y) / 2;
    state.camera.zoom = 1;
    const pos = tileToScreen(camp.x + 0.5, camp.y + 0.5);
    tap(canvas, pos.x, pos.y);
    await sleep(300);
    assert(state.selectedEntityId === camp.id, 'лагерь выбран касанием');
    const attackChip = $$('#sheet .chip').find((b) => b.textContent?.includes('Атаковать'));
    assert(!!attackChip, 'кнопка атаки в шторке');
    click(attackChip ?? null);
    await sleep(300);
    const sendBtn = $$('#sheet button.primary')[0] as HTMLButtonElement | undefined;
    assert(!!sendBtn, 'композер марша открыт');
    if (sendBtn) {
      // добавляем всех всадников
      const plus = $$('#sheet .chip').filter((b) => b.textContent === '+');
      click(plus[2] ?? null);
      await sleep(150);
      click($$('#sheet button.primary')[0]);
      await sleep(1500);
      assert(state.snapshot!.player.marches.length > 0, 'марш отправлен');
      const returned = await waitFor(
        () => state.snapshot!.player.marches.length === 0,
        120_000,
        'марш вернулся',
      );
      if (returned) {
        await sleep(1500);
        const battle = state.snapshot!.reports.find((r: { type: string }) => r.type === 'battle');
        assert(!!battle, 'боевой отчёт получен');
      }
    }
  }

  // ── рейтинг и меню
  click($('#tab-rating'));
  await sleep(1500);
  assert($$('#panel .leader').length > 0, 'рейтинг заполнен');
  click($('#tab-menu'));
  await sleep(400);
  assert(($('#panel')?.textContent ?? '').includes('Переселение'), 'меню с переселением');
  click($('#tab-reports'));
  await sleep(600);
  assert($$('#panel .report').length > 0, 'отчёты отображаются');

  console.log(failures === 0 ? '\nUI-смоук пройден.' : `\nUI-смоук: ошибок ${failures}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
