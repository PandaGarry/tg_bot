import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import type { Command, Patch, ServerMessage } from '@ashfall/shared';
import {
  CommandError,
  foundCity,
  listReports,
  leaders,
  loadPlayer,
  migrate,
  onPlayerPatch,
  onWorldPatch,
  playerByToken,
  recallMarch,
  registerPlayer,
  snapshotFor,
  startMarch,
  tick,
  trainUnits,
  upgradeBuilding,
  worldMapBase64,
  getWorld,
} from './sim';
import { q, run } from './db';

const here = fileURLToPath(new URL('.', import.meta.url));
const CLIENT_DIST = resolve(here, '../../client/dist');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

interface Client {
  ws: WebSocket;
  playerId?: string;
  worldId?: number;
  alive: boolean;
}

const clients = new Set<Client>();
const pendingWorld = new Map<number, Patch>();
const pendingPlayer = new Map<string, Patch>();

function mergePatch(base: Patch | undefined, next: Patch | undefined): Patch | undefined {
  if (!base) return next;
  if (!next) return base;
  return { ...base, ...next };
}

onWorldPatch((worldId, patch) => {
  pendingWorld.set(worldId, mergePatch(pendingWorld.get(worldId), patch)!);
});
onPlayerPatch((playerId, patch) => {
  pendingPlayer.set(playerId, mergePatch(pendingPlayer.get(playerId), patch)!);
});

export function send(client: Client, msg: ServerMessage): void {
  if (client.ws.readyState !== client.ws.OPEN) return;
  client.ws.send(JSON.stringify(msg));
}

function flush(): void {
  const now = Date.now();
  for (const client of clients) {
    if (!client.playerId) continue;
    const worldPatch = client.worldId !== undefined ? pendingWorld.get(client.worldId) : undefined;
    const playerPatch = pendingPlayer.get(client.playerId);
    const merged = mergePatch(worldPatch, playerPatch);
    if (!merged) continue;
    send(client, { t: 'patch', patch: { ...merged, now } });
  }
  pendingWorld.clear();
  pendingPlayer.clear();
}

function handleCommand(client: Client, id: number, cmd: Command): void {
  const now = Date.now();
  const requirePlayer = (): string => {
    if (!client.playerId) throw new CommandError('Сначала войди в игру');
    return client.playerId;
  };
  try {
    switch (cmd.op) {
      case 'register': {
        const { token, playerId } = registerPlayer(cmd.nick, cmd.house);
        client.playerId = playerId;
        client.worldId = loadPlayer(playerId).world_id;
        send(client, { t: 'auth', ok: true, token, nick: cmd.nick });
        send(client, { t: 'snapshot', snapshot: snapshotFor(playerId, now) });
        send(client, { t: 'res', id, ok: true });
        return;
      }
      case 'foundCity': {
        const playerId = requirePlayer();
        foundCity(playerId, cmd.x, cmd.y);
        send(client, { t: 'snapshot', snapshot: snapshotFor(playerId, now) });
        send(client, { t: 'res', id, ok: true });
        return;
      }
      case 'upgrade': {
        const playerId = requirePlayer();
        upgradeBuilding(playerId, cmd.building);
        send(client, { t: 'res', id, ok: true });
        return;
      }
      case 'train': {
        const playerId = requirePlayer();
        trainUnits(playerId, cmd.unit, cmd.count);
        send(client, { t: 'res', id, ok: true });
        return;
      }
      case 'march':
      case 'marchTile': {
        const playerId = requirePlayer();
        startMarch(playerId, cmd);
        send(client, { t: 'res', id, ok: true });
        return;
      }
      case 'recall': {
        const playerId = requirePlayer();
        recallMarch(playerId, cmd.marchId);
        send(client, { t: 'res', id, ok: true });
        return;
      }
      case 'migrate': {
        const playerId = requirePlayer();
        migrate(playerId, cmd.worldId, cmd.x, cmd.y);
        client.worldId = loadPlayer(playerId).world_id;
        send(client, { t: 'snapshot', snapshot: snapshotFor(playerId, now) });
        send(client, { t: 'res', id, ok: true });
        return;
      }
      case 'leaderboard': {
        const playerId = requirePlayer();
        const worldId = loadPlayer(playerId).world_id;
        send(client, {
          t: 'patch',
          patch: { now, leaders: leaders(cmd.scope, worldId) },
        });
        send(client, { t: 'res', id, ok: true });
        return;
      }
      case 'markReportsRead': {
        const playerId = requirePlayer();
        run('UPDATE reports SET read = 1 WHERE player_id = ?', playerId);
        send(client, { t: 'patch', patch: { now, reports: listReports(playerId) } });
        send(client, { t: 'res', id, ok: true });
        return;
      }
    }
  } catch (err) {
    const message = err instanceof CommandError ? err.message : 'Внутренняя ошибка';
    if (!(err instanceof CommandError)) console.error(err);
    send(client, { t: 'res', id, ok: false, error: message });
  }
}

