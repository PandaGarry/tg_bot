/**
 * Схема ядра. Таблицы модулей живут в модулях: ядро не знает их имён.
 * Время сроков — мировое время в миллисекундах (число), не календарь:
 * часы мира стоят, пока процесс не работает, и простой не сжигает минуты.
 */

import {
  bigint,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { JsonValue } from "@tdl/kernel";

/** Мир. Один сервер — одна земля вокруг столицы. */
export const worlds = pgTable("worlds", {
  id: text("world_id").primaryKey(),
  name: text("name").notNull(),
  seed: bigint("seed", { mode: "number" }).notNull(),
  size: integer("size").notNull(),
  zones: integer("zones").notNull().default(5),
  zonePit: integer("zone_pit").notNull().default(4),
  zoneCapital: integer("zone_capital").notNull().default(5),
  /** Сколько миллисекунд мир стоял всего. Мировое время = реальное − эта величина. */
  clockOffsetMs: bigint("clock_offset_ms", { mode: "number" }).notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Право писателя: строка в базе с номером эпохи.
 * Старый процесс после подъёма нового писать не может.
 */
export const writerLeases = pgTable("writer_leases", {
  worldId: text("world_id").primaryKey(),
  epoch: bigint("epoch", { mode: "number" }).notNull(),
  holder: text("holder").notNull(),
  heartbeatAt: timestamp("heartbeat_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Пульс мира: раз в 10 секунд. По нему считается простой. */
export const worldPulse = pgTable("world_pulse", {
  worldId: text("world_id").primaryKey(),
  realAtMs: bigint("real_at_ms", { mode: "number" }).notNull(),
  worldAtMs: bigint("world_at_ms", { mode: "number" }).notNull(),
});

/** Сроки. Шаг берёт только наступившее. */
export const deadlines = pgTable(
  "deadlines",
  {
    worldId: text("world_id").notNull(),
    id: text("id").notNull(),
    owner: text("owner").notNull(),
    /** Единица владельца: карантин замораживает её сроки, а не весь модуль. */
    unitId: text("unit_id"),
    wakeAtMs: bigint("wake_at_ms", { mode: "number" }).notNull(),
    key: text("key").notNull(),
    payload: jsonb("payload").$type<JsonValue>(),
    createdAtMs: bigint("created_at_ms", { mode: "number" }).notNull(),
    /** Сколько раз срок не удалось провести: бесконечно пробовать нельзя. */
    attempts: integer("attempts").notNull().default(0),
  },
  (table) => [
    // Срок уникален внутри мира: один и тот же id в другом мире — другая строка.
    primaryKey({ columns: [table.worldId, table.id] }),
    index("deadlines_due_idx").on(table.worldId, table.wakeAtMs),
    uniqueIndex("deadlines_key_idx").on(table.worldId, table.key),
  ],
);

/** Склад. Ресурс появляется здесь, потому что модуль объявил его id. */
export const stock = pgTable(
  "stock",
  {
    worldId: text("world_id").notNull(),
    holderId: text("holder_id").notNull(),
    resourceId: text("resource_id").notNull(),
    amount: bigint("amount", { mode: "number" }).notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.worldId, table.holderId, table.resourceId] })],
);

/**
 * Отрезки сбора. Ядро держит скорость, начало и остаток точки,
 * поэтому сумму сбора называет время на точке, а не модуль.
 */
export const gathers = pgTable(
  "gathers",
  {
    worldId: text("world_id").notNull(),
    id: text("gather_id").notNull(),
    moduleId: text("module_id").notNull(),
    holderId: text("holder_id").notNull(),
    resourceId: text("resource_id").notNull(),
    speedPerHour: doublePrecision("speed_per_hour").notNull(),
    startedAtMs: bigint("started_at_ms", { mode: "number" }).notNull(),
    stockLeft: bigint("stock_left", { mode: "number" }).notNull(),
    capacity: bigint("capacity", { mode: "number" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.worldId, table.id] }),
    index("gathers_world_idx").on(table.worldId),
  ],
);

/**
 * Состояние модуля на мир: enabled или disabled.
 * `untilMs` и `reason` — операторский запрет со сроком (карантин).
 */
export const moduleStates = pgTable(
  "module_states",
  {
    worldId: text("world_id").notNull(),
    moduleId: text("module_id").notNull(),
    state: text("state").notNull().default("enabled"),
    version: integer("version").notNull().default(0),
    untilMs: bigint("until_ms", { mode: "number" }).notNull().default(0),
    reason: text("reason"),
  },
  (table) => [primaryKey({ columns: [table.worldId, table.moduleId] })],
);

/**
 * Здоровье единиц: следы сбоев и карантин. Ключ `scope_key` — «модуль.единица»
 * для единицы или «модуль» целиком, когда сбой пришёл из кода без единицы.
 */
export const unitHealth = pgTable(
  "unit_health",
  {
    worldId: text("world_id").notNull(),
    scopeKey: text("scope_key").notNull(),
    moduleId: text("module_id").notNull(),
    unitId: text("unit_id"),
    /** Сколько сбоев подряд привело к карантину. */
    failures: integer("failures").notNull().default(0),
    /** До какого времени ядро держит единицу вне расчёта. Ноль — нужен оператор. */
    untilMs: bigint("until_ms", { mode: "number" }).notNull().default(0),
    /** Лечение не помогло: дальше только человек. */
    needsOperator: boolean("needs_operator").notNull().default(false),
    lastError: text("last_error"),
    updatedAtMs: bigint("updated_at_ms", { mode: "number" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.worldId, table.scopeKey] })],
);

/**
 * Состояние единицы внутри модуля: точечный переключатель.
 * Записи есть только там, где вмешался оператор: без записи решает расписание.
 */
export const unitStates = pgTable(
  "unit_states",
  {
    worldId: text("world_id").notNull(),
    moduleId: text("module_id").notNull(),
    unitId: text("unit_id").notNull(),
    state: text("state").notNull().default("enabled"),
    version: integer("version").notNull().default(0),
    untilMs: bigint("until_ms", { mode: "number" }).notNull().default(0),
    reason: text("reason"),
  },
  (table) => [primaryKey({ columns: [table.worldId, table.moduleId, table.unitId] })],
);

/** Повтор команды с тем же ключом не удваивает выдачу. */
export const commands = pgTable(
  "commands",
  {
    worldId: text("world_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    requestId: text("request_id").notNull(),
    actorId: text("actor_id").notNull(),
    moduleId: text("module_id").notNull(),
    commandId: text("command_id").notNull(),
    outcome: text("outcome").notNull(),
    errorKey: text("error_key"),
    atMs: bigint("at_ms", { mode: "number" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.worldId, table.idempotencyKey] })],
);

/** Канал audit: кто изменил склад. Пишется в той же транзакции, что и мир. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: serial("id").primaryKey(),
    ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
    worldId: text("world_id").notNull(),
    actorId: text("actor_id"),
    moduleId: text("module_id"),
    requestId: text("request_id"),
    commandId: text("command_id"),
    entity: text("entity"),
    outcome: text("outcome").notNull(),
    idempotencyKey: text("idempotency_key"),
    detail: jsonb("detail").$type<JsonValue>(),
  },
  (table) => [index("audit_world_idx").on(table.worldId, table.id)],
);

/** Канал sim: откуда взялась сумма. Игрок этих строк не видит. */
export const simRejections = pgTable(
  "sim_rejections",
  {
    id: serial("id").primaryKey(),
    ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
    worldId: text("world_id").notNull(),
    actorId: text("actor_id"),
    moduleId: text("module_id"),
    deadlineId: text("deadline_id"),
    requestId: text("request_id"),
    reason: text("reason").notNull(),
    claimed: jsonb("claimed").$type<JsonValue>(),
    computed: jsonb("computed").$type<JsonValue>(),
    detail: jsonb("detail").$type<JsonValue>(),
  },
  (table) => [index("sim_world_idx").on(table.worldId, table.id)],
);

/** Отчёт игрока. Хранится не бесконечно: 100 последних на игрока. */
export const reports = pgTable(
  "reports",
  {
    id: serial("id").primaryKey(),
    worldId: text("world_id").notNull(),
    lordId: text("lord_id").notNull(),
    kind: text("kind").notNull(),
    atMs: bigint("at_ms", { mode: "number" }).notNull(),
    body: jsonb("body").$type<JsonValue>().notNull(),
  },
  (table) => [index("reports_lord_idx").on(table.worldId, table.lordId, table.id)],
);

/** Ворота: аккаунт. Пароль лежит хешем Argon2id, необратимо. */
export const accounts = pgTable(
  "accounts",
  {
    id: text("account_id").primaryKey(),
    login: text("login").notNull(),
    loginKey: text("login_key").notNull(),
    /** Почта аккаунта: не логин. Вход принимает и её. */
    email: text("email").notNull().default(""),
    emailKey: text("email_key").notNull().default(""),
    passwordHash: text("password_hash").notNull(),
    lang: text("lang").notNull().default("ru"),
    roles: text("roles").array().notNull().default([]),
    /** Согласие на письма: необязательное, по умолчанию выключено. */
    acceptMail: boolean("accept_mail").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("accounts_login_key_idx").on(table.loginKey),
    uniqueIndex("accounts_email_key_idx").on(table.emailKey),
  ],
);

/** Сессия. В базе лежит хеш токена, не токен. */
export const sessions = pgTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    accountId: text("account_id").notNull(),
    worldId: text("world_id").notNull(),
    lordId: text("lord_id"),
    protocolVersion: integer("protocol_version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("sessions_account_idx").on(table.accountId)],
);

/** Лорд лежит во внешней базе: имя, портрет, знамя, тип. */
export const lords = pgTable(
  "lords",
  {
    id: text("lord_id").primaryKey(),
    worldId: text("world_id").notNull(),
    accountId: text("account_id").notNull(),
    name: text("name").notNull(),
    /** Имя уникально в мире без учёта регистра. */
    nameKey: text("name_key").notNull(),
    portrait: text("portrait").notNull(),
    bannerSign: text("banner_sign").notNull(),
    bannerColor: text("banner_color").notNull(),
    type: text("lord_type").notNull(),
    clanId: text("clan_id"),
    isBot: boolean("is_bot").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("lords_name_idx").on(table.worldId, table.nameKey),
    index("lords_account_idx").on(table.accountId),
  ],
);

export type WorldRow = typeof worlds.$inferSelect;
export type DeadlineRowDb = typeof deadlines.$inferSelect;
export type LordRow = typeof lords.$inferSelect;
export type AccountRow = typeof accounts.$inferSelect;
