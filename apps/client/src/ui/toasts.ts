import { state } from '../store';
import { clear, h, qs } from './dom';
import { iconEl } from './icons';

const KIND_ICON: Record<string, string> = {
  success: 'check',
  danger: 'warn',
  warning: 'warn',
  info: 'info',
};

export function renderToasts(): void {
  const host = qs('#toasts');
  const now = Date.now();
  const alive = state.toasts.filter((t) => now - t.at < 4200);
  if (alive.length !== state.toasts.length) state.toasts = alive;
  clear(host);
  for (const t of alive.slice(-3)) {
    host.append(h('div', { class: `toast ${t.kind}` }, [
      iconEl(KIND_ICON[t.kind] ?? 'info', 'ic-s'),
      h('span', { text: t.text }),
    ]));
  }
}
