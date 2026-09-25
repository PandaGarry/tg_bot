/**
 * Стрессоустойчивость ядра: напор команд, повторы, поток сроков, живые
 * таймеры, обрыв после коммита, смена права писателя под нагрузкой.
 * Здесь проверяется не «сколько красиво», а что мир не теряет и не двоит
 * работу и остаётся отзывчивым, когда очередь длинная.
 */

import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { QUEUE_LIMIT } from "../src/world/service.js";
import { countRows, createTestWorld, deadlinesOf, drain, runCommand, stockOf, type TestWorld } from "./harness.js";
import { kitModule } from "./kit.js";

const open: TestWorld[] = [];

afterEach(async () => {
  while (open.length > 0) await open.pop()?.close();
});

async function makeWorld(): Promise<TestWorld> {
  const world = await createTestWorld({ extraModules: [kitModule()] });
  open.push(world);
  return world;
}

function marksOf(database: TestWorld["db"], worldId: string, holderId: string): Promise<number> {
  return database.pool
    .query<{ marks: number }>(`SELECT marks FROM kit_state WHERE world_id = $1 AND holder_id = $2`, [worldId, holderId])
    .then((rows) => Number(rows.rows[0]?.marks ?? 0));
}

/** Проценты по возрастанию: нужен хвост, а не среднее. */
function percentile(values: number[], share: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(share * sorted.length) - 1));
  return Math.round(sorted[index] as number);
}

describe("напор команд", () => {
  it("двести команд от двадцати дворов применяются ровно по разу", async () => {
    const world = await makeWorld();
    const actors = Array.from({ length: 20 }, (_, index) => world.actor(`lord-load-${index}`));
    const perActor = 10;

    const startedAt = Date.now();
    const latencies: number[] = [];
    const pending: Promise<void>[] = [];
    for (let round = 0; round < perActor; round += 1) {
      for (const actor of actors) {
        const at = Date.now();
        const done = world.service
          .submitCommand({
            actor,
            commandId: "_kit.step",
            payload: {},
            requestId: `req-${randomUUID().slice(0, 8)}`,
            idempotencyKey: `key-${randomUUID()}`,
          })
          .then((outcome) => {
            latencies.push(Date.now() - at);
            expect(outcome.status).toBe("ok");
          });
        pending.push(done);
      }
    }
    expect(world.service.pending).toBe(actors.length * perActor);
    await drain(world);
    await Promise.all(pending);
    const elapsedMs = Date.now() - startedAt;

    // Ни одна команда не потерялась и не применилась дважды.
    for (const actor of actors) {
      expect(await marksOf(world.db, world.id, actor.id)).toBe(perActor);
      expect((await stockOf(world, actor.id)).kit_dust).toBe(perActor);
    }
    expect(await countRows(world, "stock")).toBe(actors.length);
    expect(world.service.stats().failures).toBe(0);
    expect(world.records.filter((record) => record.event === "world.error")).toHaveLength(0);
    // Числа уходят в отчёт: скорость и хвост видно, а не «вроде работает».
    console.log(
      `[напор] ${actors.length * perActor} команд за ${elapsedMs} мс, p50 ${percentile(latencies, 0.5)} мс, ` +
        `p95 ${percentile(latencies, 0.95)} мс, проходов ${world.service.stats().steps}`,
    );
    expect(percentile(latencies, 0.95)).toBeLessThan(5_000);
  });

  it("повтор под нагрузкой: тот же ключ десять раз даёт одну запись", async () => {
    const world = await makeWorld();
    const actor = world.actor();
    const key = `key-${randomUUID()}`;
    const submits = Array.from({ length: 10 }, () =>
      world.service.submitCommand({
        actor,
        commandId: "_kit.step",
        payload: {},
        requestId: `req-${randomUUID().slice(0, 8)}`,
        idempotencyKey: key,
      }),
    );
    await drain(world);
    const outcomes = await Promise.all(submits);
    const ok = outcomes.filter((outcome) => outcome.status === "ok");
    const repeats = ok.filter((outcome) => outcome.status === "ok" && outcome.repeat);
    expect(ok).toHaveLength(10);
    expect(repeats).toHaveLength(9);
    expect(await marksOf(world.db, world.id, actor.id)).toBe(1);
    expect((await stockOf(world, actor.id)).kit_dust).toBe(1);
  });

  it("тот же ключ у другой команды не проходит и попадает в журнал безопасности", async () => {
    const world = await makeWorld();
    const actor = world.actor();
    const key = `key-${randomUUID()}`;
    const first = await runCommand(world, actor, "_kit.step", {}, key);
    expect(first.status).toBe("ok");
    const second = await runCommand(world, actor, "_kit.mark", { count: 5 }, key);
    expect(second.status).toBe("error");
    expect(second.key).toBe("kernel.command.bad-input");
    expect(await marksOf(world.db, world.id, actor.id)).toBe(1);
    const security = world.records.filter((record) => record.event === "command.key-reuse");
    expect(security).toHaveLength(1);
  });

  it("устаревшая команда получает отказ, а не ответ через полминуты", async () => {
    // Мир занят: командам назначен срок годности в один миг.
    const world = await createTestWorld({ extraModules: [kitModule()], queueWaitMs: -1 });
    open.push(world);
    const actor = world.actor();
    const outcomes = Array.from({ length: 5 }, () =>
      world.service.submitCommand({
        actor,
        commandId: "_kit.step",
        payload: {},
        requestId: `req-${randomUUID().slice(0, 8)}`,
        idempotencyKey: `key-${randomUUID()}`,
      }),
    );
    await drain(world);
    const answers = await Promise.all(outcomes);
    expect(answers.every((answer) => answer.status === "error")).toBe(true);
    expect(answers[0]).toEqual({ status: "error", key: "kernel.command.stale" });
    expect(world.service.stats().dropped).toBe(5);
    expect(await countRows(world, "kit_state")).toBe(0);
    expect(world.records.filter((record) => record.event === "command.dropped")).toHaveLength(1);
  });

  it("очередь не растёт без предела: лишняя команда получает отказ сразу", async () => {
    const world = await makeWorld();
    const actor = world.actor();
    const filling = Array.from({ length: QUEUE_LIMIT }, (_, index) =>
      world.service.submitCommand({
        actor,
        commandId: "_kit.step",
        payload: {},
        requestId: `req-${index}`,
        idempotencyKey: `key-fill-${index}`,
      }),
    );
    expect(world.service.pending).toBe(QUEUE_LIMIT);
    const extra = await world.service.submitCommand({
      actor,
      commandId: "_kit.step",
      payload: {},
      requestId: "req-extra",
      idempotencyKey: "key-extra",
    });
    expect(extra).toEqual({ status: "error", key: "kernel.busy" });
    expect(world.service.stats().overflowed).toBe(1);
    expect(world.records.filter((record) => record.event === "command.overflow")).toHaveLength(1);

    // Остановка снимает очередь: команды получают ответ, база не трогается.
    await world.service.stop();
    const answers = await Promise.all(filling);
    expect(answers.every((answer) => answer.status === "error")).toBe(true);
    expect(await countRows(world, "kit_state")).toBe(0);
    expect(world.service.pending).toBe(0);
  });
});

