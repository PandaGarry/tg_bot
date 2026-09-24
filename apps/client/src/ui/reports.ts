import type { ReportView, Troops } from '@ashfall/shared';
import { UNIT_NAMES } from '@ashfall/rules';
import { REPORT_ICON, RESOURCE_META, UNIT_ICON, fmt, fmtClock, state } from '../store';
import { clear, h } from './dom';
import { iconEl } from './icons';
import { resJoin } from './widgets';

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
    h('div', { class: 'r-title' }, [
      iconEl(REPORT_ICON[r.type] ?? 'scroll', 'ic-s'),
      h('span', { text: r.title }),
      r.read ? '' : h('span', { class: 'dot-unread' }),
    ]),
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
  const line = h('div', { class: 'rc-row' }, [`${label}: `]);
  let any = false;
  for (const k of ['infantry', 'archers', 'cavalry'] as const) {
    if ((t[k] ?? 0) > 0) {
      if (any) line.append(', ');
      line.append(iconEl(UNIT_ICON[k], 'ic-s'), ` ${t[k]} ${UNIT_NAMES[k]}`);
      any = true;
    }
  }
  if (!any) line.append('нет');
  return line;
}

function bodyRows(r: ReportView): HTMLElement[] {
  const rows: HTMLElement[] = [];
  const d = r.data as Record<string, unknown>;

  if (typeof d.text === 'string') rows.push(h('div', { text: d.text }));

  if (r.type === 'battle') {
    rows.push(h('div', { class: d.winner ? 'ok-text' : 'bad-text', text: d.winner ? 'Победа' : 'Поражение' }));
    if (typeof d.defender === 'string') rows.push(h('div', { text: `Защитник: ${d.defender}` }));
    if (typeof d.attacker === 'string') rows.push(h('div', { text: `Атакующий: ${d.attacker}` }));
    rows.push(troopsLine('Твои потери', d.losses as Troops));
    rows.push(troopsLine('Потери врага', d.enemyLosses as Troops));
    if (d.loot && typeof d.loot === 'object') {
      const loot = d.loot as Record<string, number>;
      const parts = (['food', 'wood', 'stone', 'iron'] as const)
        .filter((k) => (loot[k] ?? 0) > 0)
        .map((k) => [k, loot[k] ?? 0] as [string, number]);
      if (parts.length) rows.push(h('div', { class: 'rc-row' }, ['Добыча: ', ...resJoin(parts)]));
    }
    if (typeof d.ember === 'number' && d.ember > 0) {
      rows.push(h('div', { class: 'ember rc-row' }, ['Жар за убитых: ', ...resJoin([['ember', d.ember]])]));
    }
  }

  if (r.type === 'gather') {
    const key = (d.resource as string) ?? 'food';
    rows.push(h('div', { class: 'rc-row' }, ['Собрано: ', ...resJoin([[key, Number(d.amount ?? 0)]]),
      ` ${(RESOURCE_META as Record<string, { name: string }>)[key]?.name ?? ''}`]));
  }

  if (r.type === 'scout') {
    if (typeof d.nick === 'string') rows.push(h('div', { text: `Город: ${d.nick}` }));
    if (typeof d.power === 'number') rows.push(h('div', { text: `Мощь: ${fmt(d.power)}` }));
    if (d.garrison) rows.push(troopsLine('Гарнизон', d.garrison as Troops));
    const renderStash = (label: string, stash: Record<string, number>) => {
      rows.push(h('div', { class: 'rc-row' }, [label, ...resJoin((['food', 'wood', 'stone', 'iron'] as const).map((k) => [k, stash[k] ?? 0]))]));
    };
    if (d.resources) renderStash('Запасы: ', d.resources as Record<string, number>);
    if (d.loot && typeof d.loot === 'object') renderStash('Добыча: ', d.loot as Record<string, number>);
    if (typeof d.emberPerMinute === 'number') {
      rows.push(h('div', { class: 'rc-row' }, ['Доход колодца: ', ...resJoin([['ember', d.emberPerMinute]]), ' /мин']));
    }
  }

  if (r.type === 'kvk') {
    rows.push(h('div', { text: `Колодец (${d.x}, ${d.y}) ур. ${d.level}` }));
    rows.push(h('div', { class: 'ember rc-row' }, ['Доход: ', ...resJoin([['ember', Number(d.emberPerMinute ?? 0)]]), ' /мин']));
    rows.push(troopsLine('Оставлено гарнизоном', d.garrison as Troops));
  }

  if (rows.length === 0) rows.push(h('div', { class: 'muted', text: JSON.stringify(d) }));
  return rows;
}
