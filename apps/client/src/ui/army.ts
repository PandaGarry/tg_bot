import { UNIT_KEYS, UNIT_NAMES, UNITS, armyCost, unitCost, unitTrainTime } from '@ashfall/rules';
import type { UnitKey } from '@ashfall/rules';
import { cmd } from '../net';
import { MARCH_ICON, RESOURCE_META, UNIT_ICON, fmt, fmtDuration, player, resourcesAt, serverNow } from '../store';
import { clear, h } from './dom';
import { iconEl } from './icons';
import { resAmount } from './widgets';

let selectedUnit: UnitKey = 'infantry';
let count = 10;
let troopsRefs: Map<UnitKey, HTMLElement> = new Map();
let queueHost: HTMLElement | null = null;
let marchHost: HTMLElement | null = null;
let costRef: HTMLElement | null = null;
let slotsRef: HTMLElement | null = null;

export function renderArmy(host: HTMLElement): void {
  clear(host);
  troopsRefs = new Map();

  const troopsCard = h('div', { class: 'card' }, [h('h3', { text: 'Гарнизон города' })]);
  for (const key of UNIT_KEYS) {
    const value = h('span', { text: '0' });
    troopsRefs.set(key, value);
    troopsCard.append(
      h('div', { class: 'unit-row' }, [
        h('div', { class: 'u-ic' }, [iconEl(UNIT_ICON[key])]),
        h('div', { class: 'u-name' }, [
          h('div', { text: UNIT_NAMES[key] }),
          h('div', {
            class: 'muted',
            text: `атака ${UNITS[key].attack} · скорость ${UNITS[key].speed.toFixed(2)} · груз ${UNITS[key].capacity} · бьёт ${UNIT_NAMES[UNITS[key].counters]}`,
          }),
        ]),
        value,
      ]),
    );
  }
  slotsRef = h('div', { class: 'muted', style: 'margin-top:6px' });
  troopsCard.append(slotsRef);
  host.append(troopsCard);

  const trainCard = h('div', { class: 'card' }, [h('h3', { text: 'Обучение' })]);
  const chips = h('div', { class: 'chips' });
  for (const key of UNIT_KEYS) {
    chips.append(
      h('button', {
        class: `chip${key === selectedUnit ? ' active' : ''}`,
        onclick: () => {
          selectedUnit = key;
          renderArmy(host);
        },
      }, [iconEl(UNIT_ICON[key], 'ic-s'), h('span', { text: UNIT_NAMES[key] })]),
    );
  }
  const input = h('input', {
    class: 'text',
    type: 'number',
    min: '1',
    max: '9999',
    value: String(count),
    oninput: (e: Event) => {
      count = Math.max(1, Math.min(9999, Number((e.target as HTMLInputElement).value) || 1));
      updateArmy();
    },
  }) as HTMLInputElement;
  const quick = h('div', { class: 'chips' }, [
    h('button', { class: 'chip', text: '10', onclick: () => setCount(host, 10) }),
    h('button', { class: 'chip', text: '50', onclick: () => setCount(host, 50) }),
    h('button', { class: 'chip', text: '100', onclick: () => setCount(host, 100) }),
    h('button', { class: 'chip', text: 'на все ресурсы', onclick: () => setCount(host, affordableCount()) }),
  ]);
  costRef = h('div', { class: 'muted' });
  const trainBtn = h('button', {
    class: 'primary',
    text: 'Обучить',
    onclick: () => {
      void train(host, trainBtn as HTMLButtonElement);
    },
  });
  trainCard.append(chips, h('div', { class: 'count-input' }, [input]), quick, costRef, trainBtn);
  queueHost = h('div', { class: 'card' }, [h('h3', { text: 'Очередь' })]);
  host.append(trainCard, queueHost);

  marchHost = h('div', { class: 'card' }, [h('h3', { text: 'Марши' })]);
  host.append(marchHost);
  updateArmy();
}

function setCount(host: HTMLElement, value: number): void {
  count = Math.max(1, value);
  renderArmy(host);
}

function affordableCount(): number {
  const res = resourcesAt();
  const cost = unitCost(selectedUnit);
  let max = 9999;
  for (const key of ['food', 'wood', 'stone', 'iron'] as const) {
    if (cost[key] > 0) max = Math.min(max, Math.floor(res[key] / cost[key]));
  }
  return Math.max(1, max);
}

