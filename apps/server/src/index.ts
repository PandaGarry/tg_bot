/**
 * Точка входа процесса мира: подъём из boot.ts и жизненный цикл из lifecycle.ts.
 * Разбор настроек, порядок подъёма и остановка живут в модулях: здесь только провода.
 */

import { bootServer } from "./boot.js";
import { EXIT_SLOW_STOP, installLifecycle } from "./lifecycle.js";

const booted = await bootServer();
const lifecycle = installLifecycle(booted, { signals: ["SIGTERM", "SIGINT"] });

// Непойманная ошибка означает сломанный процесс: мир закрывается и уходит
// на перезапуск. Писать дальше вслепую нельзя — на кону склад и сроки.
process.on("uncaughtException", (error) => {
  booted.journal.write({
    channel: "app",
    worldId: booted.worldId,
    event: "process.uncaught",
    detail: String(error),
  });
  void lifecycle.shutdown("uncaught-exception", EXIT_SLOW_STOP);
});

// Отклонённое обещание чаще всего приходит из сети: пишем след и живём дальше.
process.on("unhandledRejection", (error) => {
  booted.journal.write({
    channel: "app",
    worldId: booted.worldId,
    event: "process.unhandled",
    detail: String(error),
  });
});
