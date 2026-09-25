/**
 * Жизненный цикл процесса мира: остановка по сигналу, выход при потере права
 * писателя, сторож на зависшую остановку. Логика вынесена из точки входа,
 * чтобы её можно было проверить тестом: сама точка входа — только провода.
 */

import type { BootedServer } from "./boot.js";

export interface LifecycleOptions {
  /** Чем выходить. Тесты подставляют свой. */
  exit?: (code: number) => void;
  /** Как часто смотреть, не ушло ли право писателя. */
  pollMs?: number;
  /** Сколько ждать остановку, прежде чем выйти силой. */
  stopTimeoutMs?: number;
  /** Ждать сигналов процесса. Тестам не нужно. */
  signals?: readonly NodeJS.Signals[];
}

export interface LifecycleHandle {
  /** Плановая остановка: мир закрывается, процесс выходит. */
  shutdown(reason: string, code?: number): Promise<void>;
  /** Снять сторож и таймеры: нужно тестам и повторному подъёму. */
  dispose(): void;
}

/** Код выхода: право писателя ушло другому процессу. */
export const EXIT_LEASE_LOST = 3;
/** Код выхода: остановка не уложилась в срок. */
export const EXIT_SLOW_STOP = 1;

export function installLifecycle(booted: BootedServer, options: LifecycleOptions = {}): LifecycleHandle {
  const exit = options.exit ?? ((code: number) => process.exit(code));
  const pollMs = options.pollMs ?? 2_000;
  const stopTimeoutMs = options.stopTimeoutMs ?? 15_000;
  let stopping = false;

  const shutdown = async (reason: string, code = 0): Promise<void> => {
    if (stopping) return;
    stopping = true;
    booted.journal.write({
      channel: "app",
      worldId: booted.worldId,
      event: "process.exit",
      detail: { reason, code },
    });
    // Сторож: зависшая остановка не должна держать мир в подвешенном виде.
    const timer = setTimeout(() => {
      booted.journal.write({
        channel: "app",
        worldId: booted.worldId,
        event: "process.slow-stop",
        detail: { reason, waitedMs: stopTimeoutMs },
      });
      exit(EXIT_SLOW_STOP);
    }, stopTimeoutMs);
    timer.unref?.();
    try {
      await booted.stop(reason);
    } catch (error) {
      booted.journal.write({
        channel: "app",
        worldId: booted.worldId,
        event: "process.stop.failed",
        detail: String(error),
      });
      clearTimeout(timer);
      exit(EXIT_SLOW_STOP);
      return;
    }
    clearTimeout(timer);
    dispose();
    exit(code);
  };

  const poll = setInterval(() => {
    // Право ушло: этот процесс больше не писатель, ему нельзя оставаться живым.
    if (booted.service.lostLease) void shutdown("writer-lost", EXIT_LEASE_LOST);
  }, pollMs);
  poll.unref?.();

  const handlers = new Map<NodeJS.Signals, () => void>();
  for (const signal of options.signals ?? []) {
    const handler = (): void => void shutdown(signal);
    handlers.set(signal, handler);
    process.on(signal, handler);
  }

  const dispose = (): void => {
    clearInterval(poll);
    for (const [signal, handler] of handlers) process.off(signal, handler);
    handlers.clear();
  };

  return { shutdown, dispose };
}
