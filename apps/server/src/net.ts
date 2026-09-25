/**
 * Сокет мира: сессия, команды, патчи. Патч собирается под получателя:
 * чужой склад, чужой состав марша и чужой гарнизон в чужой патч не попадают.
 */

import type { Server } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import {
  KERNEL_KEYS,
  LIMITS,
  PROTOCOL_VERSION,
  zClientMessage,
  zServerAuth,
  zServerError,
  zServerPatch,
  zServerPong,
  zServerReady,
  zServerReport,
  zServerState,
} from "@tdl/protocol";
import type { ActorFacts, PatchOp, ReportRow, TileRef } from "@tdl/kernel";
import type { GatesOptions, Journal, ViewSink, WorldService } from "@tdl/host";
import { createLord, login, lordProfile, register, resume } from "@tdl/host";

interface SocketState {
  socket: WebSocket;
  accountId: string | null;
  actor: ActorFacts | null;
  token: string | null;
  viewport: { x: number; y: number; w: number; h: number } | null;
  lang: "ru" | "en";
  tokens: number;
  lastRefill: number;
  alive: boolean;
}

export interface HubOptions {
  gates: GatesOptions;
  journal: Journal;
  worldId: string;
  /** Команд в секунду на соединение. Тестовый мир поднимает флаг для прогона. */
  commandRate?: number;
  /** Предел буфера отправки. Тест задаёт ноль и проверяет отключение медленного клиента. */
  sendBufferBytes?: number;
}

export function containsTile(
  viewport: { x: number; y: number; w: number; h: number },
  tile: TileRef,
): boolean {
  return (
    tile.x >= viewport.x &&
    tile.x < viewport.x + viewport.w &&
    tile.y >= viewport.y &&
    tile.y < viewport.y + viewport.h
  );
}

/** Рассылка вида и приём команд. Мир сюда не пишет: писатель зовёт sink. */
export class SocketHub implements ViewSink {
  private readonly gates: GatesOptions;
  private readonly journal: Journal;
  private readonly worldId: string;
  private readonly commandRate: number;
  private readonly sendBufferBytes: number;
  /** Медленные клиенты: их отключают, чтобы память мира не росла. */
  private slowClients = 0;
  private readonly states = new Set<SocketState>();
  private service: WorldService | null = null;
  private wss: WebSocketServer | null = null;
  private heartbeat: NodeJS.Timeout | null = null;

  constructor(options: HubOptions) {
    this.gates = options.gates;
    this.journal = options.journal;
    this.worldId = options.worldId;
    this.commandRate = options.commandRate ?? LIMITS.commandsPerSecond;
    this.sendBufferBytes = options.sendBufferBytes ?? LIMITS.sendBufferBytes;
  }

  setService(service: WorldService): void {
    this.service = service;
  }

  attach(server: Server): void {
    const wss = new WebSocketServer({ server, maxPayload: LIMITS.maxMessageBytes });
    this.wss = wss;
    wss.on("connection", (socket) => this.onConnection(socket));
    this.heartbeat = setInterval(() => this.checkAlive(), 30_000);
    this.journal.write({ channel: "app", worldId: this.worldId, event: "net.ready" });
  }

  async close(): Promise<void> {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
    for (const state of this.states) state.socket.close(1001, "server shutdown");
    this.states.clear();
    await new Promise<void>((resolve) => (this.wss ? this.wss.close(() => resolve()) : resolve()));
  }

  // --- ViewSink -----------------------------------------------------------

  patch(actorId: string, ops: PatchOp[], serverNow: number): void {
    const message = zServerPatch.parse({ t: "patch", serverNow, ops });
    for (const state of this.byActor(actorId)) this.send(state, message, true);
  }

  tiles(tiles: TileRef[], ops: PatchOp[], serverNow: number, actorId: string): void {
    const message = zServerPatch.parse({ t: "patch", serverNow, ops });
    const seen = new Set<SocketState>();
    for (const state of this.states) {
      if (state.actor?.id === actorId) seen.add(state);
      else if (state.viewport && tiles.some((tile) => containsTile(state.viewport as NonNullable<SocketState["viewport"]>, tile))) {
        seen.add(state);
      }
    }
    for (const state of seen) this.send(state, message, true);
  }

