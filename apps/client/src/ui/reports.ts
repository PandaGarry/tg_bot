import type { ReportView, Troops } from '@ashfall/shared';
import { UNIT_ICONS, UNIT_NAMES } from '@ashfall/rules';
import { RESOURCE_META, fmt, fmtClock, state } from '../store';
import { clear, h } from './dom';

const opened = new Set<string>();

export function renderReports(host: HTMLElement): void {
  clear(host);
  const list = state.snapshot?.reports ?? [];
  if (list.length === 0) {
    host.append(h('div', { class: 'muted', text: 'Донесений пока нет.' }));
    return;
  }
  for (const r of list) {
    host.append(reportCard(r));
  }
}

function reportCard(r: ReportView): HTMLElement {
  const body = h('div', { class: 'r-body' });
  body.append(...bodyRows(r));
  const card = h('div', { class: `report ${verdict(r)}` }, [
    h('div', { class: 'r-title', text: r.title }),
    h('div', { class: 'r-time', text: fmtClock(r.createdAt) }),
    body,
  ]);
  if (opened.has(r.id)) card.classList.add('open');
  card.addEventListener('click', () => {
    if (opened.has(r.id)) opened.delete(r.id);
    else opened.add(r.id);
    card.classList.toggle('open');
  });
  return card;
}

function verdict(r: ReportView): string {
  if (r.type === 'battle') return r.data.winner ? 'win' : 'lose';
  if (r.type === 'gather') return 'win';
  if (r.type === 'kvk') return 'win';
  return '';
}

function troopsLine(label: string, t: Troops | undefined): HTMLElement {
  if (!t) return h('div', { text: `${label}: —` });
  const parts = (['infantry', 'archers', 'cavalry'] as const)
    .filter((k) => (t[k] ?? 0) > 0)
    .map((k) => `${t[k]} ${UNIT_ICONS[k]}${UNIT_NAMES[k]}`);
  return h('div', { text: `${label}: ${parts.length ? parts.join(', ') : 'нет'}` });
}

function bodyRows(r: ReportView): HTMLElement[] {
  const rows: HTMLElement[] = [];
  const d = r.data as Record<string, unknown>;

  if (typeof d.text === 'string') rows.push(h('div', { text: d.text }));

  if (r.type === 'battle') {
    rows.push(h('div', { class: d.winner ? 'ok-text' : 'bad-text', text: d.winner ? 'Победа' : 'Поражение' }));
    if (typeof d.defender === 'string') rows.push(h('div', { text: `Защитник: ${d.defender}` }));
    if (typeof d.attacker === 'string') rows.push(h('div', { text: `Атакующий: ${d.attacker}` }));
    if (d.target === 'city-defense') {
      rows.push(troopsLine('Твои потери', d.losses as Troops));
      rows.push(troopsLine('Потери врага', d.enemyLosses as Troops));
    } else {
      rows.push(troopsLine('Твои потери', d.losses as Troops));
      rows.push(troopsLine('Потери врага', d.enemyLosses as Troops));
    }
    if (d.loot && typeof d.loot === 'object') {
      const loot = d.loot as Record<string, number>;
      const parts = (['food', 'wood', 'stone', 'iron'] as const)
        .filter((k) => (loot[k] ?? 0) > 0)
        .map((k) => `${RESOURCE_META[k].icon}${fmt(loot[k])}`);
      if (parts.length) rows.push(h('div', { text: `Добыча: ${parts.join(' ')}` }));
    }
    if (typeof d.ember === 'number' && d.ember > 0) {
      rows.push(h('div', { class: 'ember', text: `Жар за убитых: +${d.ember} 🔥` }));
    }
  }

  if (r.type === 'gather') {
    rows.push(
      h('div', {
        text: `Собрано ${fmt(Number(d.amount ?? 0))} ${RESOURCE_META[(d.resource as 'food') ?? 'food'].name}`,
      }),
    );
  }

  if (r.type === 'scout') {
    if (typeof d.nick === 'string') rows.push(h('div', { text: `Город: ${d.nick}` }));
    if (typeof d.power === 'number') rows.push(h('div', { text: `Мощь: ${fmt(d.power)}` }));
    if (d.garrison) rows.push(troopsLine('Гарнизон', d.garrison as Troops));
    if (d.resources) {
      const res = d.resources as Record<string, number>;
      rows.push(
        h('div', {
          text:
            'Запасы: ' +
            (['food', 'wood', 'stone', 'iron'] as const)
              .map((k) => `${RESOURCE_META[k].icon}${fmt(res[k] ?? 0)}`)
              .join(' '),
        }),
      );
    }
    if (d.loot && typeof d.loot === 'object') {
      const loot = d.loot as Record<string, number>;
      rows.push(
        h('div', {
          text:
            'Добыча: ' +
            (['food', 'wood', 'stone', 'iron'] as const)
              .map((k) => `${RESOURCE_META[k].icon}${fmt(loot[k] ?? 0)}`)
              .join(' '),
        }),
      );
    }
    if (typeof d.emberPerMinute === 'number') {
      rows.push(h('div', { text: `Доход колодца: ${d.emberPerMinute} 🔥/мин` }));
    }
  }

  if (r.type === 'kvk') {
    rows.push(h('div', { text: `Колодец (${d.x}, ${d.y}) ур. ${d.level}` }));
    rows.push(h('div', { class: 'ember', text: `Доход: ${d.emberPerMinute} 🔥/мин` }));
    rows.push(troopsLine('Оставлено гарнизоном', d.garrison as Troops));
  }

  if (rows.length === 0) rows.push(h('div', { class: 'muted', text: JSON.stringify(d) }));
  return rows;
}
