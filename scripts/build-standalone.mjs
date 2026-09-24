/**
 * Собирает один автономный HTML-файл игры (CSS и JS внутри, сервер задан явно).
 * Такой файл можно открыть где угодно — из окна предпросмотра чата, с диска,
 * из нативной обёртки — он всё равно найдёт сервер.
 *
 *   node scripts/build-standalone.mjs https://8787-xxx.e2b.app [out.html]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, '../apps/client/dist');
const server = (process.argv[2] ?? '').replace(/\/$/, '');
const out = process.argv[3] ?? resolve(here, '../../ashfall-standalone.html');

if (!/^https?:\/\//i.test(server)) {
  console.error('Укажи адрес сервера: node scripts/build-standalone.mjs https://host');
  process.exit(1);
}

let html = readFileSync(join(dist, 'index.html'), 'utf8');
const assets = [...html.matchAll(/(?:src|href)="\.?\/?([^"]+\.(?:js|css))"/g)].map((m) => m[1]);

for (const asset of assets) {
  const file = join(dist, asset);
  const content = readFileSync(file, 'utf8');
  if (asset.endsWith('.css')) {
    html = html.replace(new RegExp(`<link[^>]*${asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^>]*>`), `<style>${content}</style>`);
  } else {
    html = html.replace(
      new RegExp(`<script[^>]*${asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^>]*></script>`),
      `<script type="module">${content}<\/script>`,
    );
  }
}

html = html.replace('<head>', `<head>\n    <script>window.__ASHFALL_SERVER__ = ${JSON.stringify(server)};</script>`);

writeFileSync(out, html, 'utf8');
console.log(`готово: ${out} (${(html.length / 1024).toFixed(0)} КБ, сервер ${server})`);
