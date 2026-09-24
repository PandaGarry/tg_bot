import './styles.css';
import type { Snapshot } from '@ashfall/shared';
import { cmd, connect, on } from './net';
import { applyPatch, applySnapshot, hasPlayer, player, state } from './store';
import type { TabName } from './store';
import { initMap, mapEvents, renderMap, zoomBy } from './render/map';
import { clear, h, qs } from './ui/dom';
import { nav } from './ui/nav';
import { closeSheet, openSheet, refreshSheet } from './ui/sheet';
import { renderHud, updateHud } from './ui/hud';
import { renderCity, updateCity } from './ui/city';
import { renderArmy, updateArmy } from './ui/army';
import { renderReports } from './ui/reports';
import { renderRating } from './ui/rating';
import { renderBanner, renderMenu } from './ui/menu';
import { hideAuth, showAuth } from './ui/auth';
import { renderToasts } from './ui/toasts';

const TABS: { id: TabName; icon: string; label: string }[] = [
  { id: 'city', icon: '🏛', label: 'Город' },
  { id: 'army', icon: '⚔', label: 'Войско' },
  { id: 'reports', icon: '📜', label: 'Отчёты' },
  { id: 'rating', icon: '🏆', label: 'Рейтинг' },
  { id: 'menu', icon: '☰', label: 'Меню' },
];

let lastPanelUpdate = 0;
let lastSheetRefresh = 0;

function setupTabs(): void {
  const host = qs('#tabs');
  host.classList.remove('hidden');
  clear(host);
  for (const tab of TABS) {
    host.append(
      h('button', {
        class: 'tab',
        id: `tab-${tab.id}`,
        onclick: () => openTab(state.tab === tab.id ? null : tab.id),
      }, [
        h('span', { class: 'ic', text: tab.icon }),
        h('span', { text: tab.label }),
      ]),
    );
  }
  renderTabBadges();
}

function renderTabBadges(): void {
  const unread = state.snapshot?.reports.filter((r) => !r.read).length ?? 0;
  for (const tab of TABS) {
    const el = document.querySelector(`#tab-${tab.id}`) as HTMLElement | null;
    if (!el) continue;
    el.classList.toggle('active', state.tab === tab.id);
    const existing = el.querySelector('.badge');
    if (tab.id === 'reports' && unread > 0) {
      if (existing) existing.textContent = String(unread);
      else el.append(h('span', { class: 'badge', text: String(unread) }));
    } else if (existing) {
      existing.remove();
    }
  }
}

function openTab(tab: TabName | null): void {
  state.tab = tab;
  const panel = qs('#panel');
  if (tab === null) {
    panel.classList.add('hidden');
    renderTabBadges();
    return;
  }
  closeSheet();
  clear(panel);
  panel.classList.remove('hidden');
  const title = TABS.find((t) => t.id === tab)?.label ?? '';
  panel.append(
    h('div', { class: 'panel-head' }, [
      h('h2', { text: title }),
      h('button', { class: 'close-btn', text: 'Закрыть', onclick: () => openTab(null) }),
    ]),
  );
  const body = h('div', { class: 'panel-body' });
  panel.append(body);
  renderPanelBody(body);
  if (tab === 'reports') {
    void cmd({ op: 'markReportsRead' }).catch(() => {});
  }
  renderTabBadges();
}

function renderPanelBody(body: HTMLElement): void {
  switch (state.tab) {
    case 'city':
      renderCity(body);
      break;
    case 'army':
      renderArmy(body);
      break;
    case 'reports':
      renderReports(body);
      break;
    case 'rating':
      renderRating(body);
      break;
    case 'menu':
      renderMenu(body);
      break;
    default:
      break;
  }
}

let lastMenuRender = 0;

function updatePanel(now: number): void {
  if (now - lastPanelUpdate < 500) return;
  lastPanelUpdate = now;
  const body = document.querySelector('.panel-body') as HTMLElement | null;
  if (!body || !state.tab) return;
  if (state.tab === 'city') updateCity();
  if (state.tab === 'army') updateArmy();
  // меню перерисовываем редко: там таймер переселения, а не боевые часы
  if (state.tab === 'menu' && now - lastMenuRender > 10_000) {
    lastMenuRender = now;
    renderMenu(body);
  }
}

