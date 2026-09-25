/**
 * Нагрузочный прогон: pnpm load -- --sessions 20 --commands 20
 *
 * Открывает сессии и шлёт те же команды, что клиент, по тому же протоколу.
 * В базу мимо писателя не пишет: иначе замер врёт. Считает задержку команды,
 * лаг сроков, число сокетов и отказов. Тестовому миру частоту поднимает
 * флаг COMMAND_RATE; на боевом мира флага нет.
 *
 * Ключи: --url, --sessions, --commands, --rate, --json
 */

import WebSocket from "ws";
import { KERNEL_KEYS, PROTOCOL_VERSION } from "@tdl/protocol";

interface Options {
  url: string;
  sessions: number;
  commands: number;
  rate: number;
  json: boolean;
  /** Открытый поток: команды льются по темпу, ответы не ждут очереди. */
  openLoop: boolean;
}

function parseOptions(argv: readonly string[]): Options {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? "";
    // pnpm передаёт разделитель «--»: он не ключ и не значение.
    if (arg === "--" || !arg.startsWith("--")) continue;
    const [key, inline] = arg.slice(2).split("=");
    const value = inline ?? argv[index + 1] ?? "";
    if (inline === undefined) index += 1;
    if (key) values.set(key, value);
  }
  const port = process.env.PORT ?? "3000";
  const world = process.env.WORLD_ID ?? "world-1";
  void world;
  return {
    url: values.get("url") ?? `ws://127.0.0.1:${port}/socket`,
    sessions: Number(values.get("sessions") ?? 10),
    commands: Number(values.get("commands") ?? 20),
    rate: Number(values.get("rate") ?? 20),
    json: values.has("json"),
    openLoop: values.get("open-loop") === "true" || values.get("open-loop") === "",
  };
}

interface Answer {
  sentAt: number;
  arrivedAt: number;
  key: string | null;
}

/** Одна сессия прогона: регистрация, лорд, поток команд. */
class Session {
  readonly answers: Promise<Answer>[] = [];
  readonly errors = new Map<string, number>();
  private readonly socket: WebSocket;
  private readonly pending: { sentAt: number; arrive: (value: Answer) => void }[] = [];
  private patches = 0;
  private ready = false;
  private token = "";
  private lordCreated = false;
  private failed: string | null = null;

  constructor(
    private readonly options: Options,
    private readonly index: number,
  ) {
    this.socket = new WebSocket(options.url);
  }

  private static password = "load-run-password-123";

  async start(): Promise<void> {
    const name = `Прогон ${this.index} ${Math.random().toString(36).slice(2, 6)}`;
    const login = `load_${this.index}_${Math.random().toString(36).slice(2, 8)}`;
    // Почта и согласие обязательны с шага 2: без них ворота отвечают отказом,
    // а прогон молча ждёт входа и висит. Держим поле в одном месте с протоколом.
    const email = `${login}@load.test`;
    await new Promise<void>((resolve) => {
      this.socket.on("open", () => {
        this.socket.send(
          JSON.stringify({
            t: "auth.register",
            protocolVersion: PROTOCOL_VERSION,
            login,
            password: Session.password,
            email,
            acceptRules: true,
            acceptMail: false,
            lang: "ru",
          }),
        );
      });
      this.socket.on("message", (raw) => {
        const message = JSON.parse(String(raw)) as Record<string, unknown>;
        switch (message.t) {
          case "ready":
            break;
          case "auth": {
            this.token = String(message.token);
            if (message.needsLord && !this.lordCreated) {
              this.lordCreated = true;
              this.socket.send(
                JSON.stringify({
                  t: "lord.create",
                  protocolVersion: PROTOCOL_VERSION,
                  token: this.token,
                  name,
                  portrait: "portrait-1",
                  bannerSign: "skull",
                  bannerColor: "moss",
                  type: "bone",
                }),
              );
            } else if (!message.needsLord) {
              this.ready = true;
              resolve();
            }
            break;
          }
          case "state":
            break;
          case "patch":
            this.patches += 1;
            this.settle(null);
            break;
          case "report":
            break;
          case "error": {
            const key = String(message.key);
            this.errors.set(key, (this.errors.get(key) ?? 0) + 1);
            this.settle(key);
            break;
          }
          default:
            break;
        }
      });
      this.socket.on("error", (error) => {
        this.failed = String(error);
        resolve();
      });
      this.socket.on("close", () => {
        resolve();
      });
      // Сторож: молчание ворот — это прогон без замера, а не ожидание.
      setTimeout(() => resolve(), 10_000).unref?.();
    });
    if (!this.ready) throw new Error(`сессия ${this.index} не вошла в мир: ${this.failed ?? "нет ответа"}`);
  }

