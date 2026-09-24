import {
  CAMP_LOOT,
  NODE_INFO,
  TERRAIN_NAMES,
  UNIT_KEYS,
  UNIT_NAMES,
  UNITS,
  WELL_EMBER_PER_MINUTE,
  distance,
  gatherSeconds,
  lootCapacity,
  terrainAt,
  travelSeconds,
} from '@ashfall/rules';
import type { EntityView, MarchKind } from '@ashfall/shared';
import { RESOURCE_META, UNIT_ICON, fmt, fmtDuration, player, pushToasts, serverNow, state } from '../store';
import { clear, h, qs } from './dom';
import { iconEl } from './icons';
import { nav } from './nav';
import { kv, resJoin } from './widgets';

let current: { entity: EntityView | null; tile: { x: number; y: number } } | null = null;
let composer: { entity: EntityView; kind: MarchKind; troops: Record<string, number> } | null = null;

export function closeSheet(): void {
  current = null;
  composer = null;
  state.selectedEntityId = null;
  qs('#sheet').classList.add('hidden');
}

export function isSheetOpen(): boolean {
  return current !== null;
}

export function openSheet(entity: EntityView | null, tile: { x: number; y: number }): void {
  current = { entity, tile };
  composer = null;
  render();
}

function world() {
  return state.snapshot!.world;
}

function travelTo(x: number, y: number, troops = { infantry: 1, archers: 0, cavalry: 0 }): number {
  const p = player();
  return travelSeconds({
    seed: world().seed,
    kind: world().kind,
    size: world().size,
    fromX: p.x,
    fromY: p.y,
    toX: x,
    toY: y,
    troops: troops as never,
    house: p.house,
  });
}

function render(): void {
  const host = qs('#sheet');
  clear(host);
  host.classList.remove('hidden');
  if (!current) return;

  if (composer) {
    renderComposer(host);
    return;
  }

  const { entity, tile } = current;
  if (!entity) {
    const terrain = terrainAt(world().seed, world().kind, tile.x, tile.y);
    host.append(
      h('div', { class: 'title-row' }, [
        iconEl('peak'),
        h('span', { text: TERRAIN_NAMES[terrain] ?? 'Земля' }),
        h('span', { class: 'muted', text: `(${tile.x}, ${tile.y})` }),
      ]),
      h('div', {
        class: 'muted',
        text: `Пустой тайл в ${Math.round(distance(player().x, player().y, tile.x, tile.y))} клетках от города.`,
      }),
      h('div', { class: 'bar' }),
      h('button', {
        class: 'ghost',
        text: 'Закрыть',
        onclick: closeSheet,
      }),
    );
    return;
  }

  const p = player();
  const dist = Math.round(distance(p.x, p.y, entity.x, entity.y));
  const head = h('div', { class: 'title-row' }, [
    iconEl(iconFor(entity)),
    h('span', { text: titleFor(entity) }),
    h('span', { class: 'muted', text: `(${entity.x}, ${entity.y}) · ${dist} кл.` }),
  ]);
  host.append(head);

  const rows: HTMLElement[] = [];
  if (entity.kind === 'city') {
    rows.push(kv('Владелец', entity.ownerNick ?? '—'));
    rows.push(kv('Мощь', fmt(entity.power)));
    rows.push(kv('Гарнизон', entity.ownerId === p.id ? fmt(troopsTotal(p.troops)) : 'неизвестен'));
  } else if (entity.kind === 'camp') {
    rows.push(kv('Гарнизон', describeTroops(entity.garrison)));
    rows.push(kv('Мощь', fmt(entity.power)));
    const loot = CAMP_LOOT[Math.min(6, entity.level)];
    rows.push(kv('Добыча', resJoin([['food', loot.food], ['wood', loot.wood], ['stone', loot.stone], ['iron', loot.iron]])));
  } else if (entity.kind === 'node') {
    const info = NODE_INFO[entity.resource ?? 'food'];
    rows.push(kv('Ресурс', entity.resource ?? '—'));
    rows.push(kv('Остаток', `${fmt(entity.amount ?? 0)}`));
    rows.push(kv('Восстановление', `${Math.round(info.rate * 60)}/мин`));
  } else if (entity.kind === 'well') {
    rows.push(kv('Уровень', String(entity.level)));
    rows.push(kv('Хозяин', entity.ownerId === p.id ? 'ты' : (entity.ownerNick ?? 'никто')));
    rows.push(kv('Доход', [...resJoin([['ember', WELL_EMBER_PER_MINUTE * entity.level]]), ' /мин']));
    rows.push(kv('Стражи', describeTroops(entity.garrison)));
  }
  rows.push(kv('ETA марша', fmtDuration(travelTo(entity.x, entity.y))));
  host.append(...rows);

  const actions = h('div', { class: 'chips' });
  if (entity.kind === 'city' && entity.ownerId === p.id) {
    actions.append(
      h('button', { class: 'chip', onclick: () => nav.openTab('city') }, [iconEl('castle', 'ic-s'), h('span', { text: 'Открыть город' })]),
    );
  } else {
    if (entity.kind === 'node') {
      actions.append(
        h('button', {
          class: 'chip',
          onclick: () => openComposer(entity, 'gather'),
        }, [iconEl('crate', 'ic-s'), h('span', { text: 'Собрать' })]),
      );
    } else {
      actions.append(
        h('button', {
          class: 'chip',
          onclick: () => openComposer(entity, 'attack'),
        }, [
          iconEl(entity.kind === 'well' ? 'flame' : 'swords', 'ic-s'),
          h('span', { text: entity.kind === 'well' ? 'Захватить' : 'Атаковать' }),
        ]),
      );
    }
    if (entity.kind !== 'node') {
      actions.append(
        h('button', {
          class: 'chip',
          onclick: () => openComposer(entity, 'scout'),
        }, [iconEl('eye', 'ic-s'), h('span', { text: 'Разведка' })]),
      );
    }
  }
  actions.append(h('button', { class: 'chip', text: 'Закрыть', onclick: closeSheet }));
  host.append(actions);
}

