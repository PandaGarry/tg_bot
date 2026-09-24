import type { EntityView, Patch, PlayerView, Resources, Snapshot, Toast } from '@ashfall/shared';
import { RESOURCE_BASE_RATE } from '@ashfall/rules';

export type TabName = 'city' | 'army' | 'reports' | 'rating' | 'menu';

export interface PlacingState {
  kind: 'found' | 'migrate';
  worldId: number;
  worldName: string;
  size: number;
  map: string;
  occupied: Set<string>;
  selected: { x: number; y: number } | null;
}

export const state = {
  token: null as string | null,
  snapshot: null as Snapshot | null,
  offset: 0,
  placing: null as PlacingState | null,
  selectedEntityId: null as string | null,
  tab: null as TabName | null,
  camera: { x: 48, y: 48, zoom: 1 },
  connecting: true,
  toasts: [] as { id: number; kind: Toast['kind']; text: string; at: number }[],
  cameraDirty: true,
};

export function player(): PlayerView {
  if (!state.snapshot) throw new Error('нет игрока');
  return state.snapshot.player;
}

export function hasPlayer(): boolean {
  return state.snapshot !== null;
}

export function serverNow(): number {
  return Date.now() + state.offset;
}

/** Ресурсы «прямо сейчас»: сервер присылает срез, клиент интерполирует по ставкам. */
export function resourcesAt(now = serverNow()): Resources {
  const p = state.snapshot?.player;
  if (!p) return { food: 0, wood: 0, stone: 0, iron: 0, ember: 0 };
  const dt = Math.max(0, (now - state.snapshot!.now) / 1000);
  const out: Resources = { ...p.resources };
  for (const key of ['food', 'wood', 'stone', 'iron'] as const) {
    out[key] = Math.min(p.storageCap, p.resources[key] + p.rates[key] * dt);
  }
  return out;
}

export function entityById(id: string): EntityView | undefined {
  return state.snapshot?.entities.find((e) => e.id === id);
}

export function applyPatch(patch: Patch): void {
  const snap = state.snapshot;
  if (!snap) return;
  snap.now = patch.now;
  if (patch.player) snap.player = patch.player;
  if (patch.leaders) snap.leaders = patch.leaders;
  if (patch.reports) snap.reports = patch.reports;
  if (patch.entities?.length) {
    const byId = new Map(snap.entities.map((e) => [e.id, e]));
    for (const e of patch.entities) byId.set(e.id, e);
    if (patch.removedEntities) for (const id of patch.removedEntities) byId.delete(id);
    snap.entities = [...byId.values()];
  } else if (patch.removedEntities?.length) {
    const removed = new Set(patch.removedEntities);
    snap.entities = snap.entities.filter((e) => !removed.has(e.id));
  }
  if (patch.toasts?.length) pushToasts(patch.toasts);
}

export function applySnapshot(snapshot: Snapshot): void {
  const prevWorld = state.snapshot?.player.worldId;
  state.snapshot = snapshot;
  state.selectedEntityId = null;
  if (prevWorld !== snapshot.player.worldId || state.cameraDirty) {
    if (snapshot.player.x >= 0) {
      state.camera.x = snapshot.player.x;
      state.camera.y = snapshot.player.y;
    }
    state.cameraDirty = false;
  }
}

let toastId = 1;
export function pushToasts(toasts: Toast[]): void {
  for (const t of toasts) state.toasts.push({ id: toastId++, kind: t.kind, text: t.text, at: Date.now() });
  if (state.toasts.length > 6) state.toasts.splice(0, state.toasts.length - 6);
}

export function fmt(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const v = Math.floor(n);
  if (v < 1000) return String(v);
  if (v < 1_000_000) return `${(v / 1000).toFixed(v < 10_000 ? 1 : 0)}k`;
  return `${(v / 1_000_000).toFixed(1)}M`;
}

export function fmtDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} с`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  if (m < 60) return `${m} м ${String(rest).padStart(2, '0')} с`;
  const h = Math.floor(m / 60);
  return `${h} ч ${String(m % 60).padStart(2, '0')} м`;
}

export function fmtClock(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function perMinute(rate: number): number {
  return Math.round(rate * 60);
}

export const RESOURCE_META = {
  food: { icon: 'wheat', name: 'Еда' },
  wood: { icon: 'wood', name: 'Древесина' },
  stone: { icon: 'rock', name: 'Камень' },
  iron: { icon: 'iron', name: 'Железо' },
  ember: { icon: 'flame', name: 'Жар' },
} as const;

export type ResourceKey = keyof typeof RESOURCE_META;

/** Любые эмодзи из правил заменяем своими SVG-иконками (см. ui/icons.ts). */
export const UNIT_ICON: Record<string, string> = {
  infantry: 'shield',
  archers: 'bow',
  cavalry: 'horse',
};

export const BUILDING_ICON: Record<string, string> = {
  town_hall: 'castle',
  farm: 'wheat',
  lumber: 'tree',
  quarry: 'rock',
  mine: 'iron',
  barracks: 'swords',
  wall: 'bricks',
  warehouse: 'crate',
  watchtower: 'eye',
};

export const HOUSE_ICON: Record<string, string> = {
  order: 'crown',
  clans: 'peak',
  trade: 'scales',
};

export const MARCH_ICON: Record<string, string> = {
  attack: 'swords',
  gather: 'crate',
  scout: 'eye',
  reinforce: 'shield',
};

export const REPORT_ICON: Record<string, string> = {
  battle: 'swords',
  gather: 'crate',
  scout: 'eye',
  kvk: 'flame',
  system: 'bell',
};

export const HOUSE_COLOR: Record<string, string> = {
  order: '#8fa9d8',
  clans: '#8fc98f',
  trade: '#e0b866',
};

export const RESOURCE_BASE = RESOURCE_BASE_RATE;