export function startServer(port: number): void {
  const server = createServer((req, res) => {
    void handleHttp(req, res);
  });

  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (ws) => {
    const client: Client = { ws, alive: true };
    clients.add(client);
    ws.on('pong', () => {
      client.alive = true;
    });
    ws.on('message', (raw) => {
      let msg: unknown;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (typeof msg !== 'object' || msg === null) return;
      const m = msg as { t?: string; token?: string | null; id?: number; cmd?: Command };
      if (m.t === 'auth') {
        if (m.token) {
          const player = playerByToken(m.token);
          if (player) {
            client.playerId = player.id;
            client.worldId = player.world_id;
            send(client, { t: 'auth', ok: true, token: m.token, nick: player.nick });
            send(client, { t: 'snapshot', snapshot: snapshotFor(player.id, Date.now()) });
            return;
          }
        }
        send(client, { t: 'auth', ok: false, error: 'Нужен вход' });
        return;
      }
      if (m.t === 'cmd' && m.cmd && typeof m.id === 'number') {
        handleCommand(client, m.id, m.cmd);
      }
    });
    ws.on('close', () => clients.delete(client));
    ws.on('error', () => clients.delete(client));
  });

  const heartbeat = setInterval(() => {
    for (const client of clients) {
      if (!client.alive) {
        client.ws.terminate();
        clients.delete(client);
        continue;
      }
      client.alive = false;
      client.ws.ping();
    }
  }, 30_000);

  const flusher = setInterval(flush, 1000);
  const ticker = setInterval(() => tick(Date.now()), 500);

  server.listen(port, '0.0.0.0', () => {
    console.log(`[ashfall] сервер слушает http://0.0.0.0:${port}`);
  });

  const shutdown = () => {
    clearInterval(heartbeat);
    clearInterval(flusher);
    clearInterval(ticker);
    wss.close();
    server.close(() => process.exit(0));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

async function handleHttp(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  if (url.pathname === '/api/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, clients: clients.size, uptime: process.uptime() }));
    return;
  }
  if (url.pathname.startsWith('/api/world/')) {
    const id = Number(url.pathname.split('/')[3] ?? '');
    try {
      const world = getWorld(id);
      const occupied = q<{ x: number; y: number }>(
        'SELECT x, y FROM entities WHERE world_id = ?',
        id,
      ).map((r) => [r.x, r.y]);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          id: world.id,
          name: world.name,
          size: world.size,
          kind: world.kind,
          map: worldMapBase64(id),
          occupied,
        }),
      );
    } catch {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'нет такого мира' }));
    }
    return;
  }
  if (url.pathname.startsWith('/api/')) {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
    return;
  }
  await serveStatic(url.pathname, res);
}

async function serveStatic(pathname: string, res: ServerResponse): Promise<void> {
  const rel = normalize(pathname === '/' ? '/index.html' : pathname).replace(/^(\.\.[/\\])+/, '');
  const filePath = join(CLIENT_DIST, rel);
  if (!filePath.startsWith(CLIENT_DIST)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error('not a file');
    const body = await readFile(filePath);
    res.writeHead(200, {
      'content-type': MIME[extname(filePath)] ?? 'application/octet-stream',
      'cache-control': 'no-cache',
    });
    res.end(body);
  } catch {
    try {
      const body = await readFile(join(CLIENT_DIST, 'index.html'));
      res.writeHead(200, { 'content-type': MIME['.html'], 'cache-control': 'no-cache' });
      res.end(body);
    } catch {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Клиент не собран: выполните npm run build');
    }
  }
}