  clan(clanId: string, ops: PatchOp[], serverNow: number): void {
    const message = zServerPatch.parse({ t: "patch", serverNow, ops });
    for (const state of this.states) {
      if (state.actor?.clanId === clanId) this.send(state, message, true);
    }
  }

  error(actorId: string, key: string, params?: Record<string, string | number>): void {
    const message = zServerError.parse({ t: "error", key, params });
    for (const state of this.byActor(actorId)) this.send(state, message);
  }

  /** Отчёт уходит игроку вместе со свежим снимком вида: строки не расходятся с миром. */
  report(actorId: string, _kind: string, rows: ReportRow[], serverNow: number): void {
    const targets = this.byActor(actorId);
    if (targets.length === 0) return;
    const actor = targets[0]?.actor ?? null;
    const message = zServerReport.parse({ t: "report", serverNow, report: { rows } });
    void (async () => {
      const view = actor && this.service ? await this.service.view(actor) : null;
      for (const state of targets) {
        if (view) this.send(state, zServerState.parse({ t: "state", serverNow, view }));
        this.send(state, message);
      }
    })();
  }

  // --- соединение ---------------------------------------------------------

  private byActor(actorId: string): SocketState[] {
    return [...this.states].filter((state) => state.actor?.id === actorId);
  }

  /**
   * Отправка с пределом. Клиент, который не читает, копит байты в памяти мира:
   * такой соединение закрывается — игрок переподключится и получит свежий снимок.
   * Предел стережёт рассылку вида: ответы на вход и ошибки маленькие, их не режем.
   */
  private send(state: SocketState, message: unknown, bulk = false): void {
    if (state.socket.readyState !== 1) return;
    const text = JSON.stringify(message);
    if (bulk && state.socket.bufferedAmount + Buffer.byteLength(text) > this.sendBufferBytes) {
      this.slowClients += 1;
      this.journal.write({
        channel: "app",
        worldId: this.worldId,
        actorId: state.actor?.id ?? undefined,
        event: "net.slow-client",
        detail: { buffered: state.socket.bufferedAmount, limit: this.sendBufferBytes, slowClients: this.slowClients },
      });
      state.socket.close(1013, "client too slow");
      this.states.delete(state);
      return;
    }
    state.socket.send(text);
  }

  /** Сколько медленных клиентов отключено за жизнь мира. */
  slowClientCount(): number {
    return this.slowClients;
  }

  /** Сколько соединений держит мир: смотр админа и тесты. */
  connectionCount(): number {
    return this.states.size;
  }

  private onConnection(socket: WebSocket): void {
    const state: SocketState = {
      socket,
      accountId: null,
      actor: null,
      token: null,
      viewport: null,
      lang: "ru",
      tokens: this.commandRate,
      lastRefill: Date.now(),
      alive: true,
    };
    this.states.add(state);
    socket.on("pong", () => {
      state.alive = true;
    });
    socket.on("close", () => this.states.delete(state));
    socket.on("error", () => this.states.delete(state));
    socket.on("message", (raw) => {
      void this.onMessage(state, raw.toString());
    });
  }

  private checkAlive(): void {
    for (const state of this.states) {
      if (!state.alive) {
        state.socket.terminate();
        this.states.delete(state);
        continue;
      }
      state.alive = false;
      state.socket.ping();
    }
  }

