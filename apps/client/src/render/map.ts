import type { EntityView } from '@ashfall/shared';
import { fmt, fmtDuration, player, resourcesAt, serverNow, state } from '../store';
import {
  TEX,
  campSprite,
  citySprite,
  getTerrainAtlas,
  invalidateAtlas,
  nodeSprite,
  wellSprite,
} from './tiles';

export const mapEvents = {
  onSelectEntity: null as null | ((id: string | null) => void),
  onTileTap: null as null | ((x: number, y: number) => void),
};

let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let dpr = 1;
let width = 0;
let height = 0;
let terrain: Uint8Array | null = null;
let terrainSize = 0;
let terrainKey = '';
let vignette: CanvasGradient | null = null;

const pointers = new Map<number, { x: number; y: number }>();
let dragStart: { x: number; y: number; time: number } | null = null;
let dragged = false;
let pinchStart: { dist: number; zoom: number } | null = null;

export function initMap(el: HTMLCanvasElement): void {
  canvas = el;
  ctx = canvas.getContext('2d', { alpha: false })!;
  resize();
  window.addEventListener('resize', resize);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

function resize(): void {
  if (!canvas) return;
  dpr = Math.min(2, window.devicePixelRatio || 1);
  width = canvas.clientWidth;
  height = canvas.clientHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  vignette = null;
}

function getVignette(): CanvasGradient {
  if (vignette) return vignette;
  const r = Math.hypot(width, height) / 2;
  const g = ctx.createRadialGradient(width / 2, height / 2, r * 0.45, width / 2, height / 2, r);
  g.addColorStop(0, 'rgba(8,6,5,0)');
  g.addColorStop(1, 'rgba(8,6,5,0.42)');
  vignette = g;
  return g;
}

export function baseTileSize(): number {
  return Math.max(18, Math.min(width, height) / 22);
}

function tileSize(): number {
  return baseTileSize() * state.camera.zoom;
}

export function centerOn(x: number, y: number): void {
  state.camera.x = x;
  state.camera.y = y;
}

export function setZoom(z: number): void {
  state.camera.zoom = Math.max(0.45, Math.min(3.2, z));
}

export function zoomBy(factor: number): void {
  setZoom(state.camera.zoom * factor);
}

function decodeTerrain(key: string, b64: string, size: number): void {
  if (terrainKey === key && terrain) return;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  terrain = bytes;
  terrainSize = size;
  terrainKey = key;
}

export function invalidateTerrain(): void {
  terrainKey = '';
  terrain = null;
  invalidateAtlas();
}

/** KvK-мир определяем по текущему снапшоту или по списку миров (режим переселения). */
function isKvkWorld(worldId: number): boolean {
  const snap = state.snapshot;
  if (!snap) return false;
  if (snap.world.id === worldId) return snap.world.kind === 'kvk';
  const info = snap.worlds.find((w) => w.id === worldId);
  return info?.kind === 'kvk';
}

interface AmbientDot {
  x: number;
  y: number;
  speed: number;
  size: number;
  phase: number;
}

const ambient: AmbientDot[] = Array.from({ length: 26 }, (_, i) => ({
  x: Math.random(),
  y: Math.random(),
  speed: 0.5 + Math.random(),
  size: 1 + Math.random() * 2.2,
  phase: (i * 1.7) % (Math.PI * 2),
}));

function drawAmbient(t: number, kvk: boolean): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const dot of ambient) {
    const drift = t * dot.speed;
    const px = ((dot.x + (kvk ? Math.sin(drift * 0.35) * 0.04 : drift * 0.012)) % 1) * width;
    let py: number;
    if (kvk) {
      // угольки поднимаются
      py = ((dot.y - drift * 0.05) % 1 + 1) % 1;
      ctx.fillStyle = `rgba(255,${140 + Math.round(50 * Math.sin(t * 2 + dot.phase))},70,${0.28 + 0.22 * Math.sin(t * 3 + dot.phase)})`;
    } else {
      // пыльца медленно плывёт
      py = ((dot.y + Math.sin(drift * 0.4 + dot.phase) * 0.03) % 1 + 1) % 1;
      ctx.fillStyle = `rgba(236,227,220,${0.05 + 0.05 * Math.sin(t * 2 + dot.phase)})`;
    }
    ctx.beginPath();
    ctx.arc(px, py * height, dot.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function renderMap(): void {
  const placing = state.placing;
  const snap = state.snapshot;

  let b64: string | null = null;
  let size = 0;
  let worldId = 0;
  if (placing) {
    b64 = placing.map;
    size = placing.size;
    worldId = placing.worldId;
  } else if (snap) {
    b64 = snap.map;
    size = snap.world.size;
    worldId = snap.world.id;
  } else {
    return;
  }
  decodeTerrain(`w${worldId}`, b64, size);
  if (!terrain) return;
  const kvk = isKvkWorld(worldId);
  const atlas = getTerrainAtlas(terrainKey, b64, size, kvk);

  const t = performance.now() / 1000;
  const ts = tileSize();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'low';
  ctx.fillStyle = kvk ? '#141014' : '#131017';
  ctx.fillRect(0, 0, width, height);

  const cam = state.camera;
  const halfW = width / 2 / ts;
  const halfH = height / 2 / ts;
  const x0 = Math.max(0, Math.floor(cam.x - halfW));
  const x1 = Math.min(terrainSize - 1, Math.ceil(cam.x + halfW));
  const y0 = Math.max(0, Math.floor(cam.y - halfH));
  const y1 = Math.min(terrainSize - 1, Math.ceil(cam.y + halfH));

  // ближний зум — полная текстура; дальний — мини-версия (мягче, без зернистости)
  const useMini = ts < TEX * 0.55;
  const src = useMini ? atlas.mini : atlas.full;
  const srcTex = useMini ? TEX / 4 : TEX;
  const sx = x0 * srcTex;
  const sy = y0 * srcTex;
  const sw = (x1 - x0 + 1) * srcTex;
  const sh = (y1 - y0 + 1) * srcTex;
  ctx.imageSmoothingQuality = useMini ? 'high' : 'low';
  ctx.drawImage(
    src,
    sx, sy, sw, sh,
    (x0 - cam.x) * ts + width / 2,
    (y0 - cam.y) * ts + height / 2,
    sw * (ts / srcTex),
    sh * (ts / srcTex),
  );

  // сетка проявляется только при сильном приближении
  if (ts >= 30) {
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = x0; x <= x1 + 1; x++) {
      const px = Math.round((x - cam.x) * ts + width / 2) + 0.5;
      ctx.moveTo(px, 0);
      ctx.lineTo(px, height);
    }
    for (let y = y0; y <= y1 + 1; y++) {
      const py = Math.round((y - cam.y) * ts + height / 2) + 0.5;
      ctx.moveTo(0, py);
      ctx.lineTo(width, py);
    }
    ctx.stroke();
  }

  const toScreen = (x: number, y: number) => ({
    px: (x - cam.x) * ts + width / 2,
    py: (y - cam.y) * ts + height / 2,
  });

  if (placing) {
    drawPlacing(placing, toScreen, ts, t, x0, x1, y0, y1);
    drawAmbient(t, kvk);
    ctx.fillStyle = getVignette();
    ctx.fillRect(0, 0, width, height);
    return;
  }

  if (!snap) return;

  const me = snap.player;
  const visible = snap.entities.filter(
    (e) => e.x >= x0 - 1 && e.x <= x1 + 1 && e.y >= y0 - 1 && e.y <= y1 + 1,
  );

  // марши под объектами
  drawMarches(me.marches, toScreen, ts, t);

  for (const e of visible) {
    drawEntity(e, toScreen(e.x + 0.5, e.y + 0.5), ts, e.id === state.selectedEntityId, t);
  }

  // свой город: мягкое золотое сияние
  if (me.x >= 0) {
    const { px, py } = toScreen(me.x + 0.5, me.y + 0.5);
    const pulse = 1 + Math.sin(t * 2.2) * 0.06;
    const r = ts * 1.05 * pulse;
    const g = ctx.createRadialGradient(px, py, ts * 0.2, px, py, r);
    g.addColorStop(0, 'rgba(232,195,122,0.16)');
    g.addColorStop(1, 'rgba(232,195,122,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(232,195,122,0.55)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(px, py, ts * 0.85 * pulse, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawAmbient(t, kvk);
  ctx.fillStyle = getVignette();
  ctx.fillRect(0, 0, width, height);
}

function drawPlacing(
  placing: NonNullable<typeof state.placing>,
  toScreen: (x: number, y: number) => { px: number; py: number },
  ts: number,
  t: number,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
): void {
  // занятая земля — красноватая штриховка
  ctx.strokeStyle = 'rgba(209,88,79,0.6)';
  ctx.lineWidth = 1.6;
  for (const key of placing.occupied) {
    const [x, y] = key.split(':').map(Number);
    if (x < x0 - 1 || x > x1 + 1 || y < y0 - 1 || y > y1 + 1) continue;
    const { px, py } = toScreen(x, y);
    ctx.fillStyle = 'rgba(209,88,79,0.12)';
    ctx.fillRect(px, py, ts, ts);
    ctx.save();
    ctx.beginPath();
    ctx.rect(px, py, ts, ts);
    ctx.clip();
    ctx.beginPath();
    for (let i = -1; i < 4; i++) {
      const o = i * (ts / 2.4);
      ctx.moveTo(px + o, py + ts);
      ctx.lineTo(px + o + ts, py);
    }
    ctx.stroke();
    ctx.restore();
  }
  if (placing.selected) {
    const { px, py } = toScreen(placing.selected.x, placing.selected.y);
    const pulse = 1 + Math.sin(t * 3.5) * 0.05;
    void pulse;
    ctx.fillStyle = 'rgba(232,195,122,0.18)';
    ctx.fillRect(px, py, ts, ts);
    ctx.strokeStyle = '#e8c37a';
    ctx.lineWidth = 3;
    ctx.strokeRect(px + 1.5, py + 1.5, ts - 3, ts - 3);
  }
}

function drawMarches(
  marches: NonNullable<typeof state.snapshot>['player']['marches'],
  toScreen: (x: number, y: number) => { px: number; py: number },
  ts: number,
  t: number,
): void {
  const now = serverNow();
  for (const m of marches) {
    const from = toScreen(m.fromX + 0.5, m.fromY + 0.5);
    const to = toScreen(m.toX + 0.5, m.toY + 0.5);
    const progress = Math.max(
      0,
      Math.min(1, (now - m.departAt) / Math.max(1, m.arriveAt - m.departAt)),
    );
    const px = from.px + (to.px - from.px) * progress;
    const py = from.py + (to.py - from.py) * progress;
    const outbound = m.phase === 'outbound';
    const col = outbound ? '209,88,79' : '111,191,115';

    // путь: бегущий пунктир + шевроны по ходу движения
    const angle = Math.atan2(to.py - from.py, to.px - from.px);
    ctx.strokeStyle = `rgba(${col},0.5)`;
    ctx.setLineDash([7, 7]);
    ctx.lineDashOffset = -t * 18;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(from.px, from.py);
    ctx.lineTo(to.px, to.py);
    ctx.stroke();
    ctx.setLineDash([]);

    if (ts >= 20) {
      ctx.fillStyle = `rgba(${col},0.75)`;
      for (const cp of [0.3, 0.55, 0.8]) {
        const cx = from.px + (to.px - from.px) * cp;
        const cy = from.py + (to.py - from.py) * cp;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(5, 0);
        ctx.lineTo(-2, -3.6);
        ctx.lineTo(-2, 3.6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    // значок войска
    const rr = Math.max(6, ts * 0.30);
    const bob = Math.sin(t * 6) * 1.2;
    ctx.fillStyle = 'rgba(10,8,7,0.35)';
    ctx.beginPath();
    ctx.ellipse(px, py + rr * 0.9, rr * 0.9, rr * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = outbound ? '#d1584f' : '#6fbf73';
    ctx.beginPath();
    ctx.arc(px, py + bob, rr * 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1a1512';
    ctx.lineWidth = 2;
    ctx.stroke();
    // вымпел
    ctx.strokeStyle = '#241d18';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(px, py + bob - rr * 0.5);
    ctx.lineTo(px, py + bob - rr * 1.15);
    ctx.stroke();
    ctx.fillStyle = outbound ? '#ffb199' : '#c4efc6';
    ctx.beginPath();
    ctx.moveTo(px, py + bob - rr * 1.15);
    ctx.lineTo(px + rr * 0.75, py + bob - rr * 0.95);
    ctx.lineTo(px, py + bob - rr * 0.75);
    ctx.closePath();
    ctx.fill();

    // ETA
    if (ts >= 22) {
      const left = Math.max(0, (m.arriveAt - now) / 1000);
      const label = fmtDuration(left);
      ctx.font = '600 11px -apple-system, "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const tw = ctx.measureText(label).width;
      const bx = px, by = py + bob - rr * 1.55;
      ctx.fillStyle = 'rgba(18,16,15,0.82)';
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') ctx.roundRect(bx - tw / 2 - 7, by - 9, tw + 14, 18, 9);
      else ctx.rect(bx - tw / 2 - 7, by - 9, tw + 14, 18);
      ctx.fill();
      ctx.strokeStyle = `rgba(${col},0.6)`;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#ece3dc';
      ctx.fillText(label, bx, by + 0.5);
    }
  }
}

function drawEntity(
  e: EntityView,
  pos: { px: number; py: number },
  ts: number,
  selected: boolean,
  t: number,
): void {
  const me = state.snapshot?.player;
  const isMine = me ? e.ownerId === me.id : false;
  const box = Math.max(ts * 1.15, 20);
  const x = pos.px - box / 2;
  const y = pos.py - box / 2 - box * 0.1;

  let sprite: HTMLCanvasElement | null = null;
  if (e.kind === 'city') sprite = citySprite(isMine);
  else if (e.kind === 'camp') sprite = campSprite();
  else if (e.kind === 'node') sprite = nodeSprite(e.resource ?? 'food');
  else if (e.kind === 'well') sprite = wellSprite(isMine);

  if (e.kind === 'well') {
    // живое пламя колодца: дышит сам по себе
    const pulse = 1 + Math.sin(t * 3 + e.x * 0.7) * 0.07;
    const g = ctx.createRadialGradient(pos.px, pos.py, 2, pos.px, pos.py, box * 0.6 * pulse);
    g.addColorStop(0, 'rgba(255,140,64,0.30)');
    g.addColorStop(1, 'rgba(255,120,50,0)');
    ctx.fillStyle = g;
    ctx.fillRect(pos.px - box, pos.py - box, box * 2, box * 2);
  }

  if (sprite) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(sprite, x, y, box, box);
  }

  // уровни на объектах
  if ((e.kind === 'city' || e.kind === 'camp') && ts >= 24) {
    const label = String(e.level);
    ctx.font = `700 ${Math.max(9, Math.round(ts * 0.3))}px -apple-system, "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const bx = pos.px + box * 0.32;
    const by = pos.py + box * 0.18;
    const bw = ctx.measureText(label).width + 8;
    const bh = Math.max(13, ts * 0.4);
    ctx.fillStyle = 'rgba(18,16,15,0.85)';
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') ctx.roundRect(bx - bw / 2, by - bh / 2, bw, bh, bh / 2);
    else ctx.rect(bx - bw / 2, by - bh / 2, bw, bh);
    ctx.fill();
    ctx.strokeStyle = e.kind === 'city' ? (isMine ? '#e8c37a' : '#9aa7b8') : '#d1584f';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = e.kind === 'city' ? '#e8c37a' : '#f4b8ad';
    ctx.fillText(label, bx, by + 0.5);
  }

  if (selected) {
    const pulse = 1 + Math.sin(t * 4) * 0.08;
    ctx.strokeStyle = '#ffb199';
    ctx.lineWidth = 2.6;
    ctx.setLineDash([8, 6]);
    ctx.lineDashOffset = -t * 26;
    ctx.beginPath();
    ctx.arc(pos.px, pos.py, box * 0.62 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

/* ─────────────────────────  Управление камерой  ───────────────────────── */

function screenToTile(px: number, py: number): { x: number; y: number } {
  const ts = tileSize();
  const cam = state.camera;
  return {
    x: Math.floor((px - width / 2) / ts + cam.x),
    y: Math.floor((py - height / 2) / ts + cam.y),
  };
}

function onPointerDown(ev: PointerEvent): void {
  canvas.setPointerCapture(ev.pointerId);
  pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
  dragged = false;
  dragStart = { x: ev.clientX, y: ev.clientY, time: Date.now() };
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinchStart = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: state.camera.zoom };
  }
}

function onPointerMove(ev: PointerEvent): void {
  const prev = pointers.get(ev.pointerId);
  if (!prev) return;
  pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });

  if (pointers.size === 2 && pinchStart) {
    const [a, b] = [...pointers.values()];
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    setZoom(pinchStart.zoom * (dist / Math.max(1, pinchStart.dist)));
    dragged = true;
    return;
  }

  if (pointers.size === 1 && prev) {
    const dx = ev.clientX - prev.x;
    const dy = ev.clientY - prev.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) dragged = true;
    const ts = tileSize();
    state.camera.x -= dx / ts;
    state.camera.y -= dy / ts;
    clampCamera();
  }
}

function onPointerUp(ev: PointerEvent): void {
  pointers.delete(ev.pointerId);
  if (pointers.size < 2) pinchStart = null;
  if (!dragStart) return;
  const moved = Math.hypot(ev.clientX - dragStart.x, ev.clientY - dragStart.y);
  const quick = Date.now() - dragStart.time < 500;
  if (!dragged && moved < 10 && quick) {
    const rect = canvas.getBoundingClientRect();
    const tile = screenToTile(ev.clientX - rect.left, ev.clientY - rect.top);
    handleTap(tile.x, tile.y);
  }
  dragStart = null;
}

function clampCamera(): void {
  const limit = (terrainSize || 96) + 8;
  state.camera.x = Math.max(-8, Math.min(limit, state.camera.x));
  state.camera.y = Math.max(-8, Math.min(limit, state.camera.y));
}

function handleTap(x: number, y: number): void {
  if (state.placing) {
    state.placing.selected = { x, y };
    mapEvents.onTileTap?.(x, y);
    return;
  }
  const entity = state.snapshot?.entities.find((e) => e.x === x && e.y === y);
  state.selectedEntityId = entity?.id ?? null;
  mapEvents.onSelectEntity?.(entity?.id ?? null);
}

function onWheel(ev: WheelEvent): void {
  ev.preventDefault();
  setZoom(state.camera.zoom * (ev.deltaY > 0 ? 0.88 : 1.14));
}

export function currentTerrainSize(): number {
  return terrainSize;
}

export function resourcesLabel(): string {
  const r = resourcesAt();
  const p = player();
  return `${fmt(r.food)}/${fmt(p.storageCap)}`;
}

export function tileAt(px: number, py: number): { x: number; y: number } {
  return screenToTile(px, py);
}
