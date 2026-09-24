/**
 * Процедурная графика карты: весь арт рисуется кодом в offscreen-canvas,
 * без внешних картинок — так игра остаётся лёгкой и работает офлайн.
 *
 * - terrainAtlas() собирает мир целиком (96×96 тайлов × 32px = 3072×3072) один раз
 *   и кэширует; основной рендер потом просто вырезает из него кусок.
 * - *_sprite() рисуют объекты карты (город, лагерь, месторождение, колодец)
 *   в 128×128 и тоже кэшируются.
 */

export const TEX = 32;
const S = 128; // размер спрайта объекта

/** Детерминированный хэш координат — один мир всегда выглядит одинаково. */
function hash2(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

type RGB = [number, number, number];
const rgb = (c: RGB, a = 1): string => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const mix = (a: RGB, b: RGB, t: number): RGB => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];
const shade = (c: RGB, f: number): RGB => [
  Math.min(255, Math.round(c[0] * f)),
  Math.min(255, Math.round(c[1] * f)),
  Math.min(255, Math.round(c[2] * f)),
];

/* ───────────────────────────  Террейн  ─────────────────────────── */

// 0 plains, 1 forest, 2 hills, 3 mountain, 4 water, 5 ash
const GRASS_A: RGB = [126, 143, 82];
const GRASS_B: RGB = [108, 125, 68];
const GRASS_DARK: RGB = [96, 112, 60];
const FOREST_BASE: RGB = [112, 130, 74];
const HILL_A: RGB = [147, 128, 84];
const HILL_B: RGB = [132, 114, 73];
const ROCK_A: RGB = [135, 128, 116];
const WATER_A: RGB = [47, 94, 115];
const WATER_B: RGB = [38, 77, 96];
const ASH_A: RGB = [71, 60, 55];
const ASH_B: RGB = [59, 49, 46];
const EMBER: RGB = [255, 122, 61];

function speckle(ctx: CanvasRenderingContext2D, px: number, py: number, seed: number, colors: RGB[], count: number): void {
  for (let i = 0; i < count; i++) {
    const hx = hash2(seed + i * 31, seed * 7 + i * 13);
    const hy = hash2(seed * 3 + i * 17, seed + i * 41);
    const hw = hash2(seed + i, seed + i * 7);
    ctx.fillStyle = rgb(colors[i % colors.length], 0.65);
    const w = 2 + hw * 3;
    ctx.fillRect(px + 2 + hx * (TEX - 6), py + 2 + hy * (TEX - 6), w, 2);
  }
}

function paintPlains(ctx: CanvasRenderingContext2D, px: number, py: number, sx: number, sy: number): void {
  const n = hash2(sx, sy);
  ctx.fillStyle = rgb(mix(GRASS_A, GRASS_B, n));
  ctx.fillRect(px, py, TEX, TEX);
  speckle(ctx, px, py, sx * 97 + sy, [GRASS_DARK, GRASS_A, [142, 158, 96]], 5);
  if (n > 0.55) {
    ctx.strokeStyle = rgb(shade(GRASS_DARK, 0.9), 0.8);
    ctx.lineWidth = 1;
    const gx = px + 6 + hash2(sx + 5, sy) * (TEX - 12);
    const gy = py + 6 + hash2(sx, sy + 5) * (TEX - 12);
    ctx.beginPath();
    ctx.moveTo(gx, gy + 4);
    ctx.quadraticCurveTo(gx + 1, gy + 1, gx + 3, gy);
    ctx.moveTo(gx + 2, gy + 4);
    ctx.quadraticCurveTo(gx + 2, gy + 1, gx, gy - 1);
    ctx.stroke();
  }
}

