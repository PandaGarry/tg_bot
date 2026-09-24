import { h } from './dom';

/**
 * Единый набор иконок игры: рисуем сами, без эмодзи —
 * эмодзи зависят от платформы, а в headless-среде не рисуются вовсе.
 * Стиль — обводка currentColor, чтобы цвет брался из CSS-контекста.
 */
const PATHS: Record<string, string> = {
  // ресурсы
  wheat:
    '<path d="M12 21V8"/><path d="M12 13.5c-2.4 0-4.1-1.4-4.7-3.7 2.4 0 4.1 1.4 4.7 3.7Z"/><path d="M12 13.5c2.4 0 4.1-1.4 4.7-3.7-2.4 0-4.1 1.4-4.7 3.7Z"/><path d="M12 8.7c-2 0-3.5-1.2-4-3.2 2 0 3.5 1.2 4 3.2Z"/><path d="M12 8.7c2 0 3.5-1.2 4-3.2-2 0-3.5 1.2-4 3.2Z"/><path d="M9 2.5l1.6 2M15 2.5l-1.6 2"/>',
  wood:
    '<path d="M3.5 13.5L12 5"/><circle cx="12.8" cy="5" r="1.7"/><path d="M5 19.5l9.5-8.5"/><circle cx="15.3" cy="11" r="1.7"/><path d="M3.5 13.5v6"/><path d="M12 5a6.5 6.5 0 0 0-6.5 6.5"/>',
  rock:
    '<path d="M4 18.5 7.5 7.5 12 4.8l6.5 5-1.2 8.7H4Z"/><path d="M12 4.8 9.8 12l3.7 6.5"/><path d="M7.5 7.5 9.8 12 4 14.6"/>',
  iron:
    '<path d="m3.5 20.5 9.5-9.5"/><path d="M11.5 4.5c3.5.8 6 3 7.5 7-3.2-1.6-6.5-2.2-10-1.6.8-2.4 1.6-4.2 2.5-5.4Z"/>',
  flame:
    '<path d="M12 21.5c-3.9 0-6.5-2.6-6.5-6.3 0-4.7 3.7-7.3 4.4-10.7 1.9 1.9 3 3.9 2.6 6.6 1-.5 1.9-1.7 2-3.6 1.9 2 3.9 4.6 3.9 7.7 0 3.7-2.6 6.3-6.4 6.3Z"/><path d="M12 21.5c-1.8 0-3-1.3-3-3.1 0-2 1.6-3 2-4.6.9 1 1.6 2 1.4 3.4.6-.3 1-1 1.1-1.9 1 1.1 1.5 2.1 1.5 3.1 0 1.8-1.2 3.1-3 3.1Z"/>',
  // военное
  swords:
    '<path d="M4 4.5 13 13.5"/><path d="M20 4.5l-9 9"/><path d="m5.5 19.5 5-5"/><path d="m18.5 19.5-5-5"/><path d="m4 13-1 3 3-1M20 13l1 3-3-1"/>',
  shield:
    '<path d="M12 3.2c1.5.5 3.7 1 6.8 1.3v6c0 5-3.5 8-6.8 9.3-3.3-1.3-6.8-4.3-6.8-9.3v-6c3.1-.3 5.3-.8 6.8-1.3Z"/>',
  bow:
    '<path d="M7 3c4.5 2 7.5 5.5 7.5 9S11.5 19 7 21"/><path d="M7 3v18"/><path d="M4 12h15.5"/><path d="m19.5 12-2.3-1.3M19.5 12l-2.3 1.3"/>',
  horse:
    '<path d="M8 21v-2.2c0-1.4 1-2 1-3.8 0-1.7-1.4-2.3-2.2-3L9.5 7C10.7 4.6 12.7 3 15.2 3l.7 2.4 2.2 2c.4 1 0 2-1 2.4l-1.6.6V14c0 2.4 1 3.2 1.5 4.8V21"/><path d="M6 21h12"/><circle cx="12.9" cy="7" r=".8" fill="currentColor" stroke="none"/><path d="M15.2 3.2 13.4 5.6M16.8 4.8 15 7.2"/>',
  // здания/объекты
  castle:
    '<path d="M5 21V9h2.5V6H10v3h4V6h2.5v3H19v12h-4.6v-3.8a2.4 2.4 0 0 0-4.8 0V21H5Z"/><path d="M7.5 4.2V6M16.5 4.2V6"/>',
  tree:
    '<path d="M12 2.5 6.7 10h2.8L5 16h14l-4.5-6h2.8L12 2.5Z"/><path d="M12 16v5.5"/>',
  bricks:
    '<rect x="3.5" y="5.5" width="17" height="13" rx="1"/><path d="M3.5 10h17M3.5 14.5h17M8.5 5.5V10M15.5 5.5V10M12 10v4.5M7.5 14.5v4M16.5 14.5v4"/>',
  crate:
    '<path d="m12 3 8.5 4.3v9.4L12 21l-8.5-4.3V7.3L12 3Z"/><path d="M3.5 7.3 12 11.7l8.5-4.4"/><path d="M12 11.7V21"/>',
  tower:
    '<path d="M8 21v-4c0-1.5 1-2.5 1-6V8.5H7V5h3.5v1.7h3V5H17v3.5h-2V11c0 3.5 1 4.5 1 6v4"/><path d="M11 21v-2.5c0-.8.4-1.2 1-1.2s1 .4 1 1.2V21"/>',
  skull:
    '<path d="M12 3.5c-4.1 0-7 2.8-7 6.6 0 2.2 1.1 3.7 2.3 4.4V17c0 1 .8 1.9 1.9 1.9h5.6c1 0 1.9-.9 1.9-1.9v-2.5c1.2-.7 2.3-2.2 2.3-4.4 0-3.8-2.9-6.6-7-6.6Z"/><circle cx="9.2" cy="10.3" r="1.3" fill="currentColor" stroke="none"/><circle cx="14.8" cy="10.3" r="1.3" fill="currentColor" stroke="none"/><path d="m12 12.4-1.1 2h2.2l-1.1-2Z" fill="currentColor" stroke="none"/><path d="M9.5 19v1.5M14.5 19v1.5"/>',
  // действия
  eye:
    '<path d="M2.5 12c3-5.2 6.7-7 9.5-7s6.5 1.8 9.5 7c-3 5.2-6.7 7-9.5 7s-6.5-1.8-9.5-7Z"/><circle cx="12" cy="12" r="2.8"/>',
  search:
    '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5.5 5.5"/>',
  crosshair:
    '<circle cx="12" cy="12" r="6.4"/><circle cx="12" cy="12" r="2.3"/><path d="M12 2.5v2.8M12 18.7v2.8M2.5 12h2.8M18.7 12h2.8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  close: '<path d="m5.5 5.5 13 13M18.5 5.5l-13 13"/>',
  check: '<path d="m4.5 12.5 5 5L19.5 6.5"/>',
  warn:
    '<path d="M12 4 2.8 19.5h18.4L12 4Z"/><path d="M12 10v4"/><circle cx="12" cy="16.9" r=".9" fill="currentColor" stroke="none"/>',
  info:
    '<circle cx="12" cy="12" r="8.6"/><path d="M12 11.2v5"/><circle cx="12" cy="8.2" r=".95" fill="currentColor" stroke="none"/>',
  // разное
  globe:
    '<circle cx="12" cy="12" r="8.6"/><ellipse cx="12" cy="12" rx="4.3" ry="8.6"/><path d="M3.6 9h16.8M3.6 15h16.8"/>',
  trophy:
    '<path d="M7.5 4.5h9V9a4.5 4.5 0 0 1-9 0V4.5Z"/><path d="M7.5 6H4c0 2.6 1.4 4 3.5 4M16.5 6H20c0 2.6-1.4 4-3.5 4"/><path d="M12 13.6v3M9.2 16.6h5.6M8 20.6h8"/>',
  scroll:
    '<rect x="5" y="4.5" width="14" height="15.5" rx="2"/><path d="M9 9.5h6M9 13h6M9 16.5h3.6"/>',
  menu: '<path d="M4 6.5h16M4 12h16M4 17.5h16"/>',
  door:
    '<path d="M13.5 3.5H6.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h7"/><path d="M11 12h9.5"/><path d="m17 8.5 3.5 3.5-3.5 3.5"/>',
  crown:
    '<path d="M4 16.5 3 7.5l4.8 3.6L12 5l4.2 6.1L21 7.5l-1 9H4Z"/><path d="M5.5 20h13"/>',
  peak: '<path d="M3 19 9.5 6.5l4 7.5 3-4.5L21 19H3Z"/><path d="M9.5 6.5 11 9l-1.5 1.7L8 9"/>',
  scales:
    '<path d="M12 4v15.5M9 19.5h6"/><path d="M5 6.5h14"/><path d="M6.5 6.5 4 12.5h5L6.5 6.5ZM17.5 6.5 15 12.5h5l-2.5-6Z"/><path d="M4 12.5a2.5 2.5 0 0 0 5 0M15 12.5a2.5 2.5 0 0 0 5 0"/>',
  bolt: '<path d="M13.2 2.5 4.5 14h5.6L9 21.5l8.7-11.5h-5.6l1.1-7.5Z"/>',
  clock:
    '<circle cx="12" cy="12" r="8.4"/><path d="M12 7.4V12l3.2 2.1"/>',
  hammer:
    '<path d="M13.5 4.5c1.8.6 3.2 1.8 4.2 3.5l-2.6 2.6-4.6-4.6 3-1.5Z"/><path d="m3.5 20.5 7.9-7.9 2.6 2.6-7.9 7.9a1.8 1.8 0 0 1-2.6-2.6Z"/>',
  book:
    '<path d="M4 5.5C6 4.5 8.5 4.5 12 6c3.5-1.5 6-1.5 8-.5v13c-2-1-4.5-1-8 .5-3.5-1.5-6-1.5-8-.5v-13Z"/><path d="M12 6v13"/>',
  bell:
    '<path d="M6.5 9.3C6.5 6.2 8.9 3.5 12 3.5s5.5 2.7 5.5 5.8c0 3.7.9 5.1 1.4 5.8H5.1c.5-.7 1.4-2.1 1.4-5.8Z"/><path d="M10.2 18.5a1.9 1.9 0 0 0 3.6 0"/>',
  coin:
    '<circle cx="12" cy="12" r="8.2"/><path d="M12 7v10M15.5 9.2c-.6-1-1.9-1.7-3.5-1.7-2 0-3.5 1-3.5 2.6 0 3.6 7 1.6 7 5.3 0 1.6-1.5 2.6-3.5 2.6-1.6 0-2.9-.7-3.5-1.7"/>',
};

/** inline-SVG по имени; размер наследуется от font-size текущего контекста. */
export function iconSvg(name: string): string {
  const body = PATHS[name] ?? PATHS.info;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

/** DOM-узел `<span class="ic">…</span>`; extraClass — доп. класс (ic-lg и т.п.). */
export function iconEl(name: string, extraClass = ''): HTMLElement {
  return h('span', { class: extraClass ? `ic ${extraClass}` : 'ic', html: iconSvg(name) });
}
