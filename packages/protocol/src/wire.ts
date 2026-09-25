/**
 * Сообщения сокета. Схема входа проверяется до обработчика:
 * ядро не читает непроверенный объект.
 */

import { z } from "zod";
import { LIMITS, DEFAULT_LOCALE } from "./version.js";
import { zJsonValue, zPatchOp } from "./patch.js";

export const zLocale = z.enum(["ru", "en"]).default(DEFAULT_LOCALE);

/** Клиент → сервер. */
export const zAuthRegister = z.object({
  t: z.literal("auth.register"),
  protocolVersion: z.number().int().nonnegative(),
  login: z.string().min(3).max(24).regex(/^[A-Za-z0-9._-]+$/),
  password: z.string().min(8).max(72),
  /** Почта аккаунта: восстановление и письма. Не логин. */
  email: z.string().min(3).max(120),
  /** Согласие с правилами: без него регистрация не проходит. */
  acceptRules: z.literal(true),
  /** Разрешение на письма: необязательное, по умолчанию выключено. */
  acceptMail: z.boolean().default(false),
  lang: zLocale,
});

export const zAuthLogin = z.object({
  t: z.literal("auth.login"),
  protocolVersion: z.number().int().nonnegative(),
  login: z.string().min(3).max(24),
  password: z.string().min(8).max(72),
  lang: zLocale,
});

export const zAuthToken = z.object({
  t: z.literal("auth.token"),
  protocolVersion: z.number().int().nonnegative(),
  token: z.string().min(16).max(200),
  lang: zLocale,
});

export const zCommandMessage = z.object({
  t: z.literal("command"),
  protocolVersion: z.number().int().nonnegative(),
  /** Номер запроса: попадает в журнал, чтобы след команды был виден. */
  requestId: z.string().min(6).max(64),
  /** Ключ повтора: та же команда с тем же ключом не удваивает выдачу. */
  idempotencyKey: z.string().min(8).max(80),
  command: z.object({
    id: z.string().min(3).max(80),
    payload: zJsonValue.default({}),
  }),
});

export const zViewportMessage = z.object({
  t: z.literal("viewport"),
  protocolVersion: z.number().int().nonnegative(),
  x: z.number().int(),
  y: z.number().int(),
  w: z.number().int().min(1).max(200),
  h: z.number().int().min(1).max(200),
});

export const zPing = z.object({ t: z.literal("ping"), protocolVersion: z.number().int().nonnegative() });

/** Создание лорда: имя, портрет, знамя, тип. Не конструктор лица. */
export const zLordCreate = z.object({
  t: z.literal("lord.create"),
  protocolVersion: z.number().int().nonnegative(),
  token: z.string().min(16).max(200),
  name: z.string().min(2).max(18),
  portrait: z.string().min(1).max(32),
  bannerSign: z.string().min(1).max(32),
  bannerColor: z.string().min(1).max(32),
  type: z.enum(["flesh", "bone", "spore"]),
});

export const zClientMessage = z.discriminatedUnion("t", [
  zAuthRegister,
  zAuthLogin,
  zAuthToken,
  zCommandMessage,
  zViewportMessage,
  zPing,
  zLordCreate,
]);

export type ClientMessage = z.infer<typeof zClientMessage>;
export type CommandMessage = z.infer<typeof zCommandMessage>;

/** Сервер → клиент. */
export const zServerState = z.object({
  t: z.literal("state"),
  serverNow: z.number(),
  view: zJsonValue,
});

export const zServerPatch = z.object({
  t: z.literal("patch"),
  serverNow: z.number(),
  ops: z.array(zPatchOp),
});

export const zServerError = z.object({
  t: z.literal("error"),
  key: z.string(),
  params: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
});

export const zServerReport = z.object({
  t: z.literal("report"),
  serverNow: z.number(),
  report: zJsonValue,
});

/** Способности мира для клиента: какие гнёзда заполнены и что открыто. */
export const zServerReady = z.object({
  t: z.literal("ready"),
  serverNow: z.number(),
  modules: z.array(z.string()),
  resources: z.array(z.string()),
  protocolVersion: z.number(),
});

export const zServerPong = z.object({ t: z.literal("pong"), serverNow: z.number() });

export const zServerAuth = z.object({
  t: z.literal("auth"),
  serverNow: z.number(),
  token: z.string(),
  accountId: z.string(),
  worldId: z.string(),
  /** Лорда ещё нет: клиент открывает создание. */
  needsLord: z.boolean(),
});

export const zServerMessage = z.discriminatedUnion("t", [
  zServerState,
  zServerPatch,
  zServerError,
  zServerReport,
  zServerPong,
  zServerAuth,
  zServerReady,
]);

export type ServerMessage = z.infer<typeof zServerMessage>;

export const WIRE_LIMITS = LIMITS;