function onSnapshot(snapshot: Snapshot): void {
  applySnapshot(snapshot);
  hideAuth();
  qs('#tabs').classList.remove('hidden');
  renderHud();
  setupTabs();
  renderBanner();
  if (snapshot.player.x < 0 && !state.placing) {
    state.placing = {
      kind: 'found',
      worldId: snapshot.world.id,
      worldName: snapshot.world.name,
      size: snapshot.world.size,
      map: snapshot.map,
      occupied: new Set(snapshot.entities.map((e) => `${e.x}:${e.y}`)),
      selected: null,
    };
    state.camera = { x: snapshot.world.size / 2, y: snapshot.world.size / 2, zoom: 0.62 };
    renderBanner();
  }
  if (state.tab) {
    const body = document.querySelector('.panel-body') as HTMLElement | null;
    if (body) renderPanelBody(body);
  }
  renderTabBadges();
}

let lastReportsKey = '';
let lastLeadersKey = '';

function onPatch(): void {
  if (!hasPlayer()) return;
  updateHud();
  renderTabBadges();
  const body = document.querySelector('.panel-body') as HTMLElement | null;
  if (!body || !state.tab) return;
  // перерисовываем только при реальных изменениях, иначе рвутся скролл и клики
  if (state.tab === 'reports') {
    const key = state.snapshot!.reports.map((r) => r.id).join(',');
    if (key !== lastReportsKey) {
      lastReportsKey = key;
      renderReports(body);
    }
  } else if (state.tab === 'rating') {
    const key = state.snapshot!.leaders.map((r) => `${r.id}:${r.power}:${r.kvkEmber}`).join(',');
    if (key !== lastLeadersKey) {
      lastLeadersKey = key;
      renderRating(body);
    }
  }
}

function setupMapButtons(): void {
  const host = h('div', { class: 'map-buttons' }, [
    h('button', { class: 'map-btn', text: '＋', onclick: () => zoomBy(1.35) }),
    h('button', { class: 'map-btn', text: '－', onclick: () => zoomBy(1 / 1.35) }),
    h('button', {
      class: 'map-btn',
      text: '⌂',
      onclick: () => {
        if (!hasPlayer()) return;
        state.camera.x = player().x;
        state.camera.y = player().y;
      },
    }),
  ]);
  document.querySelector('#app')!.append(host);

  const coords = h('div', { class: 'coords', id: 'coords', text: '' });
  document.querySelector('#app')!.append(coords);
}

function loop(now: number): void {
  renderMap();
  if (hasPlayer()) {
    updateHud();
    updatePanel(now);
    if (now - lastSheetRefresh > 1000) {
      lastSheetRefresh = now;
      refreshSheet();
    }
  }
  renderToasts();
  const connecting = qs('#connecting');
  connecting.classList.toggle('hidden', !state.connecting);
  const coords = document.querySelector('#coords') as HTMLElement | null;
  if (coords && hasPlayer()) {
    coords.textContent = `${state.snapshot!.world.name} · ${Math.round(state.camera.x)}, ${Math.round(state.camera.y)}`;
  }
  requestAnimationFrame(loop);
}

function boot(): void {
  // отладочный доступ к состоянию: им пользуются скрипты скриншотов и тестов
  (globalThis as unknown as Record<string, unknown>).__ashfall = state;
  initMap(qs('#map'));
  setupMapButtons();

  nav.openTab = openTab;
  nav.closeSheet = closeSheet;
  nav.refresh = () => {
    renderHud();
    renderTabBadges();
  };
  nav.sendMarch = (kind, targetId, troops) => cmd({ op: 'march', kind, targetId, troops });

  mapEvents.onSelectEntity = (id) => {
    if (!id) {
      closeSheet();
      return;
    }
    const entity = state.snapshot?.entities.find((e) => e.id === id);
    if (entity) openSheet(entity, { x: entity.x, y: entity.y });
  };
  mapEvents.onTileTap = () => renderBanner();

  on('snapshot', (snapshot) => onSnapshot(snapshot as Snapshot));
  on('patch', (patch) => {
    applyPatch(patch as never);
    onPatch();
  });
  on('auth', (ok) => {
    if (!ok) showAuth();
  });

  const token = localStorage.getItem('ashfall.token');
  if (token) state.token = token;
  connect();

  // если сервер не ответил за 2.5 с — показываем экран входа
  setTimeout(() => {
    if (!hasPlayer()) showAuth();
  }, 2500);

  requestAnimationFrame(loop);
}

boot();
