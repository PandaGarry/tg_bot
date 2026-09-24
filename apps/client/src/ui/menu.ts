import { HOUSES, KVK_TOWN_HALL_REQUIRED, LORE } from '@ashfall/rules';
import type { WorldInfo } from '@ashfall/shared';
import { api, cmd } from '../net';
import { HOUSE_ICON, fmt, fmtDuration, player, pushToasts, serverNow, state } from '../store';
import { clear, h } from './dom';
import { iconEl } from './icons';
import { nav } from './nav';
import { resJoin } from './widgets';

export function renderMenu(host: HTMLElement): void {
  clear(host);
  const p = player();
  const house = HOUSES[p.house];
  const now = serverNow();

  host.append(
    h('div', { class: 'card' }, [
      h('h3', { class: 'rc' }, [iconEl(HOUSE_ICON[p.house] ?? 'crown'), h('span', { text: `${p.nick} · ${house.name}` })]),
      h('div', { class: 'muted', text: house.bonus }),
      h('div', { class: 'kv-row' }, [h('span', { text: 'Мощь' }), h('span', { text: fmt(p.power) })]),
      h('div', { class: 'kv-row' }, [
        h('span', { text: 'Жар за сезон' }),
        h('span', { class: 'ember rc-row' }, resJoin([['ember', p.kvkEmber]])),
      ]),
      h('div', { class: 'kv-row' }, [
        h('span', { text: 'Мир' }),
        h('span', { text: state.snapshot!.world.name }),
      ]),
    ]),
  );

  host.append(
    h('div', { class: 'card' }, [
      h('h3', { text: 'Как играть' }),
      h('div', { class: 'muted' }, [
        h('div', { text: '1. Качай ферму, лесопилку, каменоломню и рудник — они дают ресурсы каждую секунду.' }),
        h('div', { text: '2. Ратуша открывает уровень остальных зданий и новые марши.' }),
        h('div', { text: '3. Казарма учит войско. Отправляй марши к лагерям и залежам.' }),
        h('div', { text: '4. Разведка перед боем: гарнизон чужого города неизвестен.' }),
        h('div', { text: '5. Набери ратушу 3 и переселяйся в Пылающий предел (KvK) за Жаром.' }),
      ]),
    ]),
  );

  const migrateCard = h('div', { class: 'card' }, [h('h3', { text: 'Переселение' })]);
  const th = p.buildings.find((b) => b.key === 'town_hall')?.level ?? 1;
  const cooldown = Math.max(0, (p.migrateReadyAt - now) / 1000);
  migrateCard.append(
    h('div', {
      class: 'muted',
      text:
        cooldown > 0
          ? `Обоз отдыхает: ${fmtDuration(cooldown)}`
          : `Твоя ратуша: ур. ${th}. Город переезжает целиком, вместе с войском и запасами.`,
    }),
  );
  for (const world of state.snapshot!.worlds) {
    migrateCard.append(worldRow(world, th, cooldown));
  }
  host.append(migrateCard);

  host.append(
    h('div', { class: 'card' }, [
      h('h3', { text: 'Мир Эшфолл' }),
      h('div', { class: 'lore', text: LORE.intro.join(' ') }),
    ]),
  );

  host.append(
    h('button', {
      class: 'ghost exit-btn',
      onclick: () => {
        localStorage.removeItem('ashfall.token');
        location.reload();
      },
    }, [iconEl('door'), h('span', { text: 'Выйти из аккаунта' })]),
  );
}

function worldRow(world: WorldInfo, th: number, cooldown: number): HTMLElement {
  const current = world.id === state.snapshot?.player.worldId;
  const locked = th < world.requiresTownHall;
  const blocked = current || locked || cooldown > 0;
  return h('div', { class: 'kv-row', style: 'align-items:center;padding:8px 0' }, [
    h('div', {}, [
      h('div', { text: world.name }),
      h('div', {
        class: 'muted',
        text:
          world.kind === 'kvk'
            ? `KvK · нужно ратуша ${KVK_TOWN_HALL_REQUIRED} · ${world.players} городов`
            : `королевство · ${world.players} городов`,
      }),
    ]),
    h('button', {
      class: 'chip',
      style: blocked ? 'opacity:.45' : '',
      text: current ? 'ты здесь' : locked ? `ратуша ${world.requiresTownHall}` : 'выбрать',
      onclick: blocked
        ? undefined
        : () => {
            void startMigration(world.id);
          },
    }),
  ]);
}

async function startMigration(worldId: number): Promise<void> {
  try {
    const data = await api<{ map: string; occupied: [number, number][] }>(`/api/world/${worldId}`);
    state.placing = {
      kind: 'migrate',
      worldId,
      worldName: state.snapshot!.worlds.find((w) => w.id === worldId)!.name,
      size: state.snapshot!.worlds.find((w) => w.id === worldId)!.size,
      map: data.map,
      occupied: new Set(data.occupied.map(([x, y]) => `${x}:${y}`)),
      selected: null,
    };
    state.camera = { x: state.placing.size / 2, y: state.placing.size / 2, zoom: 0.7 };
    nav.openTab(null);
    renderBanner();
  } catch (err) {
    pushToasts([{ kind: 'danger', text: (err as Error).message }]);
  }
}

export function renderBanner(): void {
  const host = document.querySelector('#banner') as HTMLElement;
  if (!host) return;
  const placing = state.placing;
  if (!placing) {
    host.classList.add('hidden');
    return;
  }
  host.classList.remove('hidden');
  clear(host);
  host.append(
    h('div', {}, [
      h('div', {
        text:
          placing.kind === 'found'
            ? 'Выбери место для города: коснись тайла'
            : `Переселение в «${placing.worldName}»: коснись тайла`,
      }),
      h('div', {
        class: 'muted',
        text: placing.selected
          ? `выбрано (${placing.selected.x}, ${placing.selected.y})`
          : 'города и лагеря помечены крестиком',
      }),
    ]),
  );
  const actions = h('div', { style: 'display:flex;gap:6px' });
  if (placing.selected) {
    actions.append(
      h('button', {
        class: 'chip',
        text: placing.kind === 'found' ? 'Основать' : 'Переселить',
        onclick: () => {
          void confirmPlacing();
        },
      }),
    );
  }
  actions.append(
    h('button', {
      class: 'chip',
      text: 'Отмена',
      onclick: () => {
        state.placing = null;
        renderBanner();
      },
    }),
  );
  host.append(actions);
}

async function confirmPlacing(): Promise<void> {
  const placing = state.placing;
  if (!placing?.selected) return;
  try {
    if (placing.kind === 'found') {
      await cmd({ op: 'foundCity', x: placing.selected.x, y: placing.selected.y });
    } else {
      await cmd({
        op: 'migrate',
        worldId: placing.worldId,
        x: placing.selected.x,
        y: placing.selected.y,
      });
    }
    state.placing = null;
    renderBanner();
  } catch (err) {
    pushToasts([{ kind: 'danger', text: (err as Error).message }]);
  }
}
