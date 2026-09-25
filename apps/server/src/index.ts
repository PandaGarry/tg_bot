/**
 * Процесс мира: подъём из boot.ts, обработка сигналов и выход.
 * Разбор настроек и порядок подъёма живут в boot.ts: тесты поднимают то же.
 */

import { bootServer } from "./boot.js";

const booted = await bootServer();

let stopping = false;
const shutdown = async (reason: string): Promise<void> => {
  if (stopping) return;
  stopping = true;
  await booted.stop(reason);
  process.exit(0);
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("uncaughtException", (error) => {
  booted.journal.write({
    channel: "app",
    worldId: booted.worldId,
    event: "process.uncaught",
    detail: String(error),
  });
});
process.on("unhandledRejection", (error) => {
  booted.journal.write({
    channel: "app",
    worldId: booted.worldId,
    event: "process.unhandled",
    detail: String(error),
  });
});

// Если право писателя ушло другому процессу, этот выходит.
setInterval(() => {
  if (booted.service.lostLease) void shutdown("writer-lost");
}, 2_000);
