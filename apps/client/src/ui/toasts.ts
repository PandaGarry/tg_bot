import { state } from '../store';
import { clear, h, qs } from './dom';

export function renderToasts(): void {
  const host = qs('#toasts');
  const now = Date.now();
  const alive = state.toasts.filter((t) => now - t.at < 4200);
  if (alive.length !== state.toasts.length) state.toasts = alive;
  clear(host);
  for (const t of alive.slice(-3)) {
    host.append(h('div', { class: `toast ${t.kind}`, text: t.text }));
  }
}