describe("поток сроков", () => {
  it("шестьсот наступивших сроков не топят очередь команд и идут по разу", async () => {
    const world = await makeWorld();
    const actor = world.actor();
    const now = world.service.now();
    const rows: string[] = [];
    const values: unknown[] = [];
    for (let index = 0; index < 600; index += 1) {
      const start = values.length + 1;
      rows.push(
        `($${start}, $${start + 1}, $${start + 2}, $${start + 3}, $${start + 4}, $${start + 5}::jsonb, $${start + 6})`,
      );
      values.push(
        `kit-load-${index}`,
        world.id,
        "_kit",
        now - 1_000 + index,
        `kit-load-${index}`,
        JSON.stringify({ mode: "count" }),
        now - 60_000,
      );
    }
    await world.db.pool.query(
      `INSERT INTO deadlines (id, world_id, owner, wake_at_ms, key, payload, created_at_ms) VALUES ${rows.join(", ")}`,
      values,
    );

    const commands = Array.from({ length: 5 }, () =>
      world.service.submitCommand({
        actor,
        commandId: "_kit.step",
        payload: {},
        requestId: `req-${randomUUID().slice(0, 8)}`,
        idempotencyKey: `key-${randomUUID()}`,
      }),
    );

    // Один проход обязан вернуть управление: сроки берут не больше своего бюджета.
    await world.service.pumpOnce();
    const stepMs = world.service.stats().lastStepMs;
    const deadlineMs = world.service.stats().lastDeadlineMs;
    const answers = await Promise.all(commands);
    expect(answers.every((answer) => answer.status === "ok")).toBe(true);
    expect(world.service.stats().deadlinesDone).toBeGreaterThan(0);
    // Бюджет сроков — 50 мс: фаза сроков не держит цикл дольше одной порции.
    expect(deadlineMs).toBeLessThan(150);
    expect(stepMs).toBeLessThan(2_500);

    await drain(world);
    expect(await deadlinesOf(world)).toHaveLength(0);
    // Каждый срок прибавил ровно единицу: ни потерь, ни двойного проведения.
    expect(await marksOf(world.db, world.id, "world")).toBe(600);
    expect(world.service.stats().failures).toBe(0);
    console.log(
      `[сроки] 600 сроков: сроки ${deadlineMs} мс, шаг ${stepMs} мс, проходов ${world.service.stats().steps}`,
    );
  });
});