function paintForest(ctx: CanvasRenderingContext2D, px: number, py: number, sx: number, sy: number): void {
  ctx.fillStyle = rgb(FOREST_BASE);
  ctx.fillRect(px, py, TEX, TEX);
  speckle(ctx, px, py, sx * 31 + sy * 7, [shade(FOREST_BASE, 0.85)], 4);
  const trees = 2 + Math.floor(hash2(sx, sy) * 2);
  for (let i = 0; i < trees; i++) {
    const tx = px + 6 + hash2(sx * 11 + i, sy * 3 + i) * (TEX - 12);
    const ty = py + 8 + hash2(sx * 5 + i, sy * 13 + i) * (TEX - 14);
    const r = 4.5 + hash2(sx + i, sy + i) * 2;
    ctx.fillStyle = 'rgba(28,42,25,0.55)';
    ctx.beginPath();
    ctx.ellipse(tx + 1, ty + r * 0.9, r * 0.9, r * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2c4527';
    ctx.beginPath();
    ctx.moveTo(tx, ty - r);
    ctx.lineTo(tx + r, ty + r * 0.8);
    ctx.lineTo(tx - r, ty + r * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(88,124,76,0.9)';
    ctx.beginPath();
    ctx.moveTo(tx, ty - r);
    ctx.lineTo(tx + r * 0.45, ty + r * 0.2);
    ctx.lineTo(tx - r * 0.45, ty + r * 0.2);
    ctx.closePath();
    ctx.fill();
  }
}

function paintHills(ctx: CanvasRenderingContext2D, px: number, py: number, sx: number, sy: number, kvk: boolean): void {
  const n = hash2(sx, sy);
  const base = kvk ? mix(HILL_B, ASH_B, 0.45) : mix(HILL_A, HILL_B, n);
  ctx.fillStyle = rgb(base);
  ctx.fillRect(px, py, TEX, TEX);
  ctx.strokeStyle = rgb(shade(base, 0.82), 0.8);
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 2; i++) {
    const ox = px + hash2(sx + i * 23, sy) * TEX;
    const oy = py + hash2(sx, sy + i * 23) * TEX;
    ctx.beginPath();
    ctx.arc(ox, oy, 7 + i * 6, Math.PI * 0.1, Math.PI * 0.85);
    ctx.stroke();
  }
  speckle(ctx, px, py, sx * 17 + sy, [shade(base, 0.8)], 3);
}

function paintMountain(ctx: CanvasRenderingContext2D, px: number, py: number, sx: number, sy: number, kvk: boolean): void {
  const base = kvk ? mix(ROCK_A, ASH_B, 0.55) : ROCK_A;
  ctx.fillStyle = rgb(shade(base, 0.94));
  ctx.fillRect(px, py, TEX, TEX);
  const hx = px + TEX / 2 + (hash2(sx, sy) - 0.5) * 6;
  const top = py + 3;
  const bl = px + 2, br = px + TEX - 2, bot = py + TEX - 3;
  // левая грань светлее, правая в тени
  ctx.fillStyle = rgb(kvk ? shade(base, 0.95) : shade(ROCK_A, 1.06));
  ctx.beginPath();
  ctx.moveTo(hx, top);
  ctx.lineTo(bl, bot);
  ctx.lineTo(hx, bot);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = rgb(shade(base, 0.72));
  ctx.beginPath();
  ctx.moveTo(hx, top);
  ctx.lineTo(br, bot);
  ctx.lineTo(hx, bot);
  ctx.closePath();
  ctx.fill();
  if (kvk) {
    ctx.strokeStyle = rgb(EMBER, 0.85);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(hx, top + 2);
    ctx.lineTo(hx + 3, top + 12);
    ctx.lineTo(hx - 1, bot - 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = 'rgba(232,228,218,0.92)';
    ctx.beginPath();
    ctx.moveTo(hx, top);
    ctx.lineTo(hx + 4, top + 7);
    ctx.lineTo(hx + 1, top + 9);
    ctx.lineTo(hx - 2, top + 6);
    ctx.lineTo(hx - 4, top + 8);
    ctx.closePath();
    ctx.fill();
  }
}

function paintWater(ctx: CanvasRenderingContext2D, px: number, py: number, sx: number, sy: number, kvk: boolean): void {
  const n = hash2(sx, sy);
  const base = kvk ? mix([61, 42, 43], [44, 32, 34], n) : mix(WATER_A, WATER_B, n);
  ctx.fillStyle = rgb(base);
  ctx.fillRect(px, py, TEX, TEX);
  ctx.strokeStyle = kvk ? rgb(EMBER, 0.28) : 'rgba(150,196,214,0.4)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 2; i++) {
    const wy = py + 8 + i * 11 + hash2(sx + i, sy + i) * 4;
    const wx = px + 3 + hash2(sx * 7 + i, sy * 3 + i) * 10;
    ctx.beginPath();
    ctx.moveTo(wx, wy);
    ctx.quadraticCurveTo(wx + 5, wy - 2.5, wx + 10, wy);
    ctx.quadraticCurveTo(wx + 15, wy + 2.5, wx + 20, wy);
    ctx.stroke();
  }
}

function paintAsh(ctx: CanvasRenderingContext2D, px: number, py: number, sx: number, sy: number): void {
  ctx.fillStyle = rgb(mix(ASH_A, ASH_B, hash2(sx, sy)));
  ctx.fillRect(px, py, TEX, TEX);
  speckle(ctx, px, py, sx * 13 + sy * 29, [[41, 34, 32], [84, 72, 66]], 5);
  const seed = sx * 101 + sy;
  const cx = px + 6 + hash2(seed, sy) * (TEX - 12);
  const cy = py + 4 + hash2(sx, seed) * (TEX - 8);
  // светящаяся трещина: широкий полупрозрачный мазок + тонкое яркое жало
  ctx.strokeStyle = rgb(EMBER, 0.25);
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(cx - 5, cy + 8);
  ctx.lineTo(cx, cy + 3);
  ctx.lineTo(cx + 5, cy - 1);
  ctx.stroke();
  ctx.strokeStyle = rgb([255, 168, 110], 0.8);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 5, cy + 8);
  ctx.lineTo(cx, cy + 3);
  ctx.lineTo(cx + 5, cy - 1);
  ctx.stroke();
  if (hash2(sx + 3, sy + 3) > 0.62) {
    ctx.fillStyle = rgb([255, 190, 130], 0.9);
    ctx.fillRect(cx + 1, cy + 5, 1.6, 1.6);
  }
}

