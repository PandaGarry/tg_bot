/**
 * Подъём мира как функция: миграции, ворота, сокет, один порт.
 * Порядок — из 08-ops.md: миграции, простой, состояния модулей,
 * затем право писателя и только потом приём команд.
 * Приложение зовёт bootServer, тесты зовут его же: поведение одно.
 */

import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import {
  applyKernelMigrations,
  applyModuleMigrations,
  createDb,
  createJournal,
  ensureWorld,
  loadConfig,
  loadEnvFile,
  loadRegistry,
  lordProfile,
  syncModuleStates,
  WorldService,
  type Db,
  type GatesOptions,
  type HostConfig,
  type Journal,
  type JournalRecord,
} from "@tdl/host";
import type { ModuleDefinition } from "@tdl/kernel";
import { PROTOCOL_VERSION } from "@tdl/protocol";
import { clientPaths, createHttpServer, type HttpHandle } from "./http.js";
import { SocketHub } from "./net.js";

export interface BootOptions {
  /** Готовые настройки: тесты задают свои. Иначе читается окружение и .env. */
  config?: HostConfig;
  /** Журнал: тесты копят записи вместо вывода. */
  journal?: Journal;
  /** Свой слушатель: нужен, когда порт уже занят извне. */
  server?: Server;
  /** Отдавать ли клиента из этого же процесса. Тестам к нему ходить незачем. */
  serveClient?: boolean;
  /** Своя папка сборки клиента: проверка статики и нестандартный выпуск. */
  clientDist?: string;
  /** Предел буфера отправки: тест задаёт своё число и проверяет медленного клиента. */
  sendBufferBytes?: number;
  /** Добавочные модули сборки: тест проверяет край контракта на своём модуле. */
  extraModules?: readonly ModuleDefinition[];
}

export interface BootedServer {
  worldId: string;
  config: HostConfig;
  db: Db;
  journal: Journal;
  service: WorldService;
  hub: SocketHub;
  http: HttpHandle;
  port: number;
  /** Записи журнала: тесты читают их, приложение пишет в поток. */
  records: JournalRecord[];
  stop(reason: string): Promise<void>;
  /** Сколько медленных клиентов отключено: смотр админа и тесты. */
  slowClientCount(): number;
  /** Сколько соединений держит мир. */
  connections(): number;
}

export async function bootServer(options: BootOptions = {}): Promise<BootedServer> {
  const records: JournalRecord[] = [];
  const envFile = options.config ? null : loadEnvFile();
  const config = options.config ?? loadConfig();
  const journal = options.journal ?? createJournal(options.config ? (record) => records.push(record) : undefined);
  const processId = `${process.pid}-${randomUUID().slice(0, 8)}`;

  journal.write({
    channel: "app",
    event: "boot.start",
    detail: { process: processId, node: process.version, protocolVersion: PROTOCOL_VERSION, envFile },
  });

  const db = createDb(config.DATABASE_URL);
  await applyKernelMigrations(db, journal);
  const registry = loadRegistry(options.extraModules ?? []);
  const world = await ensureWorld(db, config, journal);
  await syncModuleStates(db, registry, world.id);
  await applyModuleMigrations(db, registry, world.id, journal);

  const gates: GatesOptions = { db, config, journal };
  const hub = new SocketHub({
    gates,
    journal,
    worldId: world.id,
    commandRate: config.commandRate,
    sendBufferBytes: options.sendBufferBytes,
  });

  // Порт занимается до права писателя: процесс, которому негде слушать,
  // не имеет права отобрать мир у живого соседа и замереть.
  let current: WorldService | null = null;
  const serveClient = options.serveClient ?? true;
  const paths = clientPaths();
  const http = await createHttpServer({
    journal,
    worldId: world.id,
    service: () => current,
    net: () => ({ connections: hub.connectionCount(), slowClients: hub.slowClientCount() }),
    server: options.server,
    clientDist: serveClient ? (options.clientDist ?? (config.isProduction ? paths.dist : undefined)) : undefined,
    // Своя папка сборки важнее режима разработки: так проверяется статика.
    devClientRoot: serveClient && !options.clientDist && !config.isProduction ? paths.devRoot : undefined,
  });

  let port = 0;
  try {
    port = await new Promise<number>((resolve, reject) => {
      http.server.once("error", reject);
      http.server.listen(config.PORT, config.HOST, () => {
        const address = http.server.address();
        resolve(typeof address === "object" && address ? address.port : config.PORT);
      });
    });
  } catch (error) {
    // Порт занят: освобождаем за собой и уходим, не трогая писателя.
    await http.close();
    await db.close();
    throw error;
  }

  const service = await WorldService.open({
    db,
    journal,
    registry,
    world,
    sink: hub,
    processId,
    profileOf: (actorId) => lordProfile(gates, actorId),
  });
  current = service;
  hub.setService(service);
  // Приём команд открывается только после права писателя.
  hub.attach(http.server);

  journal.write({
    channel: "app",
    worldId: world.id,
    event: "boot.ready",
    detail: { port, host: config.HOST, epoch: service.stats().epoch },
  });

  service.start();

  let stopping = false;
  const stop = async (reason: string): Promise<void> => {
    if (stopping) return;
    stopping = true;
    journal.write({ channel: "app", worldId: world.id, event: "boot.stop", detail: { reason } });
    await service.stop();
    await hub.close();
    await http.close();
    await db.close();
  };

  return {
    worldId: world.id,
    config,
    db,
    journal,
    service,
    hub,
    http,
    port,
    records,
    stop,
    slowClientCount: () => hub.slowClientCount(),
    connections: () => hub.connectionCount(),
  };
}
