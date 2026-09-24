import type { EntityView } from '@ashfall/shared';
import { RESOURCE_META, fmt, fmtDuration, player, resourcesAt, serverNow, state } from '../store';

const TERRAIN_COLOR = ['#3d4a34', '#2c4232', '#4a4133', '#4d4d55', '#1d2a39', '#4b2f2b'];
const NODE_COLOR: Record<string, string> = {
  food: '#8fc98f',
  wood: '#b98a55',
  stone: '#9aa0a6',
  iron: '#cfd6dd',
};

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
}

export function renderMap(): void {
  const placing = state.placing;
  const snap = state.snapshot;
  if (placing) {
    decodeTerrain(`w${placing.worldId}`, placing.map, placing.size);
  } else if (snap) {
    decodeTerrain(`w${snap.world.id}`, snap.map, snap.world.size);
  } else {
    return;
  }
  if (!terrain) return;

  const ts = tileSize();
  ctx.fillStyle = '#0d0b0a';
  ctx.fillRect(0, 0, width, height);

  const cam = state.camera;
  const halfW = width / 2 / ts;
  const halfH = height / 2 / ts;
  const x0 = Math.floor(cam.x - halfW - 1);
  const x1 = Math.ceil(cam.x + halfW + 1);
  const y0 = Math.floor(cam.y - halfH - 1);
  const y1 = Math.ceil(cam.y + halfH + 1);

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (x < 0 || y < 0 || x >= terrainSize || y >= terrainSize) continue;
      const code = terrain[y * terrainSize + x] ?? 0;
      ctx.fillStyle = TERRAIN_COLOR[code] ?? '#333';
      const px = (x - cam.x) * ts + width / 2;
      const py = (y - cam.y) * ts + height / 2;
      ctx.fillRect(px, py, ts + 0.6, ts + 0.6);
    }
  }

  if (ts >= 22) {
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = x0; x <= x1; x++) {
      const px = Math.round((x - cam.x) * ts + width / 2) + 0.5;
      ctx.moveTo(px, 0);
      ctx.lineTo(px, height);
    }
    for (let y = y0; y <= y1; y++) {
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
    // занятые тайлы крестиком, выбранный — рамкой
    ctx.strokeStyle = 'rgba(209,88,79,0.75)';
    ctx.lineWidth = 2;
    const r = Math.max(5, ts * 0.18);
    for (const key of placing.occupied) {
      const [x, y] = key.split(':').map(Number);
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      const { px, py } = toScreen(x + 0.5, y + 0.5);
      ctx.beginPath();
      ctx.moveTo(px - r, py - r);
      ctx.lineTo(px + r, py + r);
      ctx.moveTo(px + r, py - r);
      ctx.lineTo(px - r, py + r);
      ctx.stroke();
    }
    if (placing.selected) {
      const { px, py } = toScreen(placing.selected.x, placing.selected.y);
      ctx.strokeStyle = '#ff7a3d';
      ctx.lineWidth = 3;
      ctx.strokeRect(px, py, ts, ts);
    }
    return;
  }

  if (!snap) return;

  const me = snap.player;
  for (const e of snap.entities) {
    if (e.x < x0 || e.x > x1 || e.y < y0 || e.y > y1) continue;
    drawEntity(e, toScreen(e.x + 0.5, e.y + 0.5), ts, e.id === state.selectedEntityId);
  }

  // марши
  const now = serverNow();
  for (const m of me.marches) {
    const from = toScreen(m.fromX + 0.5, m.fromY + 0.5);
    const to = toScreen(m.toX + 0.5, m.toY + 0.5);
    const t = Math.max(
      0,
      Math.min(1, (now - m.departAt) / Math.max(1, m.arriveAt - m.departAt)),
    );
    const px = from.px + (to.px - from.px) * t;
    const py = from.py + (to.py - from.py) * t;
    ctx.strokeStyle = m.phase === 'outbound' ? 'rgba(209,88,79,0.55)' : 'rgba(111,191,115,0.5)';
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(from.px, from.py);
    ctx.lineTo(to.px, to.py);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = m.phase === 'outbound' ? '#d1584f' : '#6fbf73';
    ctx.beginPath();
    ctx.arc(px, py, Math.max(4, ts * 0.16), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (ts >= 24) {
      const left = Math.max(0, (m.arriveAt - now) / 1000);
      ctx.font = '600 10px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillText(fmtDuration(left), px, py - Math.max(9, ts * 0.22));
      ctx.fillStyle = '#ece3dc';
      ctx.fillText(fmtDuration(left), px, py - Math.max(9, ts * 0.22) - 0.5);
    }
  }

  // свой город: подсветка
  if (me.x >= 0) {
    const { px, py } = toScreen(me.x + 0.5, me.y + 0.5);
    ctx.strokeStyle = '#e8c37a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, ts * 0.85, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/** roundRect есть не везде — старый Safari падает без него. */
function roundedRect(x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

function drawEntity(
  e: EntityView,
  pos: { px: number; py: number },
  ts: number,
  selected: boolean,
): void {
  const size = Math.max(6, ts * 0.62);
  const me = state.snapshot?.player;
  const isMine = me ? e.ownerId === me.id : false;

  if (e.kind === 'city') {
    const color = isMine ? '#e8c37a' : '#9aa7b8';
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 1.5;
    const s = size * 0.9;
    roundedRect(pos.px - s / 2, pos.py - s / 2, s, s, Math.max(2, s * 0.22));
    ctx.fill();
    ctx.stroke();
    if (ts >= 26) {
      ctx.fillStyle = '#1a1512';
      ctx.font = `700 ${Math.round(ts * 0.34)}px -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(e.level), pos.px, pos.py + 0.5);
    }
    if (selected) {
      ctx.strokeStyle = '#ff7a3d';
      ctx.lineWidth = 3;
      roundedRect(pos.px - s / 2 - 4, pos.py - s / 2 - 4, s + 8, s + 8, 6);
      ctx.stroke();
    }
    return;
  }

  if (e.kind === 'camp') {
    ctx.fillStyle = '#8d3a34';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pos.px, pos.py - size / 2);
    ctx.lineTo(pos.px + size / 2, pos.py);
    ctx.lineTo(pos.px, pos.py + size / 2);
    ctx.lineTo(pos.px - size / 2, pos.py);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (ts >= 26) {
      ctx.fillStyle = '#f0e4dc';
      ctx.font = `${Math.round(ts * 0.32)}px -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('☠', pos.px, pos.py + 1);
    }
    if (selected) ring(pos, size * 0.75, '#ff7a3d');
    return;
  }

  if (e.kind === 'node') {
    ctx.fillStyle = NODE_COLOR[e.resource ?? 'food'] ?? '#ccc';
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(pos.px, pos.py, size * 0.34, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (ts >= 30 && e.resource) {
      ctx.font = `${Math.round(ts * 0.3)}px -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(RESOURCE_META[e.resource as keyof typeof RESOURCE_META].icon, pos.px, pos.py + 1);
    }
    if (selected) ring(pos, size * 0.5, '#ff7a3d');
    return;
  }

  if (e.kind === 'well') {
    ctx.fillStyle = isMine ? '#ffb066' : '#ff7a3d';
    ctx.strokeStyle = isMine ? '#e8c37a' : 'rgba(0,0,0,0.6)';
    ctx.lineWidth = isMine ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.arc(pos.px, pos.py, size * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#2a1408';
    ctx.font = `700 ${Math.round(ts * 0.34)}px -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(e.level), pos.px, pos.py + 1);
    if (selected) ring(pos, size * 0.62, '#e8c37a');
  }
}

function ring(pos: { px: number; py: number }, r: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(pos.px, pos.py, r + 4, 0, Math.PI * 2);
  ctx.stroke();
}

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
