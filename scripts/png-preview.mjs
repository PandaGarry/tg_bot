/**
 * Разбор PNG без внешних библиотек: печатает размер, палитру и грубый
 * ASCII-превью, чтобы понимать, что попало в кадр.
 *
 *   node scripts/png-preview.mjs shots/04-карта.png [ширина_превью]
 */
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const file = process.argv[2];
const cols = Number(process.argv[3] ?? 64);
const buf = readFileSync(file);

let offset = 8;
let width = 0;
let height = 0;
let bitDepth = 8;
let colorType = 6;
const idat = [];
while (offset < buf.length) {
  const len = buf.readUInt32BE(offset);
  const type = buf.toString('ascii', offset + 4, offset + 8);
  const data = buf.subarray(offset + 8, offset + 8 + len);
  if (type === 'IHDR') {
    width = data.readUInt32BE(0);
    height = data.readUInt32BE(4);
    bitDepth = data[8];
    colorType = data[9];
  } else if (type === 'IDAT') idat.push(data);
  else if (type === 'IEND') break;
  offset += 12 + len;
}
if (bitDepth !== 8) throw new Error(`глубина ${bitDepth} не поддерживается превью`);
const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType] ?? 4;
const raw = inflateSync(Buffer.concat(idat));
const stride = width * channels;
const px = Buffer.alloc(stride * height);

for (let y = 0; y < height; y++) {
  const filter = raw[y * (stride + 1)];
  const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
  const out = px.subarray(y * stride, (y + 1) * stride);
  const prev = y > 0 ? px.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
  for (let i = 0; i < stride; i++) {
    const a = i >= channels ? out[i - channels] : 0;
    const b = prev[i];
    const c = i >= channels ? prev[i - channels] : 0;
    let v = line[i];
    if (filter === 1) v += a;
    else if (filter === 2) v += b;
    else if (filter === 3) v += (a + b) >> 1;
    else if (filter === 4) {
      const p = a + b - c;
      const pa = Math.abs(p - a);
      const pb = Math.abs(p - b);
      const pc = Math.abs(p - c);
      v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
    }
    out[i] = v & 0xff;
  }
}

const at = (x, y) => {
  const i = y * stride + x * channels;
  if (channels >= 3) return [px[i], px[i + 1], px[i + 2]];
  const g = px[i];
  return [g, g, g];
};

console.log(`${file}: ${width}×${height}, каналов ${channels}`);

const step = Math.max(1, Math.floor(width / cols));
const rows = Math.max(1, Math.floor(height / (step * 2.1)));
const ramp = ' .:-=+*#%@';
let chart = '';
const palette = new Map();
for (let ry = 0; ry < rows; ry++) {
  let line = '';
  for (let rx = 0; rx < cols; rx++) {
    const x = Math.min(width - 1, rx * step);
    const y = Math.min(height - 1, Math.floor((ry * height) / rows));
    const [r, g, b] = at(x, y);
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    line += ramp[Math.min(ramp.length - 1, Math.floor((lum / 255) * ramp.length))];
    const key = `${r >> 5},${g >> 5},${b >> 5}`;
    palette.set(key, (palette.get(key) ?? 0) + 1);
  }
  chart += line + '\n';
}
console.log(chart);
const top = [...palette.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
console.log(
  'основные цвета (rgb, доля):',
  top
    .map(([k, v]) => {
      const [r, g, b] = k.split(',').map((n) => Number(n) * 32);
      return `(${r},${g},${b}) ${(v / (rows * cols) * 100).toFixed(0)}%`;
    })
    .join('  '),
);
