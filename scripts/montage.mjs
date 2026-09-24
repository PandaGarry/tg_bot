/**
 * Склеивает скриншоты в один «контактный лист» без внешних библиотек.
 *
 *   node scripts/montage.mjs out.png 3 260 shots/01-вход.png shots/04-карта.png ...
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';

const [out, colsArg, cellArg, ...files] = process.argv.slice(2);
const cols = Number(colsArg ?? 3);
const cellW = Number(cellArg ?? 260);

function decode(file) {
  const buf = readFileSync(file);
  let off = 8;
  let w = 0;
  let h = 0;
  let ct = 6;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      ct = data[9];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[ct] ?? 4;
  const stride = w * ch;
  const raw = Buffer.concat(idat);
  const rawP = Buffer.alloc(0);
  void rawP;
  const inflated = inflateSync(raw);
  const px = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const f = inflated[y * (stride + 1)];
    const line = inflated.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const o = px.subarray(y * stride, (y + 1) * stride);
    const prev = y ? px.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? o[i - ch] : 0;
      const b = prev[i];
      const c = i >= ch ? prev[i - ch] : 0;
      let v = line[i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      o[i] = v & 0xff;
    }
  }
  return { w, h, ch, px, stride };
}

const rows = Math.ceil(files.length / cols);
const gap = 8;
const scale = files.map((f) => decode(f));
const cellH = Math.round((cellW * scale[0].h) / scale[0].w);
const W = cols * cellW + (cols + 1) * gap;
const H = rows * cellH + (rows + 1) * gap;
const canvas = Buffer.alloc(W * H * 3, 22);

files.forEach((file, idx) => {
  const img = scale[idx];
  const cx = gap + (idx % cols) * (cellW + gap);
  const cy = gap + Math.floor(idx / cols) * (cellH + gap);
  for (let y = 0; y < cellH; y++) {
    const sy = Math.min(img.h - 1, Math.floor((y * img.h) / cellH));
    for (let x = 0; x < cellW; x++) {
      const sx = Math.min(img.w - 1, Math.floor((x * img.w) / cellW));
      const si = sy * img.stride + sx * img.ch;
      const di = ((cy + y) * W + (cx + x)) * 3;
      canvas[di] = img.px[si];
      canvas[di + 1] = img.px[si + 1];
      canvas[di + 2] = img.px[si + 2];
    }
  }
});

/* ── PNG ── */
const table = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
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
ihdr[8] = 8;
ihdr[9] = 2;
const raw = Buffer.alloc(H * (W * 3 + 1));
for (let y = 0; y < H; y++) {
  raw[y * (W * 3 + 1)] = 0;
  canvas.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3);
}
writeFileSync(
  out,
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ]),
);
console.log(`${out}: ${W}×${H}, кадров ${files.length}`);