  /** Отправка без ожидания: так проверяется напор сверх силы писателя. */
  fire(steps: number): void {
    if (!this.ready) return;
    const sentAt = performance.now();
    const answer = new Promise<Answer>((resolve) => this.pending.push({ sentAt, arrive: resolve }));
    this.answers.push(answer);
    this.socket.send(
      JSON.stringify({
        t: "command",
        protocolVersion: PROTOCOL_VERSION,
        requestId: `req-load-${this.index}-${Math.random().toString(36).slice(2, 10)}`,
        idempotencyKey: `key-load-${this.index}-${Math.random().toString(36).slice(2, 12)}`,
        command: { id: "_probe.poke", payload: { steps } },
      }),
    );
  }

  /** Сколько ответов ещё не пришло. */
  get outstanding(): number {
    return this.pending.length;
  }

  /** Все обещания ответов: прогон ждёт их одной пачкой. */
  get answerPromises(): Promise<Answer>[] {
    return this.answers;
  }

  /** Команда: время пишем при отправке, ответ ждём по порядку. */
  async command(steps: number): Promise<void> {
    if (!this.ready) throw new Error("сессия не готова");
    const sentAt = performance.now();
    const answer = new Promise<Answer>((resolve) => this.pending.push({ sentAt, arrive: resolve }));
    this.socket.send(
      JSON.stringify({
        t: "command",
        protocolVersion: PROTOCOL_VERSION,
        requestId: `req-load-${this.index}-${Math.random().toString(36).slice(2, 10)}`,
        idempotencyKey: `key-load-${this.index}-${Math.random().toString(36).slice(2, 12)}`,
        command: { id: "_probe.poke", payload: { steps } },
      }),
    );
    this.answers.push(answer);
    await answer;
  }

  private settle(key: string | null): void {
    const next = this.pending.shift();
    next?.arrive({ sentAt: next.sentAt, arrivedAt: performance.now(), key });
  }

  get socketCount(): number {
    return this.socket.readyState === WebSocket.OPEN ? 1 : 0;
  }

  get patchCount(): number {
    return this.patches;
  }

  close(): void {
    this.socket.close();
  }
}

