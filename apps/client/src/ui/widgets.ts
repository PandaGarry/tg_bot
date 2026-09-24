import { RESOURCE_META, fmt } from '../store';
import { h } from './dom';
import { iconEl } from './icons';

/** «🔥360», но SVG: ресурс + число одной строкой. */
export function resAmount(key: keyof typeof RESOURCE_META | string, amount: number, lack = false): HTMLElement {
  const icon = (RESOURCE_META as Record<string, { icon: string }>)[key]?.icon ?? 'info';
  return h('span', { class: lack ? 'rc no' : 'rc' }, [iconEl(icon, 'ic-s'), h('span', { text: fmt(amount) })]);
}

/** «360 1.2k 40» с иконками для списка пар [ресурс, число]. */
export function resJoin(pairs: [keyof typeof RESOURCE_META | string, number][]): (HTMLElement | string)[] {
  const out: (HTMLElement | string)[] = [];
  let first = true;
  for (const [key, value] of pairs) {
    if (!value) continue;
    if (!first) out.push(' ');
    out.push(resAmount(key, value));
    first = false;
  }
  if (first) out.push('—');
  return out;
}

/** Строка «метка — значение», где значение может содержать иконки. */
export function kv(label: string, value: string | (HTMLElement | string)[]): HTMLElement {
  const nodes = typeof value === 'string' ? [h('span', { text: value })] : [h('span', { class: 'rc-row' }, value)];
  return h('div', { class: 'kv-row' }, [h('span', { class: 'muted', text: label }), ...nodes]);
}

/** Строка с членами войска: «120 Щитоносцы, 40 Лучники». */
export function troopsInline(parts: [string, { icon: string; count: number }][]): (HTMLElement | string)[] {
  const out: (HTMLElement | string)[] = [];
  let first = true;
  for (const [name, meta] of parts) {
    if (meta.count <= 0) continue;
    if (!first) out.push(', ');
    out.push(iconEl(meta.icon, 'ic-s'), ` ${meta.count} ${name}`);
    first = false;
  }
  if (first) out.push('нет');
  return out;
}
