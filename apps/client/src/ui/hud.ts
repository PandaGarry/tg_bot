import { HOUSES } from '@ashfall/rules';
import { RESOURCE_META, fmt, perMinute, player, resourcesAt, state } from '../store';
import { clear, h, qs } from './dom';

const KEYS = ['food', 'wood', 'stone', 'iron', 'ember'] as const;

interface HudRefs {
  power: HTMLElement;
  world: HTMLElement;
  values: Map<string, { value: HTMLElement; rate: HTMLElement; root: HTMLElement }>;
}

let refs: HudRefs | null = null;

export function renderHud(): void {
  const host = qs('#hud');
  clear(host);
  const p = player();
  const house = HOUSES[p.house];

  const power = h('b', { text: fmt(p.power) });
  const world = h('span', { text: state.snapshot!.world.name });

  const top = h('div', { class: 'hud-row hud-top' }, [
    h('div', { class: 'hud-chip', title: house.name }, [
      h('span', { text: house.icon }),
      h('b', { text: p.nick }),
    ]),
    h('div', { class: 'hud-chip', title: 'Мощь' }, [h('span', { text: '⚔' }), power]),
    h('div', { class: 'hud-chip', title: 'Мир' }, [h('span', { text: '🗺' }), world]),
  ]);

  const values = new Map<string, { value: HTMLElement; rate: HTMLElement; root: HTMLElement }>();
  const resRow = h('div', { class: 'hud-row res-row' });
  for (const key of KEYS) {
    const value = h('div', { class: 'v', text: '0' });
    const rate = h('div', { class: 'r', text: '' });
    const root = h('div', { class: 'res' }, [
      h('div', { class: 'i', text: RESOURCE_META[key].icon }),
      value,
      rate,
    ]);
    resRow.append(root);
    values.set(key, { value, rate, root });
  }
  host.append(top, resRow);
  refs = { power, world, values };
  updateHud();
}

export function updateHud(): void {
  if (!refs || !state.snapshot) return;
  const p = player();
  const res = resourcesAt();
  refs.power.textContent = fmt(p.power);
  refs.world.textContent = state.snapshot.world.name;
  for (const key of KEYS) {
    const ref = refs.values.get(key);
    if (!ref) continue;
    ref.value.textContent = fmt(res[key]);
    const rate = perMinute(p.rates[key]);
    ref.rate.textContent = rate > 0 ? `+${rate}/м` : '—';
    const full = key !== 'ember' && res[key] >= p.storageCap - 1;
    ref.root.classList.toggle('full', full);
  }
}