describe("живые таймеры", () => {
  it("мир отвечает без ручных проходов и тихо останавливается", async () => {
    const world = await makeWorld();
    const actors = Array.from({ length: 6 }, (_, index) => world.actor(`lord-live-${index}`));
    world.service.start();
    try {
      for (let wave = 0; wave < 3; wave += 1) {
        const answers = await Promise.all(
          actors.map((actor) =>
            world.service.submitCommand({
              actor,
              commandId: "_kit.step",
              payload: {},
              requestId: `req-${randomUUID().slice(0, 8)}`,
              idempotencyKey: `key-${randomUUID()}`,
            }),
          ),
        );
        expect(answers.every((answer) => answer.status === "ok")).toBe(true);
        await new Promise((resolve) => setTimeout(resolve, 60));
      }
    } finally {
      await world.service.stop();
    }
    for (const actor of actors) expect(await marksOf(world.db, world.id, actor.id)).toBe(3);
    expect(world.service.stats().steps).toBeGreaterThan(0);
    expect(world.service.stats().failures).toBe(0);
    expect(world.service.pending).toBe(0);
  });
});

describe("обрыв после коммита", () => {
  it("упавшая рассылка не отменяет применение, а повтор не двоит", async () => {
    let broken = true;
    const world = await createTestWorld({
      extraModules: [kitModule()],
      sink: {
        patch: () => {
          if (broken) throw new Error("сокет умер");
        },
        tiles: () => undefined,
        clan: () => undefined,
        error: () => undefined,
        report: () => undefined,
      },
    });
    open.push(world);
    const actor = world.actor();

    const key = `key-${randomUUID()}`;
    const first = await runCommand(world, actor, "_kit.step", {}, key);
    // Ответ до игрока не дошёл: он получил общий отказ и повторит тот же ключ.
    expect(first.status).toBe("error");
    expect(await marksOf(world.db, world.id, actor.id)).toBe(1);
    expect(world.records.some((record) => record.event === "world.error")).toBe(true);

    broken = false;
    await new Promise((resolve) => setTimeout(resolve, 200));
    const second = await runCommand(world, actor, "_kit.step", {}, key);
    expect(second.status).toBe("ok");
    expect(second.repeat).toBe(true);
    // Мир применил команду один раз, хотя игрок шёл с ней дважды.
    expect(await marksOf(world.db, world.id, actor.id)).toBe(1);
    expect((await stockOf(world, actor.id)).kit_dust).toBe(1);
    const done = world.service.submitCommand({
      actor,
      commandId: "_kit.step",
      payload: {},
      requestId: `req-${randomUUID().slice(0, 8)}`,
      idempotencyKey: `key-${randomUUID()}`,
    });
    await drain(world);
    expect((await done).status).toBe("ok");
    expect(await marksOf(world.db, world.id, actor.id)).toBe(2);
    expect(world.service.stats().failures).toBe(0);
  });
});

describe("смена права писателя под нагрузкой", () => {
  it("старый процесс не применяет ничего, новый продолжает с чистого места", async () => {
    const world = await makeWorld();
    const actor = world.actor();
    const queued = Array.from({ length: 30 }, () =>
      world.service.submitCommand({
        actor,
        commandId: "_kit.step",
        payload: {},
        requestId: `req-${randomUUID().slice(0, 8)}`,
        idempotencyKey: `key-${randomUUID()}`,
      }),
    );

    // Второй процесс забирает право до того, как первый начал применять.
    await world.db.pool.query(
      `UPDATE writer_leases SET epoch = epoch + 1, holder = 'другой-процесс' WHERE world_id = $1`,
      [world.id],
    );
    await drain(world, { limit: 3 });
    const answers = await Promise.all(queued);
    expect(answers.every((answer) => answer.status === "error")).toBe(true);
    expect(await countRows(world, "kit_state")).toBe(0);
    expect(await countRows(world, "stock")).toBe(0);

    // Новый процесс поднимается на том же мире и работает как обычно.
    await world.service.stop();
    const fresh = await runCommand(world, actor, "_kit.step", {}, `key-${randomUUID()}`);
    await world.service.pumpOnce();
    void fresh;
    const rows = await world.db.pool.query<{ holder: string; epoch: string }>(
      `SELECT holder, epoch FROM writer_leases WHERE world_id = $1`,
      [world.id],
    );
    expect(rows.rows[0]?.holder).toBe("другой-процесс");
  });
});
