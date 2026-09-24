import { HOUSES } from '@ashfall/rules';
import { cmd } from '../net';
import { fmt, state } from '../store';
import { clear, h } from './dom';

let scope: 'world' | 'kvk' = 'world';

export function renderRating(host: HTMLElement): void {
  clear(host);
  const me = state.snapshot?.player;
  const chips = h('div', { class: 'chips' }, [
    h('button', {
      class: `chip${scope === 'world' ? ' active' : ''}`,
      text: '🏆 Моё королевство',
      onclick: () => {
        scope = 'world';
        void load();
      },
    }),
    h('button', {
      class: `chip${scope === 'kvk' ? ' active' : ''}`,
      text: '🔥 Пылающий предел',
      onclick: () => {
        scope = 'kvk';
        void load();
      },
    }),
  ]);
  host.append(chips);

  const list = state.snapshot?.leaders ?? [];
  if (list.length === 0) host.append(h('div', { class: 'muted', text: 'Пока никого.' }));

  list.forEach((row, i) => {
    host.append(
      h('div', { class: `leader${row.id === me?.id ? ' me' : ''}` }, [
        h('div', { class: 'pos', text: String(i + 1) }),
        h('div', { style: 'flex:1;min-width:0' }, [
          h('div', { text: `${HOUSES[row.house].icon} ${row.nick}${row.isBot ? '' : ''}` }),
          h('div', {
            class: 'muted',
            text: scope === 'kvk' ? row.worldName : `мощь ${fmt(row.power)}`,
          }),
        ]),
        h('div', {
          class: scope === 'kvk' ? 'ember' : '',
          text: scope === 'kvk' ? `${fmt(row.kvkEmber)} 🔥` : fmt(row.power),
        }),
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