  private async onMessage(state: SocketState, raw: string): Promise<void> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.send(state, zServerError.parse({ t: "error", key: KERNEL_KEYS.badInput }));
      return;
    }
    const message = zClientMessage.safeParse(parsed);
    if (!message.success) {
      this.send(state, zServerError.parse({ t: "error", key: KERNEL_KEYS.badInput }));
      return;
    }
    if (message.data.protocolVersion !== PROTOCOL_VERSION) {
      this.send(state, zServerError.parse({ t: "error", key: KERNEL_KEYS.protocol }));
      return;
    }
    const data = message.data;
    switch (data.t) {
      case "ping":
        this.send(state, zServerPong.parse({ t: "pong", serverNow: this.service?.now() ?? 0 }));
        return;

      case "auth.register": {
        state.lang = data.lang;
        const created = await register(this.gates, {
          login: data.login,
          password: data.password,
          email: data.email,
          acceptRules: data.acceptRules,
          acceptMail: data.acceptMail,
          lang: data.lang,
        });
        if (!created.ok) {
          this.send(state, zServerError.parse({ t: "error", key: created.key }));
          return;
        }
        const entered = await login(this.gates, {
          login: data.login,
          password: data.password,
          protocolVersion: data.protocolVersion,
        });
        if (!entered.ok) {
          this.send(state, zServerError.parse({ t: "error", key: entered.key }));
          return;
        }
        await this.enterWorld(state, entered.value.token);
        return;
      }

      case "auth.login": {
        state.lang = data.lang;
        const entered = await login(this.gates, {
          login: data.login,
          password: data.password,
          protocolVersion: data.protocolVersion,
        });
        if (!entered.ok) {
          this.send(state, zServerError.parse({ t: "error", key: entered.key }));
          return;
        }
        await this.enterWorld(state, entered.value.token);
        return;
      }

      case "auth.token": {
        state.lang = data.lang;
        await this.enterWorld(state, data.token);
        return;
      }

      case "lord.create": {
        if (!state.accountId || !state.token) {
          this.send(state, zServerError.parse({ t: "error", key: KERNEL_KEYS.session }));
          return;
        }
        const created = await createLord(this.gates, {
          accountId: state.accountId,
          worldId: this.worldId,
          name: data.name,
          portrait: data.portrait,
          bannerSign: data.bannerSign,
          bannerColor: data.bannerColor,
          type: data.type,
        });
        if (!created.ok) {
          this.send(state, zServerError.parse({ t: "error", key: created.key }));
          return;
        }
        await this.enterWorld(state, state.token);
        return;
      }

      case "viewport": {
        state.viewport = { x: data.x, y: data.y, w: data.w, h: data.h };
        return;
      }

      case "command": {
        if (!state.actor || !state.accountId) {
          this.send(state, zServerError.parse({ t: "error", key: KERNEL_KEYS.session }));
          return;
        }
        if (!this.service) {
          this.send(state, zServerError.parse({ t: "error", key: KERNEL_KEYS.generic }));
          return;
        }
        if (!this.takeToken(state)) {
          this.send(state, zServerError.parse({ t: "error", key: KERNEL_KEYS.rate }));
          return;
        }
        const outcome = await this.service.submitCommand({
          actor: state.actor,
          commandId: data.command.id,
          payload: data.command.payload,
          requestId: data.requestId,
          idempotencyKey: data.idempotencyKey,
        });
        if (outcome.status === "error") {
          this.send(state, zServerError.parse({ t: "error", key: outcome.key, params: outcome.params }));
          return;
        }
        if (outcome.repeat && this.service) {
          // Повтор не применяется второй раз: клиенту уходит свежий снимок,
          // иначе интерфейс остался бы с неотправленной командой.
          const view = await this.service.view(state.actor);
          this.send(state, zServerState.parse({ t: "state", serverNow: this.service.now(), view }));
        }
        return;
      }
    }
  }

  private async enterWorld(state: SocketState, token: string): Promise<void> {
    const session = await resume(this.gates, { token, protocolVersion: PROTOCOL_VERSION });
    if (!session.ok) {
      this.send(state, zServerError.parse({ t: "error", key: session.key }));
      return;
    }
    state.accountId = session.value.accountId;
    state.token = token;
    state.actor = session.value.actor;
    const serverNow = this.service?.now() ?? 0;
    this.send(
      state,
      zServerReady.parse({
        t: "ready",
        serverNow,
        modules: this.service?.openModuleIds() ?? [],
        resources: this.service?.declaredResources().map((resource) => resource.id) ?? [],
        protocolVersion: PROTOCOL_VERSION,
      }),
    );
    this.send(
      state,
      zServerAuth.parse({
        t: "auth",
        serverNow,
        token,
        accountId: session.value.accountId,
        worldId: this.worldId,
        needsLord: session.value.lordId === null,
      }),
    );
    if (state.actor && this.service) {
      const view = await this.service.view(state.actor);
      this.send(state, zServerState.parse({ t: "state", serverNow: this.service.now(), view }));
    }
  }

  private takeToken(state: SocketState): boolean {
    const now = Date.now();
    if (now - state.lastRefill > 1000) {
      state.tokens = this.commandRate;
      state.lastRefill = now;
    }
    if (state.tokens <= 0) return false;
    state.tokens -= 1;
    return true;
  }

  /** Профиль лорда для снимка вида. */
  profileOf = async (actorId: string) => lordProfile(this.gates, actorId);
}
