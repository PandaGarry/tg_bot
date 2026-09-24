import { cmd } from '../net';
import { HOUSE_ICON, fmt, state } from '../store';
import { clear, h } from './dom';
import { iconEl } from './icons';
import { resJoin } from './widgets';

let scope: 'world' | 'kvk' = 'world';

export function renderRating(host: HTMLElement): void {
  clear(host);
  const me = state.snapshot?.player;
  const chips = h('div', { class: 'chips' }, [
    h('button', {
      class: `chip${scope === 'world' ? ' active' : ''}`,
      onclick: () => {
        scope = 'world';
        void load();
      },
    }, [iconEl('trophy', 'ic-s'), h('span', { text: 'Моё королевство' })]),
    h('button', {
      class: `chip${scope === 'kvk' ? ' active' : ''}`,
      onclick: () => {
        scope = 'kvk';
        void load();
      },
    }, [iconEl('flame', 'ic-s'), h('span', { text: 'Пылающий предел' })]),
  ]);
  host.append(chips);

  const list = state.snapshot?.leaders ?? [];
  if (list.length === 0) host.append(h('div', { class: 'muted', text: 'Пока никого.' }));

  list.forEach((row, i) => {
    const medal = i < 3 ? ` pos-${i + 1}` : '';
    host.append(
      h('div', { class: `leader${row.id === me?.id ? ' me' : ''}` }, [
        h('div', { class: `pos${medal}`, text: String(i + 1) }),
        h('div', { style: 'flex:1;min-width:0' }, [
          h('div', { class: 'rc' }, [
            iconEl(HOUSE_ICON[row.house] ?? 'crown', 'ic-s'),
            h('span', { text: row.nick }),
          ]),
          h('div', {
            class: 'muted',
            text: scope === 'kvk' ? row.worldName : `мощь ${fmt(row.power)}`,
          }),
        ]),
        scope === 'kvk'
          ? h('div', { class: 'ember rc-row' }, resJoin([['ember', row.kvkEmber]]))
          : h('div', { text: fmt(row.power) }),
      ]),
    );
  });

  host.append(
    h('div', {
      class: 'muted',
      style: 'margin-top:10px',
      text:
        scope === 'kvk'
          ? 'Жар начисляется за удержание колодцев и за убитых врагов на карте Пылающего предела.'
          : 'Мощь = уровень зданий + войско. Боты растут вместе с миром.',
    }),
  );
}

async function load(): Promise<void> {
  await cmd({ op: 'leaderboard', scope }).catch(() => {});
}
