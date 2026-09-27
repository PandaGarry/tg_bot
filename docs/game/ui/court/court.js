/* Двор-конструктор: слои, сетка, спрайты, камера, стройка. Без зависимостей, ES2020. */
(() => {
  'use strict';

  // ---------- геометрия мира ----------
  // Мир измеряется в пикселях подложки 1376×768 (камера масштабирует всё вместе).
  // Площадка — ромб N×N клеток, ортографическая диметрия: ромб клетки W×H (≈1,72:1).
  const VW = 1376, VH = 768;
  const N = 14, W = 1000 / N, H = 580 / N;
  const TOP = { x: 712, y: 110 }; // верхний угол площадки (угол клетки 0,0)

  // Угол сетки (i, j) → точка мира. Ось x идёт вправо-вниз по экрану, ось y — влево-вниз.
  const P = (i, j) => ({ x: TOP.x + (i - j) * W / 2, y: TOP.y + (i + j) * H / 2 });
  // Точка мира → дробные координаты клетки.
  const toCell = (wx, wy) => {
    const u = (wx - TOP.x) / (W / 2), v = (wy - TOP.y) / (H / 2);
    return { i: (u + v) / 2, j: (v - u) / 2 };
  };

  // ---------- каталог зданий ----------
  // patch — ширина ромба-подошвы в пикселях спрайта (по нему спрайт масштабируется под след),
  // tip — нижний угол подошвы в пикселях спрайта (он встаёт на нижний угол следа).
  const TYPES = {
    keep:      { name: 'Двор',        fw: 3, fh: 3, day: 'a-01', night: 'a-night-01', sw: 591, patch: 585, tip: [295, 563], cat: null },
    sawmill:   { name: 'Лесопилка',   fw: 2, fh: 2, day: 'd-01', night: 'd-night-01', sw: 605, patch: 600, tip: [302, 513], cat: 'eco', desc: 'Дерево. +40 в час на 1-м уровне', cost: [['wood', 300], ['stone', 120]], time: '12 мин', cap: '1 / 2' },
    quarry:    { name: 'Каменоломня', fw: 2, fh: 2, day: 'a-03', night: 'a-night-03', sw: 394, patch: 388, tip: [197, 321], cat: 'eco', desc: 'Камень. +30 в час', cost: [['wood', 400]], time: '20 мин', cap: '0 / 1' },
    farm:      { name: 'Ферма',       fw: 2, fh: 2, day: 'b-01', night: 'b-night-01', sw: 593, patch: 588, tip: [296, 367], cat: 'eco', desc: 'Грибы для паутины и навыков лорда', cost: [['wood', 700], ['stone', 200]], time: '40 мин', cap: '1 / 1' },
    pen:       { name: 'Загон',       fw: 3, fh: 2, day: 'b-02', night: 'b-night-02', sw: 517, patch: 512, tip: [310, 357], cat: 'eco', desc: 'Мясо. Животные, своим ходом', cost: [['wood', 500]], time: '25 мин', cap: '1 / 1' },
    warehouse: { name: 'Склад',       fw: 2, fh: 2, day: 'c-03', night: 'c-night-03', sw: 464, patch: 459, tip: [232, 539], cat: 'eco', desc: 'Предел мяса, дерева, камня и металла', cost: [['wood', 600], ['stone', 300]], time: '30 мин', cap: '0 / 1' },
    barracks:  { name: 'Казарма',     fw: 3, fh: 3, day: 'b-03', night: 'b-night-03', sw: 613, patch: 608, tip: [306, 501], cat: 'war', desc: 'Тиры войска', cost: [['wood', 400]], time: '2 мин', cap: '1 / 1' },
    infirmary: { name: 'Лазарет',     fw: 2, fh: 2, day: 'c-02', night: 'c-night-02', sw: 514, patch: 509, tip: [257, 492], cat: 'war', desc: 'Раненые защитника. Сверх мест — смерть', cost: [['wood', 300]], time: '1 мин', cap: '0 / 1' },
    march:     { name: 'Пункт марша', fw: 2, fh: 2, day: 'd-02', night: 'd-night-02', sw: 571, patch: 566, tip: [285, 562], cat: 'war', desc: 'Один марш на здание. Уровень задаёт, сколько войска уходит', cost: [['wood', 800], ['stone', 400]], time: '1 ч', cap: '1 / 5', lock: 'Нужен двор 5-го уровня' },
    web:       { name: 'Паутина',     fw: 2, fh: 2, day: 'c-01', night: 'c-night-01', sw: 458, patch: 453, tip: [229, 606], cat: 'sci', desc: 'Три ветки исследований', cost: [['wood', 500]], time: '3 мин', cap: '0 / 1' },
    site:      { name: 'Стройка',     fw: 2, fh: 2, day: 'd-03', night: 'd-night-03', sw: 606, patch: 601, tip: [303, 501], cat: null },
  };
  const CATS = { eco: 'Хозяйство', war: 'Война', sci: 'Наука', deco: 'Украшения' };

  // Стартовые состояния (в игре — из состояния игрока на сервере: тип, уровень, клетка).
  const STATES = {
    empty: [],
    day1: [{ id: 'keep', type: 'keep', x: 3, y: 3, level: 1 }],
    built: [
      { id: 'keep', type: 'keep', x: 3, y: 3, level: 7 },
      { id: 'sawmill1', type: 'sawmill', x: 7, y: 2, level: 6 },
      { id: 'quarry1', type: 'quarry', x: 10, y: 3, level: 5 },
      { id: 'farm1', type: 'farm', x: 1, y: 8, level: 4 },
      { id: 'pen1', type: 'pen', x: 8, y: 9, level: 5 },
      { id: 'barracks1', type: 'barracks', x: 4, y: 10, level: 6 },
      { id: 'web1', type: 'web', x: 0, y: 5, level: 4 },
      { id: 'infirmary1', type: 'infirmary', x: 11, y: 7, level: 3 },
      { id: 'warehouse1', type: 'warehouse', x: 7, y: 6, level: 5, building: { name: 'Склад', left: '12:40', v: 62 } },
      { id: 'march1', type: 'march', x: 11, y: 10, level: 2 },
    ],
  };

  // ---------- DOM и параметры ----------
  const q = new URLSearchParams(location.search);
  const stage = document.getElementById('stage');
  const viewport = document.getElementById('viewport');
  const court = document.getElementById('court');
  const ground = document.getElementById('ground');
  const svg = document.getElementById('gridsvg');
  const layer = document.getElementById('buildings');
  const selbub = document.getElementById('selbub');
  const ghostctl = document.getElementById('ghostctl');
  const cardsEl = document.getElementById('cards');
  const hint = document.getElementById('hint');

  const stateName = q.get('state') || 'built';
  let buildings = JSON.parse(JSON.stringify(STATES[stateName] || STATES.built));
  let night = q.get('time') ? q.get('time') === 'night' : (() => { const h = new Date().getHours(); return h < 7 || h >= 18; })();
  let buildMode = q.get('mode') === 'build';
  if (q.get('grid') === '1') stage.classList.add('show-grid');

  // ---------- камера ----------
  const cam = { z: 1, tx: 0, ty: 0 };
  const applyCam = () => { court.style.transform = `translate(${cam.tx}px,${cam.ty}px) scale(${cam.z})`; placeOverlays(); };
  const clampCam = () => {
    cam.z = Math.min(2.2, Math.max(0.85, cam.z));
    const ww = VW * cam.z, wh = VH * cam.z;
    const lo = (v, w) => Math.min(0, v - w), hi = (v, w) => Math.max(0, v - w);
    cam.tx = Math.min(hi(VW, ww), Math.max(lo(VW, ww), cam.tx));
    cam.ty = Math.min(hi(VH, wh), Math.max(lo(VH, wh), cam.ty));
  };
  // Поставить точку мира (wx, wy) в точку экрана (sx, sy) при зуме z.
  const lookAt = (wx, wy, sx, sy, z) => { cam.z = z; cam.tx = sx - wx * cam.z; cam.ty = sy - wy * cam.z; clampCam(); applyCam(); };
  const zoomAt = (sx, sy, factor) => {
    const z0 = cam.z, z1 = Math.min(2.2, Math.max(0.85, z0 * factor));
    const wx = (sx - cam.tx) / z0, wy = (sy - cam.ty) / z0;
    cam.z = z1; cam.tx = sx - wx * z1; cam.ty = sy - wy * z1; clampCam(); applyCam();
  };
  const screenToWorld = (sx, sy) => ({ x: (sx - cam.tx) / cam.z, y: (sy - cam.ty) / cam.z });
  const worldToScreen = (wx, wy) => ({ x: wx * cam.z + cam.tx, y: wy * cam.z + cam.ty });
  const stageRect = () => stage.getBoundingClientRect();
  const stageScale = () => stageRect().width / VW; // если стадия отмасштабирована под экран

  // ---------- сетка ----------
  const NS = 'http://www.w3.org/2000/svg';
  const poly = (pts, cls) => { const el = document.createElementNS(NS, 'polygon'); el.setAttribute('points', pts.map(p => `${p.x},${p.y}`).join(' ')); if (cls) el.setAttribute('class', cls); return el; };
  const fpPoints = (x, y, fw, fh) => [P(x, y), P(x + fw, y), P(x + fw, y + fh), P(x, y + fh)];
  // Линии сетки двухцветные (светлая подложка + тёмная нить), чтобы читались и на снегу, и на земле.
  const gLines = document.createElementNS(NS, 'g'); gLines.setAttribute('class', 'lines');
  for (const cls of ['back', 'front']) {
    const g = document.createElementNS(NS, 'g'); g.setAttribute('class', cls);
    for (let i = 0; i <= N; i++) {
      for (const [a, b] of [[P(i, 0), P(i, N)], [P(0, i), P(N, i)]]) {
        const l = document.createElementNS(NS, 'line');
        l.setAttribute('x1', a.x); l.setAttribute('y1', a.y); l.setAttribute('x2', b.x); l.setAttribute('y2', b.y);
        if (i === 0 || i === N) l.setAttribute('class', 'edge');
        g.appendChild(l);
      }
    }
    gLines.appendChild(g);
  }
  const gOcc = document.createElementNS(NS, 'g'); gOcc.setAttribute('class', 'occ');
  const gFx = document.createElementNS(NS, 'g');
  svg.append(gLines, gOcc, gFx);

  // ---------- состояние клеток ----------
  const occupied = (exceptId) => {
    const m = new Set();
    for (const b of buildings) {
      if (b.id === exceptId) continue;
      const t = TYPES[b.type];
      for (let i = 0; i < t.fw; i++) for (let j = 0; j < t.fh; j++) m.add(`${b.x + i},${b.y + j}`);
    }
    return m;
  };
  const canPlace = (type, x, y, exceptId) => {
    const t = TYPES[type];
    if (x < 0 || y < 0 || x + t.fw > N || y + t.fh > N) return false;
    const occ = occupied(exceptId);
    for (let i = 0; i < t.fw; i++) for (let j = 0; j < t.fh; j++) if (occ.has(`${x + i},${y + j}`)) return false;
    return true;
  };
  const freeCells = () => N * N - occupied().size;

  // ---------- спрайты ----------
  const spriteSrc = (t) => `sprites/${night ? t.night : t.day}.png`;
  const placeSprite = (el, type, x, y) => {
    const t = TYPES[type];
    const s = ((t.fw + t.fh) * W / 2) / t.patch;
    const bottom = P(x + t.fw, y + t.fh);
    el.style.left = `${bottom.x - t.tip[0] * s}px`;
    el.style.top = `${bottom.y - t.tip[1] * s}px`;
    el.style.width = `${t.sw * s}px`;
    el.style.zIndex = String(100 + (x + t.fw + y + t.fh) * 10 + (x + t.fw)); // порядок по нижнему углу следа
    const hit = el.querySelector('.hit');
    if (hit) { // зона нажатия — подошва + корпус, в пикселях спрайта → проценты ширины
      hit.style.left = '8%'; hit.style.right = '8%'; hit.style.top = '10%'; hit.style.bottom = '4%';
    }
  };
  const render = () => {
    layer.innerHTML = '';
    gOcc.innerHTML = '';
    for (const b of buildings) {
      const t = TYPES[b.type];
      const el = document.createElement('div');
      el.className = 'b' + (b.id === selectedId ? ' selected' : '') + (b.id === moving?.id ? ' moving' : '');
      el.dataset.id = b.id;
      const img = document.createElement('img');
      img.src = spriteSrc(b.building ? TYPES.site : t); img.alt = t.name; img.draggable = false;
      const hit = document.createElement('div'); hit.className = 'hit';
      el.append(img, hit);
      if (b.building) {
        const lbl = document.createElement('div'); lbl.className = 'lbl site';
        lbl.innerHTML = `${b.building.name} · ${b.building.left}<span class="bar"><i style="--v:${b.building.v}%"></i></span>`;
        el.appendChild(lbl);
      } else if (b.pin) {
        const pin = document.createElement('div'); pin.className = 'pin';
        pin.innerHTML = `<img src="../hud/icons/${b.pin}.png" alt="">`;
        el.appendChild(pin);
      }
      placeSprite(el, b.building ? 'site' : b.type, b.x, b.y);
      if (b.building) { // след стройки — по размеру настоящего здания
        const s = ((TYPES.site.fw + TYPES.site.fh) * W / 2) / TYPES.site.patch;
        const s2 = ((t.fw + t.fh) * W / 2) / TYPES.site.patch;
        el.style.width = `${TYPES.site.sw * s2}px`;
        const bottom = P(b.x + t.fw, b.y + t.fh);
        el.style.left = `${bottom.x - TYPES.site.tip[0] * s2}px`;
        el.style.top = `${bottom.y - TYPES.site.tip[1] * s2}px`;
        void s;
      }
      layer.appendChild(el);
      gOcc.appendChild(poly(fpPoints(b.x, b.y, t.fw, t.fh)));
    }
    if (ghostEl) layer.appendChild(ghostEl); // призрак живёт в том же слое, но не перерисовывается
    const fc = document.getElementById('free-cells'); if (fc) fc.textContent = String(freeCells());
    placeOverlays();
  };

  // ---------- призрак (постановка и перестановка) ----------
  let ghost = null; // {type, x, y, id?}  id — если переставляем существующее
  let ghostEl = null, ghostFp = null;
  let moving = null;
  const showGhost = (type, x, y, id) => {
    hideGhost(false);
    ghost = { type, x, y, id: id || null };
    moving = id ? buildings.find(b => b.id === id) : null;
    ghostEl = document.createElement('div'); ghostEl.className = 'b ghost';
    ghostEl.innerHTML = `<img src="${spriteSrc(TYPES[type])}" alt="">`;
    layer.appendChild(ghostEl);
    ghostFp = poly(fpPoints(x, y, TYPES[type].fw, TYPES[type].fh), 'ghostfp');
    gFx.appendChild(ghostFp);
    ghostctl.hidden = false;
    render(); updateGhost();
    showHint(id ? 'Тяните здание на новое место, ✓ — оставить' : 'Тяните призрак на свободные клетки, ✓ — поставить');
  };
  const updateGhost = () => {
    if (!ghost) return;
    const t = TYPES[ghost.type];
    const ok = canPlace(ghost.type, ghost.x, ghost.y, ghost.id);
    placeSprite(ghostEl, ghost.type, ghost.x, ghost.y);
    ghostEl.classList.toggle('bad', !ok);
    ghostFp.setAttribute('points', fpPoints(ghost.x, ghost.y, t.fw, t.fh).map(p => `${p.x},${p.y}`).join(' '));
    ghostFp.setAttribute('class', 'ghostfp' + (ok ? '' : ' bad'));
    ghostctl.querySelector('.ok').disabled = !ok;
    placeOverlays();
  };
  const hideGhost = (rerender = true) => {
    ghost = null; moving = null;
    ghostEl?.remove(); ghostFp?.remove(); ghostEl = ghostFp = null;
    ghostctl.hidden = true;
    cardsEl.querySelectorAll('.card.picked').forEach(c => c.classList.remove('picked'));
    if (rerender) render();
  };
  const commitGhost = () => {
    if (!ghost || !canPlace(ghost.type, ghost.x, ghost.y, ghost.id)) return;
    if (ghost.id) {
      const b = buildings.find(b => b.id === ghost.id); b.x = ghost.x; b.y = ghost.y;
    } else {
      const t = TYPES[ghost.type];
      buildings.push({ id: `${ghost.type}${Date.now() % 100000}`, type: ghost.type, x: ghost.x, y: ghost.y, level: 1, building: { name: t.name, left: t.time, v: 3 } });
    }
    save();
    hideGhost();
    showHint(ghost ? '' : 'Готово', 1200);
  };

  // ---------- выбор здания (обычный режим) ----------
  let selectedId = null;
  const select = (id) => { selectedId = id; render(); };
  const placeOverlays = () => {
    // пузырь над выбранным зданием
    const b = selectedId && buildings.find(b => b.id === selectedId);
    if (b && !buildMode && !ghost) {
      const t = TYPES[b.type];
      const el = layer.querySelector(`.b[data-id="${b.id}"]`);
      const top = el ? parseFloat(el.style.top) : 0;
      const mid = P(b.x + t.fw / 2, b.y + t.fh / 2);
      const s = worldToScreen(mid.x, top + 10);
      selbub.style.left = `${s.x}px`; selbub.style.top = `${s.y}px`;
      selbub.hidden = false;
      document.getElementById('selname').textContent = t.name;
      document.getElementById('sellvl').textContent = b.building ? 'строится' : `ур. ${b.level}`;
    } else selbub.hidden = true;
    // ✓ ✕ над призраком
    if (ghost && ghostEl) {
      const t = TYPES[ghost.type];
      const mid = P(ghost.x + t.fw / 2, ghost.y + t.fh / 2);
      const top = parseFloat(ghostEl.style.top);
      const s = worldToScreen(mid.x, top);
      ghostctl.style.left = `${s.x}px`; ghostctl.style.top = `${Math.max(60, s.y - 6)}px`;
    }
  };

  // ---------- режим стройки ----------
  const setBuild = (on) => {
    buildMode = on;
    stage.classList.toggle('build', on);
    selectedId = null;
    if (on) {
      // камера отъезжает и сдвигает площадку в свободную от панелей зону (слева вкладки, снизу карточки)
      lookAt(712, 400, 740, 318, 0.86);
      renderCards('eco');
      showHint('Тяните здания, чтобы переставить. «Поставить» на карточке — новое здание', 2600);
    } else {
      hideGhost(false);
      lookAt(712, 400, VW / 2, VH / 2, 1);
    }
    render();
  };
  const renderCards = (cat) => {
    cardsEl.innerHTML = '';
    document.querySelectorAll('.btabs .btab').forEach((b, i) => b.classList.toggle('on', ['eco', 'war', 'sci', 'deco'][i] === cat));
    const list = Object.entries(TYPES).filter(([, t]) => t.cat === cat);
    if (!list.length) { cardsEl.innerHTML = '<article class="card plaque"><div class="img"></div><h4>Пока пусто</h4><p>Украшения появятся позже — сюда лягут скамьи, костры, знамёна клана</p></article>'; return; }
    for (const [key, t] of list) {
      const a = document.createElement('article');
      a.className = 'card plaque' + (t.lock ? ' locked' : '');
      a.dataset.type = key;
      const cost = (t.cost || []).map(([r, v]) => `<i><img class="ic" src="../hud/icons/${r}.png" alt="">${v}</i>`).join('');
      a.innerHTML = `<div class="img"><img src="sprites/${t.day}.png" alt=""></div><h4>${t.name} <small>${t.cap || ''}</small></h4><p>${t.desc || ''}, след ${t.fw}×${t.fh}</p>`
        + (t.lock ? `<div class="lockrow"><img class="ic" src="../hud/icons/lock.png" alt="">${t.lock}</div>`
          : `<div class="cost">${cost}<span class="time">${t.time}</span></div><span class="go">Поставить</span>`);
      if (!t.lock) a.querySelector('.go').addEventListener('click', (e) => {
        e.stopPropagation();
        cardsEl.querySelectorAll('.card.picked').forEach(c => c.classList.remove('picked'));
        a.classList.add('picked');
        // призрак появляется в центре видимой части площадки, на ближайшей свободной клетке
        const c = screenToWorld(740, 300); const cc = toCell(c.x, c.y);
        const spot = nearestFree(key, Math.round(cc.i - t.fw / 2), Math.round(cc.j - t.fh / 2));
        showGhost(key, spot.x, spot.y);
      });
      cardsEl.appendChild(a);
    }
  };
  const nearestFree = (type, x0, y0) => {
    for (let r = 0; r < N; r++) for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      if (canPlace(type, x0 + dx, y0 + dy)) return { x: x0 + dx, y: y0 + dy };
    }
    return { x: Math.max(0, Math.min(N - TYPES[type].fw, x0)), y: Math.max(0, Math.min(N - TYPES[type].fh, y0)) };
  };

  // ---------- день / ночь ----------
  const setNight = (on) => {
    night = on;
    stage.classList.toggle('night', on);
    ground.src = on ? 'ground-night.jpg' : 'ground-day.jpg';
    document.getElementById('timeic').textContent = on ? '☀' : '☾';
    render();
    if (ghostEl) ghostEl.querySelector('img').src = spriteSrc(TYPES[ghost.type]);
  };

  // ---------- подсказка ----------
  let hintTimer = 0;
  const showHint = (text, ms = 2200) => {
    clearTimeout(hintTimer);
    if (!text) { hint.classList.remove('show'); return; }
    hint.textContent = text; hint.classList.add('show');
    hintTimer = setTimeout(() => hint.classList.remove('show'), ms);
  };

  // ---------- сохранение (прототип: localStorage; в игре — сервер) ----------
  const save = () => { if (!q.get('state')) try { localStorage.setItem('tdl-court', JSON.stringify(buildings)); } catch { /* ничего */ } };
  if (!q.get('state')) try { const s = localStorage.getItem('tdl-court'); if (s) buildings = JSON.parse(s); } catch { /* ничего */ }

  // ---------- указатель: панорама, зум, перетаскивание ----------
  const pointers = new Map();
  let gesture = null; // {kind:'pan'|'drag'|'pinch', ...}
  const pos = (e) => { const r = stageRect(), k = stageScale(); return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k }; };
  viewport.addEventListener('pointerdown', (e) => {
    viewport.setPointerCapture(e.pointerId);
    const p = pos(e); pointers.set(e.pointerId, p);
    if (pointers.size === 2) { // щипок
      const [a, b] = [...pointers.values()];
      gesture = { kind: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), z0: cam.z, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
      return;
    }
    const hitEl = e.target.closest?.('.b:not(.ghost)');
    const id = hitEl?.dataset.id;
    const w = screenToWorld(p.x, p.y); const c = toCell(w.x, w.y);
    if (ghost && (!id || id === ghost.id)) { // тянем призрак (палец может быть и рядом с ним)
      gesture = { kind: 'drag', di: c.i - ghost.x, dj: c.j - ghost.y, start: p, moved: false };
      return;
    }
    if (id && buildMode) { // в стройке здания тянутся сразу
      const b = buildings.find(b => b.id === id);
      showGhost(b.type, b.x, b.y, id);
      gesture = { kind: 'drag', di: c.i - b.x, dj: c.j - b.y, start: p, moved: false };
      return;
    }
    gesture = { kind: 'pan', start: p, tx: cam.tx, ty: cam.ty, moved: false, tapId: id || null, t0: Date.now() };
    viewport.classList.add('panning');
  });
  viewport.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    const p = pos(e); pointers.set(e.pointerId, p);
    if (!gesture) return;
    if (gesture.kind === 'pinch' && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const z = gesture.z0 * d / gesture.d0;
      zoomAt(gesture.mid.x, gesture.mid.y, z / cam.z);
      return;
    }
    if (gesture.kind === 'pan') {
      const dx = p.x - gesture.start.x, dy = p.y - gesture.start.y;
      if (Math.hypot(dx, dy) > 4) gesture.moved = true;
      cam.tx = gesture.tx + dx; cam.ty = gesture.ty + dy; clampCam(); applyCam();
      return;
    }
    if (gesture.kind === 'drag' && ghost) {
      if (Math.hypot(p.x - gesture.start.x, p.y - gesture.start.y) > 3) gesture.moved = true;
      const w = screenToWorld(p.x, p.y); const c = toCell(w.x, w.y);
      const nx = Math.round(c.i - gesture.di), ny = Math.round(c.j - gesture.dj);
      if (nx !== ghost.x || ny !== ghost.y) { ghost.x = nx; ghost.y = ny; updateGhost(); }
    }
  });
  const endPointer = (e) => {
    const g = gesture;
    pointers.delete(e.pointerId);
    if (pointers.size === 0) { gesture = null; viewport.classList.remove('panning'); }
    else if (g?.kind === 'pinch') { gesture = null; }
    if (!g) return;
    if (g.kind === 'pan' && !g.moved) { // тап
      if (g.tapId && !buildMode) { select(g.tapId === selectedId ? null : g.tapId); }
      else if (!g.tapId) { select(null); }
    }
    if (g.kind === 'drag' && ghost && !g.moved && ghost.id && buildMode) {
      // тап по зданию в стройке без движения — ничего не переставляем
      hideGhost();
    }
  };
  viewport.addEventListener('pointerup', endPointer);
  viewport.addEventListener('pointercancel', endPointer);
  viewport.addEventListener('wheel', (e) => { e.preventDefault(); const p = pos(e); zoomAt(p.x, p.y, e.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false });
  viewport.addEventListener('dblclick', (e) => { const p = pos(e); zoomAt(p.x, p.y, cam.z < 1.4 ? 1.5 : 1 / 1.5); });

  // ---------- кнопки ----------
  ghostctl.addEventListener('click', (e) => {
    const act = e.target.closest('button')?.dataset.act;
    if (act === 'ok') commitGhost();
    if (act === 'cancel') hideGhost();
  });
  selbub.addEventListener('click', (e) => {
    const act = e.target.closest('button')?.dataset.act;
    const b = buildings.find(b => b.id === selectedId);
    if (!b) return;
    if (act === 'move') { const id = b.id; selectedId = null; showGhost(b.type, b.x, b.y, id); }
    if (act === 'upgrade') { showHint(`${TYPES[b.type].name}: улучшение до ур. ${b.level + 1} — экран улучшения (не в этом прототипе)`); }
    if (act === 'info') { showHint(`${TYPES[b.type].name} ур. ${b.level}, след ${TYPES[b.type].fw}×${TYPES[b.type].fh}, клетка ${b.x},${b.y}`); }
  });
  document.getElementById('timetoggle').addEventListener('click', () => setNight(!night));

  // ---------- HUD из hud/main-screen.html ----------
  const importHud = async () => {
    const html = await (await fetch('../hud/main-screen.html')).text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const hud = document.getElementById('hud');
    const pick = ['.lord', '.buffs', '.queues', '.submenu', '.resources', '.chronicle', '.side', '.rbtn.build', '.rbtn.map', '.chat', '.nav', '.build-title', '.editor', '.btabs', '.build-close'];
    for (const sel of pick) {
      const el = doc.querySelector(sel);
      if (!el) continue;
      el.querySelectorAll('img').forEach(img => { const s = img.getAttribute('src'); if (s && !s.startsWith('../')) img.setAttribute('src', `../hud/${s}`); });
      hud.appendChild(el);
    }
    hud.querySelector('.rbtn.build')?.addEventListener('click', () => setBuild(true));
    hud.querySelector('.build-close')?.addEventListener('click', () => setBuild(false));
    hud.querySelector('.editor')?.remove();
    hud.querySelectorAll('.btabs .btab').forEach((b, i) => b.addEventListener('click', () => { hideGhost(false); renderCards(['eco', 'war', 'sci', 'deco'][i]); }));
    // счётчик свободных клеток в заголовке стройки
    const title = hud.querySelector('.build-title');
    if (title) title.innerHTML = `<img class="ic" src="../hud/icons/hammer.png" alt="">Стройка · свободных клеток&nbsp;<span id="free-cells">0</span>&nbsp;· строитель занят 1/1`;
  };

  // ---------- старт ----------
  const preload = () => Promise.all(Object.values(TYPES).flatMap(t => [t.day, t.night]).map(n => new Promise(res => { const i = new Image(); i.onload = i.onerror = res; i.src = `sprites/${n}.png`; })));
  window.__ready = (async () => {
    await Promise.all([importHud(), preload()]);
    setNight(night);
    if (stateName === 'built' && !q.get('state')) { /* восстановлено из localStorage */ }
    // пины состояний для «built»: пример
    if (stateName === 'built') { const k = buildings.find(b => b.id === 'keep'); if (k && !k.pin) k.pin = 'arrow-up'; const s = buildings.find(b => b.id === 'sawmill1'); if (s && !s.pin) s.pin = 'wood'; }
    render();
    if (buildMode) setBuild(true);
    const camq = q.get('cam');
    if (camq) { const [z, cx, cy] = camq.split(',').map(Number); lookAt(cx, cy, buildMode ? 740 : VW / 2, buildMode ? 318 : VH / 2, z); }
    const gq = q.get('ghost');
    if (gq) { const m = gq.match(/^(\w+)@(-?\d+),(-?\d+)$/); if (m && TYPES[m[1]]) { if (buildMode) { cardsEl.querySelector(`.card[data-type="${m[1]}"]`)?.classList.add('picked'); } showGhost(m[1], +m[2], +m[3]); } }
    const mv = q.get('move');
    if (mv) { const b = buildings.find(b => b.id === mv); if (b) { const m = (q.get('to') || '').match(/^(-?\d+),(-?\d+)$/); showGhost(b.type, m ? +m[1] : b.x, m ? +m[2] : b.y, b.id); } }
    const sq = q.get('select');
    if (sq && buildings.some(b => b.id === sq)) select(sq);
    applyCam();
  })();
})();