function iconFor(e: EntityView): string {
  if (e.kind === 'city') return 'castle';
  if (e.kind === 'camp') return 'skull';
  if (e.kind === 'node') return RESOURCE_META[(e.resource ?? 'food') as keyof typeof RESOURCE_META].icon;
  return 'flame';
}

function titleFor(e: EntityView): string {
  if (e.kind === 'city') return e.ownerId === player().id ? 'Твой город' : `Город ${e.ownerNick}`;
  if (e.kind === 'camp') return `Лагерь мародёров · ур. ${e.level}`;
  if (e.kind === 'node') return `Залежь · ${e.resource}`;
  return `Жар-колодец · ур. ${e.level}`;
}


function describeTroops(t: { infantry: number; archers: number; cavalry: number } | null): string {
  if (!t) return 'нет';
  const parts: string[] = [];
  for (const key of UNIT_KEYS) if (t[key] > 0) parts.push(`${t[key]} ${UNIT_NAMES[key]}`);
  return parts.length ? parts.join(', ') : 'нет';
}

function troopsTotal(t: { infantry: number; archers: number; cavalry: number }): number {
  return t.infantry + t.archers + t.cavalry;
}

function openComposer(entity: EntityView, kind: MarchKind): void {
  composer = {
    entity,
    kind,
    troops: { infantry: 0, archers: 0, cavalry: 0 },
  };
  if (kind === 'scout') composer.troops.cavalry = Math.min(1, player().troops.cavalry || 0) || 0;
  render();
}

