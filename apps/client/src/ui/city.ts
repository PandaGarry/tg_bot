import {
  BUILDING_DESCRIPTIONS,
  BUILDING_ICONS,
  BUILDING_KEYS,
  BUILDING_NAMES,
  RESOURCE_KEYS,
  buildingCost,
  buildingTime,
  canUpgrade,
} from '@ashfall/rules';
import type { BuildingKey, ResourceKey } from '@ashfall/rules';
import { cmd } from '../net';
import { RESOURCE_META, fmt, fmtDuration, perMinute, player, resourcesAt, serverNow } from '../store';
import { clear, h } from './dom';

interface BuildingRefs {
  key: BuildingKey;
  cost: HTMLElement;
  action: HTMLButtonElement;
  progress: HTMLElement;
  progressBar: HTMLElement;
  lvl: HTMLElement;
}

let storageCard: HTMLElement | null = null;
let refs: BuildingRefs[] = [];
let storageRefs: { fill: HTMLElement; text: HTMLElement }[] = [];
let rateRefs: HTMLElement[] = [];

export function renderCity(host: HTMLElement): void {
  clear(host);
  refs = [];
  storageRefs = [];
  rateRefs = [];
  const p = player();

  storageCard = h('div', { class: 'card' }, [h('h3', { text: 'Хранилище и прирост' })]);
  for (const key of ['food', 'wood', 'stone', 'iron'] as ResourceKey[]) {
    const fill = h('div');
    const bar = h('div', { class: 'bar' }, [fill]);
    const text = h('div', { class: 'kv-row' }, [
      h('span', { text: `${RESOURCE_META[key].icon} ${RESOURCE_META[key].name}` }),
      h('span', { text: '' }),
    ]);
    storageCard.append(text, bar);
    storageRefs.push({ fill, text: text.lastElementChild as HTMLElement });
  }
  const rateRow = h('div', { class: 'muted', style: 'margin-top:8px' });
  for (const key of ['food', 'wood', 'stone', 'iron'] as ResourceKey[]) {
    const span = h('span', { text: '' });
    rateRefs.push(span);
    rateRow.append(span, document.createTextNode('  '));
  }
  storageCard.append(rateRow);
  host.append(storageCard);

  const legend = h('div', { class: 'muted', style: 'margin-bottom:8px' }, [
    `Ратуша ограничивает уровень остальных зданий. Сейчас: ${p.buildings.find((b) => b.key === 'town_hall')?.level ?? 1}`,
  ]);
  host.append(legend);

  const grid = h('div', { class: 'build-grid' });
  for (const key of BUILDING_KEYS) {
    const view = p.buildings.find((b) => b.key === key);
    const level = view?.level ?? 0;
    const lvl = h('span', { class: 'lvl', text: `ур. ${level}` });
    const cost = h('div', { class: 'cost' });
    const progress = h('div', { class: 'muted', style: 'display:none' });
    const progressBar = h('div', { class: 'bar', style: 'display:none' }, [h('div')]);
    const action = h('button', { class: 'ghost', text: 'Улучшить' }) as HTMLButtonElement;
    const card = h('div', { class: 'build' }, [
      h('div', { class: 'ic', text: BUILDING_ICONS[key] }),
      h('div', { class: 'info' }, [
        h('div', { class: 'name' }, [h('span', { text: BUILDING_NAMES[key] }), lvl]),
        cost,
        progress,
        progressBar,
        h('div', { class: 'muted', style: 'font-size:11px;margin-top:2px', text: BUILDING_DESCRIPTIONS[key] }),
      ]),
      h('div', { class: 'act' }, [action]),
    ]);
    action.addEventListener('click', () => {
      void nav_upgrade(key, action);
    });
    grid.append(card);
    refs.push({
      key,
      cost,
      action,
      progress,
      progressBar,
      lvl,
    });
  }
  host.append(grid);
  updateCity();
}

async function nav_upgrade(key: BuildingKey, btn: HTMLButtonElement): Promise<void> {
  btn.disabled = true;
  try {
    await cmd({ op: 'upgrade', building: key });
  } catch (err) {
    btn.textContent = (err as Error).message;
    setTimeout(() => {
      btn.textContent = 'Улучшить';
      btn.disabled = false;
    }, 2200);
    return;
  }
  btn.disabled = false;
}

export function updateCity(): void {
  if (!storageCard) return;
  const p = player();
  const res = resourcesAt();
  const now = serverNow();

  ['food', 'wood', 'stone', 'iron'].forEach((key, i) => {
    const ref = storageRefs[i];
    if (!ref) return;
    const k = key as ResourceKey;
    const pct = Math.min(100, (res[k] / Math.max(1, p.storageCap)) * 100);
    ref.fill.style.width = `${pct}%`;
    ref.text.textContent = `${fmt(res[k])} / ${fmt(p.storageCap)}`;
    if (rateRefs[i]) rateRefs[i].textContent = `${RESOURCE_META[k].icon}+${perMinute(p.rates[k])}/м`;
  });

  const thLevel = p.buildings.find((b) => b.key === 'town_hall')?.level ?? 1;
  for (const ref of refs) {
    const view = p.buildings.find((b) => b.key === ref.key);
    const level = view?.level ?? 0;
    ref.lvl.textContent = `ур. ${level}`;

    if (view?.upgradingTo) {
      ref.cost.textContent = `строится ур. ${view.upgradingTo}`;
      ref.progress.style.display = 'block';
      ref.progressBar.style.display = 'block';
      const left = Math.max(0, ((view.finishAt ?? now) - now) / 1000);
      ref.progress.textContent = `осталось ${fmtDuration(left)}`;
      const total = buildingTime(ref.key, view.upgradingTo) * 1000;
      const done = Math.max(0, Math.min(100, (1 - left * 1000 / total) * 100));
      (ref.progressBar.firstElementChild as HTMLElement).style.width = `${done}%`;
      ref.action.disabled = true;
      ref.action.textContent = '…';
      continue;
    }

    ref.progress.style.display = 'none';
    ref.progressBar.style.display = 'none';
    const check = canUpgrade(ref.key, level, thLevel);
    const cost = buildingCost(ref.key, level + 1);
    clear(ref.cost);
    for (const r of RESOURCE_KEYS) {
      if (!cost[r]) continue;
      const lack = res[r] < cost[r];
      ref.cost.append(
        h('span', { class: lack ? 'no' : '', text: `${RESOURCE_META[r].icon}${fmt(cost[r])}` }),
      );
    }
    ref.cost.append(h('span', { text: `⏱ ${fmtDuration(buildingTime(ref.key, level + 1))}` }));

    if (!check.ok) {
      ref.action.disabled = true;
      ref.action.textContent = 'заблокировано';
    } else {
      ref.action.disabled = false;
      ref.action.textContent = 'Улучшить';
    }
  }
}
