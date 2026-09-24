/**
 * Рисует реальную карту мира из базы в PNG (без внешних зависимостей).
 * Нужно, когда живой предпросмотр недоступен: видно сам мир, города и лагеря.
 *
 *   node scripts/render-map-png.mjs [worldId] [out.png]
 */
import { DatabaseSync } from 'node:sqlite';
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const worldId = Number(process.argv[2] ?? 1);
const out = process.argv[3] ?? 'world.png';
const db = new DatabaseSync('data/ashfall.db');

const world = db.prepare('SELECT * FROM worlds WHERE id = ?').get(worldId);
if (!world) throw new Error(`нет мира ${worldId}`);

/* ── карта из seed'а (та же функция, что в игре) ── */
const hash = (x, y, seed) => {
  let h = (seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const smooth = (t) => t * t * (3 - 2 * t);
function noise(seed, x, y, scale) {
  const fx = x / scale;
  const fy = y / scale;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = smooth(fx - x0);
  const ty = smooth(fy - y0);
  const a = hash(x0, y0, seed) * (1 - tx) + hash(x0 + 1, y0, seed) * tx;
  const b = hash(x0, y0 + 1, seed) * (1 - tx) + hash(x0 + 1, y0 + 1, seed) * tx;
  return a * (1 - ty) + b * ty;
}
function terrain(x, y) {
  const n = noise(world.seed, x, y, 26) * 0.58 + noise(world.seed + 977, x, y, 11) * 0.3 + hash(x, y, world.seed + 4231) * 0.12;
  if (world.kind === 'kvk') {
    if (n < 0.24) return 'water';
    if (n < 0.62) return 'ash';
    if (n < 0.8) return 'hills';
    return 'mountain';
  }
  if (n < 0.27) return 'water';
  if (n < 0.47) return 'plains';
  if (n < 0.66) return 'forest';
  if (n < 0.82) return 'hills';
  return 'mountain';
}
const COLOR = {
  plains: [61, 74, 52],
  forest: [44, 66, 50],
  hills: [74, 65, 51],
  mountain: [77, 77, 85],
  water: [29, 42, 57],
  ash: [75, 47, 43],
};

const size = world.size;
const tile = 8;
const W = size * tile;
const H = size * tile;
const px = Buffer.alloc(W * H * 3);
const set = (x, y, [r, g, b]) => {
  const i = (y * W + x) * 3;
  px[i] = r;
  px[i + 1] = g;
  px[i + 2] = b;
};

for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    const c = COLOR[terrain(x, y)];
    for (let dy = 0; dy < tile; dy++) {
      for (let dx = 0; dx < tile; dx++) {
        const shade = dx === 0 || dy === 0 ? 0.86 : 1;
        set(x * tile + dx, y * tile + dy, c.map((v) => Math.round(v * shade)));
      }
    }
  }
}

const entities = db
  .prepare('SELECT e.*, p.nick, p.is_bot FROM entities e LEFT JOIN players p ON p.id = e.owner_id WHERE e.world_id = ?')
  .all(worldId);

function marker(x, y, rgb, half, kind) {
  const cx = x * tile + tile / 2;
  const cy = y * tile + tile / 2;
  for (let dy = -half; dy <= half; dy++) {
    for (let dx = -half; dx <= half; dx++) {
      if (kind === 'diamond' && Math.abs(dx) + Math.abs(dy) > half) continue;
      if (kind === 'circle' && dx * dx + dy * dy > half * half) continue;
      const pxX = Math.round(cx + dx);
      const pxY = Math.round(cy + dy);
      if (pxX < 0 || pxY < 0 || pxX >= W || pxY >= H) continue;
      set(pxX, pxY, rgb);
    }
  }
}

for (const e of entities) {
  if (e.kind === 'city') {
    marker(e.x, e.y, e.is_bot ? [154, 167, 184] : [232, 195, 122], 2, 'square');
  } else if (e.kind === 'camp') {
    marker(e.x, e.y, [141, 58, 52], 3, 'diamond');
  } else if (e.kind === 'node') {
    marker(e.x, e.y, e.resource === 'food' ? [143, 201, 143] : e.resource === 'wood' ? [185, 138, 85] : e.resource === 'stone' ? [154, 160, 166] : [207, 214, 221], 2, 'circle');
  } else if (e.kind === 'well') {
    marker(e.x, e.y, [255, 122, 61], 3, 'circle');
  }
}

/* ── PNG ── */
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // truecolor
const raw = Buffer.alloc(H * (W * 3 + 1));
for (let y = 0; y < H; y++) {
  raw[y * (W * 3 + 1)] = 0;
  px.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3);
}
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);
writeFileSync(out, png);
console.log(`${out}: ${W}×${H}, сущностей ${entities.length}, мир «${world.name}»`);
