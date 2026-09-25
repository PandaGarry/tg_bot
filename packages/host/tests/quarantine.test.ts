/**
 * Карантин и лечение: сбойная единица уходит с расчёта, ядро возвращает её само,
 * после третьей неудачи зовёт оператора. Сроки единицы ждут возврата, а не теряются.
 */

import { describe, expect, it } from "vitest";
import { KERNEL_KEYS } from "@tdl/protocol";
import { kitModule } from "./kit.js";
import { WorldService } from "../src/world/service.js";
import { createJournal } from "../src/logger.js";
import { createTestWorld, deadlinesOf, runCommand, type TestWorld } from "./harness.js";

const GADGET = "_kit.gadget";

/** Мир с быстрым лечением: отступы в миллисекундах, сторож строгий. */
async function quickWorld(options: { slowCommandMs?: number; backoff?: number[] } = {}): Promise<TestWorld> {
  return createTestWorld({
    extraModules: [kitModule()],
    quarantineBackoffMs: options.backoff ?? [60, 120, 240],
    slowCommandMs: options.slowCommandMs ?? 250,
    quarantineStrikes: 3,
    strikeWindowMs: 60_000,
  });
}

describe("карантин и лечение единиц", () => {
  it("три сбоя подряд уводят единицу с расчёта, её команда получает отказ", async () => {
    const world = await quickWorld();
    try {
      const actor = world.actor();
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const outcome = await runCommand(world, actor, "_kit.crash");
        expect(outcome.status).toBe("error");
      }

      expect(world.records.some((record) => record.event === "unit.strike")).toBe(true);
      expect(world.records.some((record) => record.event === "unit.quarantine")).toBe(true);

      const unit = world.service.unitStateOf(GADGET)!;
      expect(unit.state).toBe("disabled");
      expect(unit.reason).toBe("quarantine");
      expect(unit.failures).toBe(1);
      expect(world.service.stats().unitsQuarantined).toBe(1);

      // Рабочая команда той же единицы тоже закрыта: единица ушла с расчёта.
      const blocked = await runCommand(world, actor, GADGET);
      expect(blocked.status).toBe("error");
      expect(blocked.key).toBe(KERNEL_KEYS.quarantine);
    } finally {
      await world.close();
    }
  });

  it("вышел отступ — ядро вернуло единицу само, следов в базе нет", async () => {
    const world = await quickWorld({ backoff: [40, 120, 240] });
    try {
      const actor = world.actor();
      for (let attempt = 0; attempt < 3; attempt += 1) await runCommand(world, actor, "_kit.crash");
      expect(world.service.unitStateOf(GADGET)!.reason).toBe("quarantine");

      await new Promise((done) => setTimeout(done, 80));
      await world.service.pumpOnce();

      expect(world.records.some((record) => record.event === "unit.quarantine.release")).toBe(true);
      expect(world.service.stats().unitsQuarantined).toBe(0);
      const rows = await world.db.pool.query(`SELECT 1 FROM unit_health WHERE world_id = $1`, [world.id]);
      expect(rows.rowCount).toBe(0);

      // Единица снова работает.
      const ok = await runCommand(world, actor, GADGET);
      expect(ok.status).toBe("ok");
    } finally {
      await world.close();
    }
  });

  it("сбой после третьего лечения требует оператора и сам не снимается", async () => {
    const world = await quickWorld({ backoff: [30, 30, 30] });
    try {
      const actor = world.actor();
      // Четыре волны сбоев: три лечения, четвёртая — замок «нужен оператор».
      for (let wave = 0; wave < 4; wave += 1) {
        for (let attempt = 0; attempt < 3; attempt += 1) await runCommand(world, actor, "_kit.crash");
        await new Promise((done) => setTimeout(done, 50));
        await world.service.pumpOnce();
      }

      const locks = world.records.filter((record) => record.event === "unit.quarantine.locked");
      expect(locks.length).toBeGreaterThan(0);
      expect(world.service.stats().unitsQuarantineLocked).toBeGreaterThan(0);
      expect(world.service.quarantinesInForce()[0]?.needsOperator).toBe(true);

      // Время идёт, но сам карантин не снимается: нужен человек.
      await new Promise((done) => setTimeout(done, 80));
      await world.service.pumpOnce();
      expect(world.service.unitStateOf(GADGET)!.state).toBe("disabled");

      // Оператор вернул единицу: карантин снят его волей.
      await world.service.setUnitState("_kit", "gadget", "enabled");
      expect(world.service.quarantineFor("_kit", "gadget")).toBeNull();
      expect(world.records.some((record) => record.event === "unit.quarantine.release")).toBe(true);
    } finally {
      await world.close();
    }
  });

  it("повисший обработчик ловится сторожем: откат команды и карантин", async () => {
    const world = await quickWorld({ slowCommandMs: 40 });
    try {
      const actor = world.actor();
      const slow = await runCommand(world, actor, "_kit.slow", { count: 120 });
      expect(slow.status).toBe("error");
      expect(slow.key).toBe(KERNEL_KEYS.busy);
      expect(world.records.some((record) => record.event === "sim.command.slow")).toBe(true);

      // Работа повисшего обработчика не осталась в базе: транзакция откатилась.
      const marks = await world.db.pool.query<{ marks: number }>(
        `SELECT marks FROM kit_state WHERE world_id = $1 AND holder_id = $2`,
        [world.id, actor.id],
      );
      expect(marks.rowCount).toBe(0);

      expect(world.service.unitStateOf(GADGET)!.reason).toBe("quarantine");
    } finally {
      await world.close();
    }
  });

  it("сбой кода без единицы лечит модуль целиком, и оператор снимает карантин", async () => {
    const world = await quickWorld({ backoff: [600, 600, 600] });
    try {
      const actor = world.actor();
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const outcome = await runCommand(world, actor, "_kit.crash-module");
        expect(outcome.status).toBe("error");
      }

      // Карантин на модуле: его единицы молчат, состояние видно панели.
      const unit = world.service.unitStateOf(GADGET)!;
      expect(unit.state).toBe("disabled");
      expect(unit.reason).toBe("quarantine");
      expect(world.service.quarantineFor("_kit", null)).not.toBeNull();

      // Команда без единицы закрыта карантином модуля.
      const blocked = await runCommand(world, actor, "_kit.mark", { count: 1 });
      expect(blocked.status).toBe("error");
      expect(blocked.key).toBe(KERNEL_KEYS.quarantine);

      // Оператор вернул единицу: карантин модуля, который её держал, снят его волей.
      await world.service.setUnitState("_kit", "gadget", "enabled");
      expect(world.service.quarantineFor("_kit", null)).toBeNull();
      const back = await runCommand(world, actor, "_kit.mark", { count: 1 });
      expect(back.status).toBe("ok");
    } finally {
      await world.close();
    }
  });

  it("срок единицы ждёт возврата, а не пропадает", async () => {
    const world = await quickWorld({ backoff: [120, 240, 480] });
    try {
      const actor = world.actor();
      await runCommand(world, actor, "_kit.arm", { count: 30 });
      const armed = await deadlinesOf(world, "_kit");
      expect(armed).toHaveLength(1);
      expect(armed[0]?.unitId).toBe("gadget");

      // Карантин единицы: срок в работу не берётся.
      for (let attempt = 0; attempt < 3; attempt += 1) await runCommand(world, actor, "_kit.crash");
      expect(world.service.unitStateOf(GADGET)!.reason).toBe("quarantine");

      await new Promise((done) => setTimeout(done, 60));
      await world.service.pumpOnce();
      expect(world.records.some((record) => record.event === "deadline.postponed")).toBe(true);
      const stillThere = await deadlinesOf(world, "_kit");
      expect(stillThere).toHaveLength(1);

      // Возврат: срок догоняет и проводится.
      await world.service.setUnitState("_kit", "gadget", "enabled");
      await world.service.pumpOnce();
      expect(world.records.some((record) => record.event === "kit.deadline")).toBe(true);
      expect(await deadlinesOf(world, "_kit")).toHaveLength(0);
    } finally {
      await world.close();
    }
  });

  it("сбойный срок лечит владельца, и карантин переживает перезапуск мира", async () => {
    const world = await quickWorld({ backoff: [600, 600, 600] });
    try {
      const actor = world.actor();
      // Срок со сбоем: каждый проход — удар по владельцу.
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await runCommand(world, actor, "_kit.arm-bad");
        await new Promise((done) => setTimeout(done, 8));
        await world.service.pumpOnce();
      }
      expect(world.records.some((record) => record.event === "deadline.failed")).toBe(true);
      expect(world.service.quarantineFor("_kit", "gadget")).not.toBeNull();

      // Карантин лежит в базе: новый писатель на том же мире видит его сразу.
      await world.service.stop();
      const successor = await WorldService.open({
        db: world.db,
        journal: createJournal((record) => world.records.push(record)),
        registry: world.registry,
        world: world.world,
        sink: world.sink,
        processId: "successor-process",
        stepBudgetMs: 2_000,
      });
      try {
        const inherited = successor.quarantineFor("_kit", "gadget");
        expect(inherited).not.toBeNull();
        expect(inherited!.failures).toBeGreaterThan(0);
        expect(successor.stats().unitsQuarantined).toBeGreaterThan(0);
      } finally {
        await successor.stop();
      }
    } finally {
      await world.close();
    }
  });
});