function renderComposer(host: HTMLElement): void {
  const c = composer!;
  const p = player();
  const title =
    c.kind === 'attack'
      ? c.entity.kind === 'well'
        ? 'Захват колодца'
        : 'Атака'
      : c.kind === 'gather'
        ? 'Сбор ресурсов'
        : 'Разведка';

  host.append(
    h('div', { class: 'title-row' }, [
      iconEl(c.kind === 'attack' ? 'swords' : c.kind === 'gather' ? 'crate' : 'eye'),
      h('span', { text: title }),
      h('span', { class: 'muted' , text: `(${c.entity.x}, ${c.entity.y})` }),
    ]),
  );

  for (const key of UNIT_KEYS) {
    const have = p.troops[key];
    const count = c.troops[key];
    const row = h('div', { class: 'unit-row' }, [
      h('div', { class: 'u-ic' }, [iconEl(UNIT_ICON[key])]),
      h('div', { class: 'u-name' }, [
        h('div', { text: UNIT_NAMES[key] }),
        h('div', { class: 'muted', text: `есть ${have} · скорость ${UNITS[key].speed.toFixed(2)}` }),
      ]),
      h('button', {
        class: 'chip',
        text: '−',
        onclick: () => {
          c.troops[key] = Math.max(0, c.troops[key] - stepFor(have));
          render();
        },
      }),
      h('div', { class: 'muted', text: String(count), style: 'min-width:34px;text-align:center' }),
      h('button', {
        class: 'chip',
        text: '+',
        onclick: () => {
          c.troops[key] = Math.min(have, c.troops[key] + stepFor(have));
          render();
        },
      }),
    ]);
    host.append(row);
  }

  const troops = {
    infantry: c.troops.infantry,
    archers: c.troops.archers,
    cavalry: c.troops.cavalry,
  };
  const totalUnits = troopsTotal(troops);
  const eta = totalUnits > 0 ? travelTo(c.entity.x, c.entity.y, troops) : 0;
  const capacity = lootCapacity(troops, p.house);
  const info = h('div', { class: 'card' });
  info.append(kv('Войско', String(totalUnits)));
  info.append(kv('ETA', totalUnits > 0 ? fmtDuration(eta) : '—'));
  if (c.kind === 'gather') {
    const g = gatherSeconds({
      resource: (c.entity.resource ?? 'food') as never,
      available: c.entity.amount ?? 0,
      troops,
      house: p.house,
    });
    info.append(kv('Унесёт', `${fmt(g.amount)} (${fmtDuration(g.seconds)} на сбор)`));
  } else {
    info.append(kv('Грузоподъёмность', fmt(capacity)));
  }
  info.append(kv('Свободно маршей', `${p.marchSlots - p.marches.length} из ${p.marchSlots}`));
  host.append(info);

  const send = h(
    'button',
    {
      class: 'primary',
      type: 'button',
      onclick: async () => {
        if (totalUnits <= 0) return;
        (send as HTMLButtonElement).disabled = true;
        try {
          await nav.sendMarch(c.kind, c.entity.id, troops);
          closeSheet();
        } catch (err) {
          (send as HTMLButtonElement).disabled = false;
          pushToasts([{ kind: 'danger', text: (err as Error).message }]);
        }
      },
    },
    [
      iconEl(c.kind === 'attack' ? 'swords' : c.kind === 'gather' ? 'crate' : 'eye'),
      h('span', {
        id: 'composer-send-label',
        text:
          c.kind === 'attack' ? 'Отправить в бой' : c.kind === 'gather' ? 'Отправить за ресурсами' : 'Отправить разведку',
      }),
    ],
  );
  host.append(send);
  host.append(
    h('button', { class: 'ghost', text: 'Назад', onclick: () => { composer = null; render(); }, style: 'margin-top:8px' }),
  );
  if (c.kind === 'scout') {
    host.append(
      h('div', {
        class: 'muted',
        text: 'Разведка не воюет: она приносит донесение с точным гарнизоном и запасами цели.',
        style: 'margin-top:8px',
      }),
    );
  }
}

function stepFor(have: number): number {
  if (have <= 20) return 1;
  if (have <= 200) return 10;
  return 50;
}

export function refreshSheet(): void {
  if (current) render();
}

export function sheetNow(): number {
  return serverNow();
}