async function train(host: HTMLElement, btn: HTMLButtonElement): Promise<void> {
  btn.disabled = true;
  try {
    await cmd({ op: 'train', unit: selectedUnit, count });
    renderArmy(host);
  } catch (err) {
    btn.textContent = (err as Error).message;
    setTimeout(() => {
      btn.textContent = 'Обучить';
      btn.disabled = false;
    }, 2200);
  }
}

export function updateArmy(): void {
  const p = player();
  const now = serverNow();
  for (const key of UNIT_KEYS) {
    const ref = troopsRefs.get(key);
    if (ref) ref.textContent = fmt(p.troops[key]);
  }
  if (slotsRef) {
    slotsRef.textContent = `Маршевых слотов: ${p.marchSlots - p.marches.length} из ${p.marchSlots}`;
  }

  if (costRef) {
    const cost = armyCost({ ...{ infantry: 0, archers: 0, cavalry: 0 }, [selectedUnit]: count });
    const time = unitTrainTime(selectedUnit, p.buildings.find((b) => b.key === 'barracks')?.level ?? 1);
    clear(costRef);
    const parts: (HTMLElement | string)[] = [`${count} шт · `];
    for (const r of ['food', 'wood', 'stone', 'iron'] as const) {
      if (cost[r] > 0) {
        parts.push(resAmount(RESOURCE_META[r] ? r : r, cost[r]), ' ');
      }
    }
    parts.push('· ');
    parts.push(h('span', { class: 'rc' }, [iconEl('clock', 'ic-s'), h('span', { text: fmtDuration(time * count) })]));
    costRef.append(...parts);
  }

  if (queueHost) {
    clear(queueHost);
    queueHost.append(h('h3', { text: 'Очередь' }));
    if (p.training.length === 0) {
      queueHost.append(h('div', { class: 'muted', text: 'Очередь пуста' }));
    }
    for (const item of p.training) {
      const left = Math.max(0, (item.finishAt - now) / 1000);
      const total = unitTrainTime(item.unit, p.buildings.find((b) => b.key === 'barracks')?.level ?? 1) * item.count;
      const done = Math.max(0, Math.min(100, (1 - left / Math.max(1, total)) * 100));
      queueHost.append(
        h('div', { style: 'padding:6px 0' }, [
          h('div', { class: 'kv-row' }, [
            h('span', { class: 'rc' }, [iconEl(UNIT_ICON[item.unit], 'ic-s'), h('span', { text: `${item.count} × ${UNIT_NAMES[item.unit]}` })]),
            h('span', { text: fmtDuration(left) }),
          ]),
          h('div', { class: 'bar' }, [h('div', { style: `width:${done}%` })]),
        ]),
      );
    }
  }

  if (marchHost) {
    clear(marchHost);
    marchHost.append(h('h3', { text: 'Марши' }));
    if (p.marches.length === 0) {
      marchHost.append(h('div', { class: 'muted', text: 'Нет активных маршей' }));
    }
    for (const m of p.marches) {
      const left = Math.max(0, (m.arriveAt - now) / 1000);
      const labelText =
        m.kind === 'attack' ? 'Атака' : m.kind === 'gather' ? 'Сбор' : m.kind === 'scout' ? 'Разведка' : 'Помощь';
      const label = h('span', { class: 'rc' }, [iconEl(MARCH_ICON[m.kind] ?? 'swords', 'ic-s'), h('span', { text: `${labelText} (${m.toX}, ${m.toY})` })]);
      const phase = m.phase === 'outbound' ? 'в пути' : 'возвращается';
      const cargoLine = h('div', { class: 'muted rc-row' }, [`${phase} · ${fmt(m.troops.infantry + m.troops.archers + m.troops.cavalry)} бойцов`]);
      if (m.cargo) {
        cargoLine.append(' · везёт ');
        for (const r of ['food', 'wood', 'stone', 'iron'] as const) {
          if ((m.cargo[r] ?? 0) > 0) cargoLine.append(resAmount(r, m.cargo[r]!), ' ');
        }
      }
      marchHost.append(
        h('div', { style: 'padding:8px 0;border-bottom:1px solid #2a2422' }, [
          h('div', { class: 'kv-row' }, [
            label,
            h('span', { text: fmtDuration(left) }),
          ]),
          cargoLine,
          h('button', {
            class: 'ghost',
            style: 'margin-top:6px',
            text: 'Отозвать',
            onclick: () => {
              void cmd({ op: 'recall', marchId: m.id }).catch(() => {});
            },
          }),
        ]),
      );
    }
  }
}
