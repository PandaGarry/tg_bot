/**
 * Жизненный цикл процесса: выход по сигналу, выход при потере права писателя,
 * сторож на зависшую остановку. Мир не поднимается: проверяется только логика
 * выхода — она решает, останется ли процесс писателем или уйдёт на перезапуск.
 */

import { describe, expect, it, vi } from "vitest";
import type { BootedServer } from "../src/boot.js";
import type { JournalRecord } from "@tdl/host";
import { EXIT_LEASE_LOST, EXIT_SLOW_STOP, installLifecycle } from "../src/lifecycle.js";

interface Stand {
  booted: BootedServer;
  records: JournalRecord[];
  exits: number[];
  setLostLease(value: boolean): void;
  stopCalls: string[];
  holdStop(): () => void;
}

function stand(options: { stopHangs?: boolean } = {}): Stand {
  const records: JournalRecord[] = [];
  const exits: number[] = [];
  const stopCalls: string[] = [];
  let lostLease = false;
  let release: (() => void) | null = null;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const booted = {
    worldId: "мир-проверки",
    journal: { write: (record: JournalRecord) => records.push(record) },
    service: {
      get lostLease() {
        return lostLease;
      },
    },
    stop: async (reason: string) => {
      stopCalls.push(reason);
      if (options.stopHangs) await pending;
    },
  } as unknown as BootedServer;
  return {
    booted,
    records,
    exits,
    setLostLease: (value: boolean) => {
      lostLease = value;
    },
    stopCalls,
    holdStop: () => () => release?.(),
  };
}

describe("право писателя ушло", () => {
  it("процесс закрывает мир и выходит своим кодом", async () => {
    const s = stand();
    const lifecycle = installLifecycle(s.booted, { exit: (code) => s.exits.push(code), pollMs: 10 });
    s.setLostLease(true);
    await vi.waitFor(() => expect(s.exits).toHaveLength(1), { timeout: 2_000 });
    expect(s.exits[0]).toBe(EXIT_LEASE_LOST);
    expect(s.stopCalls).toEqual(["writer-lost"]);
    const exitRecord = s.records.find((record) => record.event === "process.exit");
    expect(exitRecord).toBeDefined();
    expect((exitRecord?.detail as { reason?: string })?.reason).toBe("writer-lost");
    lifecycle.dispose();
  });

  it("живое право никого не выгоняет", async () => {
    const s = stand();
    const lifecycle = installLifecycle(s.booted, { exit: (code) => s.exits.push(code), pollMs: 10 });
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(s.exits).toHaveLength(0);
    lifecycle.dispose();
  });
});

describe("остановка", () => {
  it("вторая остановка ничего не делает второй раз", async () => {
    const s = stand();
    const lifecycle = installLifecycle(s.booted, { exit: (code) => s.exits.push(code), pollMs: 10_000 });
    await lifecycle.shutdown("SIGTERM");
    await lifecycle.shutdown("SIGTERM");
    await lifecycle.shutdown("writer-lost", EXIT_LEASE_LOST);
    expect(s.stopCalls).toEqual(["SIGTERM"]);
    expect(s.exits).toEqual([0]);
    lifecycle.dispose();
  });

  it("зависшая остановка не держит процесс: сторож выходит сам", async () => {
    const s = stand({ stopHangs: true });
    const lifecycle = installLifecycle(s.booted, {
      exit: (code) => s.exits.push(code),
      pollMs: 10_000,
      stopTimeoutMs: 30,
    });
    void lifecycle.shutdown("SIGTERM");
    await vi.waitFor(() => expect(s.exits).toContain(EXIT_SLOW_STOP), { timeout: 2_000 });
    expect(s.records.some((record) => record.event === "process.slow-stop")).toBe(true);
    s.holdStop()();
    lifecycle.dispose();
  });

  it("ошибка остановки пишется в журнал, а процесс всё равно выходит", async () => {
    const s = stand();
    (s.booted as unknown as { stop: () => Promise<void> }).stop = async () => {
      throw new Error("база уже мертва");
    };
    const lifecycle = installLifecycle(s.booted, { exit: (code) => s.exits.push(code), pollMs: 10_000 });
    await lifecycle.shutdown("SIGTERM");
    expect(s.exits).toEqual([EXIT_SLOW_STOP]);
    expect(s.records.some((record) => record.event === "process.stop.failed")).toBe(true);
    lifecycle.dispose();
  });
});