const atlasCache = new Map<string, { full: HTMLCanvasElement; mini: HTMLCanvasElement }>();

export function getTerrainAtlas(key: string, b64: string, size: number, kvk: boolean): { full: HTMLCanvasElement; mini: HTMLCanvasElement } {
  const cacheKey = `${key}:${kvk ? 'k' : 'h'}`;
  const hit = atlasCache.get(cacheKey);
  if (hit) return hit;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

  const canvas = document.createElement('canvas');
  canvas.width = size * TEX;
  canvas.height = size * TEX;
  const ctx = canvas.getContext('2d', { alpha: false })!;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const code = bytes[y * size + x] ?? 0;
      const px = x * TEX, py = y * TEX;
      switch (code) {
        case 1: paintForest(ctx, px, py, x, y); break;
        case 2: paintHills(ctx, px, py, x, y, kvk); break;
        case 3: paintMountain(ctx, px, py, x, y, kvk); break;
        case 4: paintWater(ctx, px, py, x, y, kvk); break;
        case 5: paintAsh(ctx, px, py, x, y); break;
        default: paintPlains(ctx, px, py, x, y);
      }
    }
  }

  // береговая линия: затемнение на суше у воды + пена на воде у суши
  const water = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < size && y < size && bytes[y * size + x] === 4;
  ctx.lineCap = 'round';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const isWater = bytes[y * size + x] === 4;
      const px = x * TEX, py = y * TEX;
      const edges: [number, number, number, number][] = [];
      if (!water(x, y - 1)) edges.push([px, py + 0.8, px + TEX, py + 0.8]);
      if (!water(x, y + 1)) edges.push([px, py + TEX - 0.8, px + TEX, py + TEX - 0.8]);
      if (!water(x - 1, y)) edges.push([px + 0.8, py, px + 0.8, py + TEX]);
      if (!water(x + 1, y)) edges.push([px + TEX - 0.8, py, px + TEX - 0.8, py + TEX]);
      if (!edges.length) continue;
      if (!isWater) {
        ctx.strokeStyle = 'rgba(20,16,12,0.32)';
        ctx.lineWidth = 2.4;
        for (const [ax, ay, bx, by] of edges) {
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
          ctx.stroke();
        }
      } else {
        ctx.strokeStyle = kvk ? rgb(EMBER, 0.5) : 'rgba(190,220,228,0.55)';
        ctx.lineWidth = 1.4;
        for (const [ax, ay, bx, by] of edges) {
          ctx.beginPath();
          ctx.moveTo(ax + 1.6, ay + 1.6);
          ctx.lineTo(bx - 1.6, by - 1.6);
          ctx.stroke();
        }
      }
    }
  }

  // мини-версия: при дальнем зуме браузер дорисует её мягко, без «зернистости» мелких деталей
  const mini = document.createElement('canvas');
  mini.width = Math.max(1, canvas.width / 4);
  mini.height = Math.max(1, canvas.height / 4);
  const mctx = mini.getContext('2d', { alpha: false })!;
  mctx.imageSmoothingEnabled = true;
  mctx.imageSmoothingQuality = 'high';
  mctx.drawImage(canvas, 0, 0, mini.width, mini.height);

  const entry = { full: canvas, mini };
  atlasCache.set(cacheKey, entry);
  return entry;
}

export function invalidateAtlas(): void {
  atlasCache.clear();
}

/* ───────────────────────────  Спрайты объектов  ─────────────────────────── */

const spriteCache = new Map<string, HTMLCanvasElement>();

