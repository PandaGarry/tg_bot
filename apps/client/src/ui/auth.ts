import { HOUSES, LORE } from '@ashfall/rules';
import type { HouseKey } from '@ashfall/rules';
import { cmd, setServerBase } from '../net';
import { HOUSE_ICON } from '../store';
import { clear, h, qs } from './dom';
import { iconEl } from './icons';

let nick = '';
let house: HouseKey = 'order';
let serverInput: HTMLInputElement | null = null;

function currentServer(): string {
  const params = new URLSearchParams(location.search).get('server');
  const stored = (() => {
    try {
      return localStorage.getItem('ashfall.server');
    } catch {
      return null;
    }
  })();
  const fromGlobal = (globalThis as Record<string, unknown>).__ASHFALL_SERVER__ as string | undefined;
  return params ?? stored ?? fromGlobal ?? location.origin;
}

export function showAuth(): void {
  const host = qs('#auth');
  host.classList.remove('hidden');
  const saved = localStorage.getItem('ashfall.nick');
  if (saved) nick = saved;
  render(host);
}

export function hideAuth(): void {
  qs('#auth').classList.add('hidden');
}

function render(host: HTMLElement): void {
  clear(host);
  host.append(
    h('h1', { class: 'game-title', text: LORE.title }),
    h('div', { class: 'game-sub', text: LORE.subtitle }),
  );

  const lore = h('div', { class: 'card' });
  for (const paragraph of LORE.intro) lore.append(h('p', { class: 'lore', text: paragraph }));
  host.append(lore);

  const input = h('input', {
    class: 'text',
    placeholder: 'Имя правителя',
    value: nick,
    maxlength: '18',
    oninput: (e: Event) => {
      nick = (e.target as HTMLInputElement).value;
    },
  }) as HTMLInputElement;
  host.append(input);

  const houses = h('div', { class: 'houses' });
  for (const key of Object.keys(HOUSES) as HouseKey[]) {
    const info = HOUSES[key];
    houses.append(
      h('div', { class: `house${key === house ? ' active' : ''}`, onclick: () => { house = key; render(host); } }, [
        h('div', { class: 'h-ic' }, [iconEl(HOUSE_ICON[key] ?? 'crown')]),
        h('div', {}, [
          h('div', { class: 'h-name', text: info.name }),
          h('div', { class: 'muted', text: info.bonus }),
        ]),
      ]),
    );
  }
  host.append(houses);

  const button = h('button', {
    class: 'primary',
    text: 'Войти в мир',
    onclick: () => {
      void enter(button as HTMLButtonElement);
    },
  }) as HTMLButtonElement;
  host.append(button);

  host.append(
    h('div', {
      class: 'muted',
      style: 'text-align:center;margin-top:6px',
      text: 'Имя — это и есть аккаунт: вернуться можно с любого устройства.',
    }),
  );

  host.append(
    h('div', { class: 'card' }, [
      h('div', { class: 'muted', text: 'Не подключается? Укажи адрес сервера вручную:' }),
      h('div', { class: 'count-input' }, [
        (serverInput = h('input', {
          class: 'text',
          placeholder: 'https://адрес-сервера',
          value: currentServer(),
        }) as HTMLInputElement),
      ]),
      h('button', {
        class: 'ghost',
        text: 'Подключиться',
        onclick: () => {
          const value = (serverInput as HTMLInputElement).value.trim();
          if (value) setServerBase(value);
        },
      }),
    ]),
  );
}

async function enter(btn: HTMLButtonElement): Promise<void> {
  if (nick.trim().length < 2) {
    btn.textContent = 'Имя слишком короткое';
    setTimeout(() => (btn.textContent = 'Войти в мир'), 1800);
    return;
  }
  btn.disabled = true;
  btn.textContent = 'Обоз в пути…';
  try {
    await cmd({ op: 'register', nick: nick.trim(), house });
    localStorage.setItem('ashfall.nick', nick.trim());
    hideAuth();
  } catch (err) {
    btn.disabled = false;
    btn.textContent = (err as Error).message;
    setTimeout(() => (btn.textContent = 'Войти в мир'), 2400);
  }
}