function percentile(values: number[], share: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(share * sorted.length) - 1);
  return sorted[Math.max(0, index)] ?? 0;
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const healthUrl = options.url.replace(/^ws/, "http").replace(/\/socket$/, "/api/health");
  const before = await fetch(healthUrl).then((response) => response.json()).catch(() => null);

  const startedAt = Date.now();
  const sessions: Session[] = [];
  for (let index = 0; index < options.sessions; index += 1) {
    const session = new Session(options, index);
    sessions.push(session);
    await session.start();
  }
  const connectedMs = Date.now() - startedAt;

  // Поток команд: темп на сессию не выше флага мира, иначе пойдут отказы частоты.
  const intervalMs = Math.ceil(1000 / options.rate);
  const sendStartedAt = Date.now();
  let sent = 0;
  if (options.openLoop) {
    // Открытый поток: каждой сессии свой темп, ответы собираются как придут.
    for (let round = 0; round < options.commands; round += 1) {
      for (const session of sessions) {
        session.fire(1);
        sent += 1;
      }
      if (round + 1 < options.commands) await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    // Ждём, пока мир разгребёт очередь: он обязан её разгрести.
    const drainDeadline = Date.now() + 30_000;
    for (;;) {
      const waiting = sessions.reduce((sum, session) => sum + session.outstanding, 0);
      if (waiting === 0 || Date.now() > drainDeadline) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  } else {
    for (let round = 0; round < options.commands; round += 1) {
      await Promise.all(
        sessions.map(async (session) => {
          await session.command(1);
          sent += 1;
        }),
      );
      if (round + 1 < options.commands) await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
  const elapsedMs = Math.max(1, Date.now() - sendStartedAt);

  const collected = (await Promise.all(sessions.flatMap((session) => session.answerPromises))).filter(
    (answer) => Number.isFinite(answer.arrivedAt),
  );
  const latencies = collected.filter((answer) => answer.key === null).map((answer) => answer.arrivedAt - answer.sentAt);
  const refusals = new Map<string, number>();
  for (const session of sessions) {
    for (const [key, count] of session.errors) refusals.set(key, (refusals.get(key) ?? 0) + count);
  }
  const sockets = sessions.reduce((sum, session) => sum + session.socketCount, 0);

  // Лаг сроков и состояние мира читаем у порта, а не из базы: замер честнее.
  await new Promise((resolve) => setTimeout(resolve, 300));
  const after = await fetch(healthUrl).then((response) => response.json()).catch(() => null);

  const unanswered = sent - collected.length;
  const summary = {
    sessions: sessions.length,
    commands: sent,
    unanswered,
    commandsPerSecond: Math.round((sent / elapsedMs) * 1000),
    connectedMs,
    elapsedMs,
    sockets,
    patches: sessions.reduce((sum, session) => sum + session.patchCount, 0),
    overloaded: (refusals.get(KERNEL_KEYS.busy) ?? 0) > 0,
    latencyMs: {
      p50: Math.round(percentile(latencies, 0.5)),
      p95: Math.round(percentile(latencies, 0.95)),
      p99: Math.round(percentile(latencies, 0.99)),
      max: Math.round(Math.max(0, ...latencies)),
    },
    refusals: Object.fromEntries(refusals),
    world: after
      ? {
          pending: after.stats?.pending ?? 0,
          failures: after.stats?.failures ?? 0,
          lastStepMs: after.stats?.lastStepMs ?? 0,
          lastDeadlineMs: after.stats?.lastDeadlineMs ?? 0,
          deadlineLag: after.stats?.deadlineLag ?? null,
          deadlinesDone: (after.stats?.deadlinesDone ?? 0) - (before?.stats?.deadlinesDone ?? 0),
        }
      : null,
  };

  for (const session of sessions) session.close();

  if (options.json) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  } else {
    process.stdout.write(
      `Прогон: ${summary.sessions} сессий, ${summary.commands} команд за ${summary.elapsedMs} мс ` +
        `(${summary.commandsPerSecond} команд/с), вход ${summary.connectedMs} мс, сокетов ${summary.sockets}\n` +
        `Задержка: p50 ${summary.latencyMs.p50} мс, p95 ${summary.latencyMs.p95} мс, p99 ${summary.latencyMs.p99} мс, ` +
        `максимум ${summary.latencyMs.max} мс; патчей ${summary.patches}\n` +
        (summary.world
          ? `Мир: сроков проведено ${summary.world.deadlinesDone}, шаг ${summary.world.lastStepMs} мс, ` +
            `сроки ${summary.world.lastDeadlineMs} мс, лаг сроков ${summary.world.deadlineLag?.max ?? 0} мс (средний ${summary.world.deadlineLag?.avg ?? 0} мс), ` +
            `в очереди ${summary.world.pending}, сбоев ${summary.world.failures}\n`
          : "Мир: health недоступен\n") +
        `Отказы: ${Object.keys(summary.refusals).length === 0 ? "нет" : JSON.stringify(summary.refusals)}` +
        `, без ответа ${summary.unanswered}\n`,
    );
  }

  // Отказы по напору и сроку годности — часть работы под перегрузкой, не поломка.
  const allowed = new Set<string>([KERNEL_KEYS.rate, KERNEL_KEYS.busy, KERNEL_KEYS.stale]);
  const unexpected = [...refusals.entries()].filter(([key]) => !allowed.has(key));
  const lost = Math.max(0, sent - collected.length);
  if (unexpected.length > 0 || lost > 0 || (summary.world?.failures ?? 0) > 0) {
    process.stdout.write(`Прогон не прошёл: чужие отказы ${JSON.stringify(Object.fromEntries(unexpected))}, без ответа ${lost}\n`);
    process.exit(1);
  }
  process.stdout.write("Прогон прошёл: потерь и чужих отказов нет.\n");
}

await main();