function spriteOf(key: string, paint: (c: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const hit = spriteCache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d')!;
  paint(ctx);
  spriteCache.set(key, canvas);
  return canvas;
}

function shadow(ctx: CanvasRenderingContext2D, cy: number, rx: number, ry: number): void {
  ctx.fillStyle = 'rgba(10,8,7,0.4)';
  ctx.beginPath();
  ctx.ellipse(S / 2, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function citySprite(mine: boolean): HTMLCanvasElement {
  return spriteOf(`city:${mine ? 1 : 0}`, (ctx) => {
    shadow(ctx, 104, 46, 13);
    const wall = mine ? '#d3b06c' : '#98a5b3';
    const wallDark = mine ? '#a8894b' : '#6f7c8a';
    const roof = mine ? '#8d3a34' : '#4d657f';
    // стена с зубцами
    ctx.fillStyle = wallDark;
    ctx.fillRect(20, 66, 88, 38);
    ctx.fillStyle = wall;
    ctx.fillRect(24, 60, 80, 40);
    ctx.fillStyle = wallDark;
    for (let i = 0; i < 5; i++) ctx.fillRect(26 + i * 16, 54, 9, 8);
    // ворота
    ctx.fillStyle = '#3a2c22';
    ctx.beginPath();
    ctx.moveTo(56, 104);
    ctx.lineTo(56, 86);
    ctx.quadraticCurveTo(64, 78, 72, 86);
    ctx.lineTo(72, 104);
    ctx.closePath();
    ctx.fill();
    // донжон
    ctx.fillStyle = mine ? '#e6cf9a' : '#b6c2cd';
    ctx.fillRect(50, 40, 30, 34);
    ctx.fillStyle = roof;
    ctx.beginPath();
    ctx.moveTo(65, 16);
    ctx.lineTo(84, 42);
    ctx.lineTo(46, 42);
    ctx.closePath();
    ctx.fill();
    // окна донжона
    ctx.fillStyle = '#43372c';
    ctx.fillRect(57, 52, 5, 7);
    ctx.fillRect(68, 52, 5, 7);
    // флаг
    ctx.fillStyle = '#2c2622';
    ctx.fillRect(64, 4, 2.4, 14);
    ctx.fillStyle = mine ? '#ffb066' : '#cfd6dd';
    ctx.beginPath();
    ctx.moveTo(67, 5);
    ctx.lineTo(82, 9);
    ctx.lineTo(67, 13);
    ctx.closePath();
    ctx.fill();
  });
}

export function campSprite(): HTMLCanvasElement {
  return spriteOf('camp', (ctx) => {
    shadow(ctx, 102, 42, 12);
    // круг лагеря
    ctx.fillStyle = '#33261f';
    ctx.beginPath();
    ctx.arc(64, 76, 38, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8d3a34';
    ctx.lineWidth = 4;
    ctx.stroke();
    // шатёр
    ctx.fillStyle = '#4a3a30';
    ctx.beginPath();
    ctx.moveTo(64, 44);
    ctx.lineTo(92, 98);
    ctx.lineTo(36, 98);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#5d4a3c';
    ctx.beginPath();
    ctx.moveTo(64, 44);
    ctx.lineTo(76, 98);
    ctx.lineTo(52, 98);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2c231d';
    ctx.beginPath();
    ctx.moveTo(64, 78);
    ctx.lineTo(70, 98);
    ctx.lineTo(58, 98);
    ctx.closePath();
    ctx.fill();
    // флажок лагеря
    ctx.fillStyle = '#241d18';
    ctx.fillRect(63, 20, 2.4, 26);
    ctx.fillStyle = '#a33d36';
    ctx.beginPath();
    ctx.moveTo(66, 21);
    ctx.lineTo(84, 27);
    ctx.lineTo(66, 33);
    ctx.closePath();
    ctx.fill();
    // череп-вексиллум
    ctx.fillStyle = '#e8ded2';
    ctx.beginPath();
    ctx.arc(34, 52, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(30, 57, 8, 5);
    ctx.fillStyle = '#33261f';
    ctx.beginPath();
    ctx.arc(31.5, 51, 2, 0, Math.PI * 2);
    ctx.arc(36.5, 51, 2, 0, Math.PI * 2);
    ctx.fill();
  });
}

const NODE_STYLE: Record<string, { rim: string; dark: string }> = {
  food: { rim: '#a8c47a', dark: '#3f4d2c' },
  wood: { rim: '#c99a5e', dark: '#4a3520' },
  stone: { rim: '#a9b0b8', dark: '#3c4148' },
  iron: { rim: '#d5dbe2', dark: '#2f3540' },
};

export function nodeSprite(resource: string): HTMLCanvasElement {
  return spriteOf(`node:${resource}`, (ctx) => {
    const style = NODE_STYLE[resource] ?? NODE_STYLE.food;
    shadow(ctx, 100, 38, 10);
    // пьедестал
    ctx.fillStyle = style.dark;
    ctx.beginPath();
    ctx.arc(64, 70, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = style.rim;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = style.rim;
    ctx.strokeStyle = style.rim;
    if (resource === 'food') {
      // колос
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.moveTo(64, 94);
      ctx.lineTo(64, 46);
      ctx.stroke();
      for (let i = 0; i < 4; i++) {
        const y = 84 - i * 10;
        ctx.beginPath();
        ctx.ellipse(53, y, 7, 3.4, -0.7, 0, Math.PI * 2);
        ctx.ellipse(75, y, 7, 3.4, 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.ellipse(64, 42, 4.6, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (resource === 'wood') {
      ctx.save();
      ctx.translate(64, 66);
      ctx.fillStyle = '#8a6136';
      ctx.strokeStyle = '#64431f';
      ctx.lineWidth = 2.6;
      for (const [dx, dy, r] of [[-9, 6, -0.5], [9, 6, 0.5], [0, -9, 0.1]] as const) {
        ctx.save();
        ctx.translate(dx, dy);
        ctx.rotate(r);
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') ctx.roundRect(-16, -7, 32, 14, 6);
        else ctx.rect(-16, -7, 32, 14);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#c9a06b';
        ctx.beginPath();
        ctx.arc(14, 0, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#8a6136';
        ctx.restore();
      }
      ctx.restore();
    } else if (resource === 'stone') {
      ctx.fillStyle = '#8d949d';
      ctx.strokeStyle = '#5c636d';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(44, 86);
      ctx.lineTo(52, 52);
      ctx.lineTo(72, 44);
      ctx.lineTo(86, 84);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#b7bec6';
      ctx.beginPath();
      ctx.moveTo(52, 52);
      ctx.lineTo(72, 44);
      ctx.lineTo(64, 62);
      ctx.closePath();
      ctx.fill();
    } else {
      // железо: тёмная порода с блестящими жилами
      ctx.fillStyle = '#454c5a';
      ctx.beginPath();
      ctx.moveTo(42, 84);
      ctx.lineTo(50, 50);
      ctx.lineTo(66, 42);
      ctx.lineTo(84, 56);
      ctx.lineTo(88, 86);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#dfe6ee';
      ctx.beginPath();
      ctx.moveTo(56, 62);
      ctx.lineTo(62, 54);
      ctx.lineTo(66, 62);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(70, 74);
      ctx.lineTo(76, 66);
      ctx.lineTo(80, 74);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#9fb4ff';
      ctx.fillRect(58, 76, 3, 3);
      ctx.fillRect(72, 52, 3, 3);
    }
  });
}

export function wellSprite(mine: boolean): HTMLCanvasElement {
  return spriteOf(`well:${mine ? 1 : 0}`, (ctx) => {
    shadow(ctx, 104, 40, 11);
    // свечение
    const glow = ctx.createRadialGradient(64, 74, 4, 64, 74, 46);
    glow.addColorStop(0, 'rgba(255,150,80,0.5)');
    glow.addColorStop(1, 'rgba(255,120,50,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(14, 24, 100, 100);
    // постамент
    ctx.fillStyle = mine ? '#5d4326' : '#3f3430';
    ctx.beginPath();
    ctx.arc(64, 76, 33, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = mine ? '#e8c37a' : '#8a7466';
    ctx.lineWidth = 4;
    ctx.stroke();
    // жар внутри
    const pool = ctx.createRadialGradient(64, 76, 2, 64, 76, 26);
    pool.addColorStop(0, '#ffd9a0');
    pool.addColorStop(0.45, '#ff8a3d');
    pool.addColorStop(1, '#8d3a20');
    ctx.fillStyle = pool;
    ctx.beginPath();
    ctx.arc(64, 76, 26, 0, Math.PI * 2);
    ctx.fill();
    // языки пламени
    ctx.fillStyle = '#ffc27a';
    ctx.beginPath();
    ctx.moveTo(58, 70);
    ctx.quadraticCurveTo(54, 56, 63, 46);
    ctx.quadraticCurveTo(60, 58, 65, 62);
    ctx.quadraticCurveTo(69, 52, 74, 44);
    ctx.quadraticCurveTo(78, 58, 71, 70);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff0d0';
    ctx.beginPath();
    ctx.moveTo(61, 68);
    ctx.quadraticCurveTo(59, 60, 64, 54);
    ctx.quadraticCurveTo(67, 61, 68, 68);
    ctx.closePath();
    ctx.fill();
  });
}
