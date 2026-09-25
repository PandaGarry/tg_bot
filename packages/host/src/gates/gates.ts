/**
 * Ворота: регистрация, вход, сессия, создание лорда. Ворота не пишут склад
 * и не ведут сроки: писатель мира их не знает, очередь маршей флага не читает.
 */

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import { KERNEL_KEYS, LIMITS, PROTOCOL_VERSION, type Locale } from "@tdl/protocol";
import type { ActorFacts } from "@tdl/kernel";
import type { Db } from "../db/index.js";
import type { HostConfig } from "../config.js";
import type { Journal } from "../logger.js";

export const LORD_TYPES = ["flesh", "bone", "spore"] as const;
export type LordType = (typeof LORD_TYPES)[number];

export const PORTRAITS = [
  "portrait-1",
  "portrait-2",
  "portrait-3",
  "portrait-4",
  "portrait-5",
  "portrait-6",
  "portrait-7",
  "portrait-8",
] as const;

export const BANNER_SIGNS = ["skull", "bell", "tooth", "hand", "tower", "mushroom"] as const;
export const BANNER_COLORS = ["bone", "moss", "ash", "blood", "iron", "wheat", "night", "rust"] as const;

export interface GatesOptions {
  db: Db;
  config: HostConfig;
  journal: Journal;
}

export type GateResult<T> = { ok: true; value: T } | { ok: false; key: string; params?: Record<string, string | number> };

/** Algorithm.Argon2id: у библиотеки это внешний const enum, значение берём числом. */
const ARGON2ID = 2;

const ARGON_OPTIONS = { algorithm: ARGON2ID, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

function tokenHash(token: string, secret: string): string {
  return createHash("sha256").update(`${secret}:${token}`).digest("hex");
}

export function loginKey(login: string): string {
  return login.trim().toLowerCase();
}

export function lordNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Имя лорда: 2–18 знаков, буквы, цифры, пробел, дефис. Разметка не проходит. */
export function validateLordName(name: string): GateResult<string> {
  const trimmed = name.trim();
  if (trimmed.length < LIMITS.lordNameMin || trimmed.length > LIMITS.lordNameMax) {
    return { ok: false, key: KERNEL_KEYS.nameBad };
  }
  if (!/^[\p{L}\p{N} -]+$/u.test(trimmed)) return { ok: false, key: KERNEL_KEYS.nameBad };
  return { ok: true, value: trimmed };
}

export async function register(
  options: GatesOptions,
  input: { login: string; password: string; lang: Locale },
): Promise<GateResult<{ accountId: string }>> {
  if (!options.config.registrationOpen) {
    return { ok: false, key: KERNEL_KEYS.registration };
  }
  const key = loginKey(input.login);
  const existing = await options.db.pool.query(`SELECT account_id FROM accounts WHERE login_key = $1`, [key]);
  if (existing.rowCount && existing.rowCount > 0) {
    options.journal.write({ channel: "security", event: "gate.register.exists", detail: { loginKey: key } });
    return { ok: false, key: KERNEL_KEYS.login };
  }
  const passwordHash = await hash(input.password, ARGON_OPTIONS);
  const accountId = randomUUID();
  try {
    await options.db.pool.query(
      `INSERT INTO accounts (account_id, login, login_key, password_hash, lang) VALUES ($1, $2, $3, $4, $5)`,
      [accountId, input.login.trim(), key, passwordHash, input.lang],
    );
  } catch {
    return { ok: false, key: KERNEL_KEYS.login };
  }
  options.journal.write({ channel: "audit", event: "gate.registered", actorId: accountId });
  return { ok: true, value: { accountId } };
}

export async function login(
  options: GatesOptions,
  input: { login: string; password: string; protocolVersion: number },
): Promise<GateResult<{ token: string; accountId: string; worldId: string; lordId: string | null }>> {
  if (input.protocolVersion !== PROTOCOL_VERSION) {
    return { ok: false, key: KERNEL_KEYS.protocol };
  }
  const key = loginKey(input.login);
  const rows = await options.db.pool.query<{ account_id: string; password_hash: string }>(
    `SELECT account_id, password_hash FROM accounts WHERE login_key = $1`,
    [key],
  );
  const account = rows.rows[0];
  if (!account) {
    options.journal.write({ channel: "security", event: "gate.login.unknown", detail: { loginKey: key } });
    return { ok: false, key: KERNEL_KEYS.login };
  }
  const good = await verify(account.password_hash, input.password).catch(() => false);
  if (!good) {
    options.journal.write({ channel: "security", event: "gate.login.bad-password", actorId: account.account_id });
    return { ok: false, key: KERNEL_KEYS.login };
  }
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + LIMITS.sessionDays * 24 * 3_600_000);
  const lord = await options.db.pool.query<{ lord_id: string }>(
    `SELECT lord_id FROM lords WHERE account_id = $1 AND world_id = $2 ORDER BY created_at ASC LIMIT 1`,
    [account.account_id, options.config.WORLD_ID],
  );
  const lordId = lord.rows[0]?.lord_id ?? null;
  await options.db.pool.query(
    `INSERT INTO sessions (token_hash, account_id, world_id, lord_id, protocol_version, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [tokenHash(token, options.config.SESSION_SECRET), account.account_id, options.config.WORLD_ID, lordId, input.protocolVersion, expiresAt],
  );
  options.journal.write({ channel: "audit", event: "gate.login", actorId: account.account_id });
  return { ok: true, value: { token, accountId: account.account_id, worldId: options.config.WORLD_ID, lordId } };
}

export interface SessionInfo {
  accountId: string;
  worldId: string;
  lordId: string | null;
  actor: ActorFacts | null;
}

export async function resume(
  options: GatesOptions,
  input: { token: string; protocolVersion: number },
): Promise<GateResult<SessionInfo>> {
  if (input.protocolVersion !== PROTOCOL_VERSION) return { ok: false, key: KERNEL_KEYS.protocol };
  const rows = await options.db.pool.query<{
    account_id: string;
    world_id: string;
    lord_id: string | null;
    expires_at: Date;
    name: string | null;
    clan_id: string | null;
    lord_type: string | null;
    is_bot: boolean | null;
  }>(
    `SELECT s.account_id, s.world_id, s.lord_id, s.expires_at,
            l.name, l.clan_id, l.lord_type, l.is_bot
     FROM sessions s
     LEFT JOIN lords l ON l.lord_id = s.lord_id
     WHERE s.token_hash = $1`,
    [tokenHash(input.token, options.config.SESSION_SECRET)],
  );
  const row = rows.rows[0];
  if (!row) return { ok: false, key: KERNEL_KEYS.session };
  if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, key: KERNEL_KEYS.session };
  const actor: ActorFacts | null = row.lord_id
    ? {
        id: row.lord_id,
        worldId: row.world_id,
        name: row.name ?? "",
        clanId: row.clan_id ?? null,
        isBot: row.is_bot ?? false,
        type: row.lord_type ?? undefined,
      }
    : null;
  return { ok: true, value: { accountId: row.account_id, worldId: row.world_id, lordId: row.lord_id, actor } };
}

/** Создание лорда: имя, портрет, знамя, тип. Не конструктор лица. */
export async function createLord(
  options: GatesOptions,
  input: {
    accountId: string;
    worldId: string;
    name: string;
    portrait: string;
    bannerSign: string;
    bannerColor: string;
    type: string;
  },
): Promise<GateResult<{ lordId: string }>> {
  const name = validateLordName(input.name);
  if (!name.ok) return name;
  if (!PORTRAITS.includes(input.portrait as (typeof PORTRAITS)[number])) {
    return { ok: false, key: KERNEL_KEYS.nameBad };
  }
  if (!BANNER_SIGNS.includes(input.bannerSign as (typeof BANNER_SIGNS)[number])) {
    return { ok: false, key: KERNEL_KEYS.nameBad };
  }
  if (!BANNER_COLORS.includes(input.bannerColor as (typeof BANNER_COLORS)[number])) {
    return { ok: false, key: KERNEL_KEYS.nameBad };
  }
  if (!LORD_TYPES.includes(input.type as LordType)) return { ok: false, key: KERNEL_KEYS.nameBad };

  const existing = await options.db.pool.query<{ lord_id: string }>(
    `SELECT lord_id FROM lords WHERE world_id = $1 AND account_id = $2 LIMIT 1`,
    [input.worldId, input.accountId],
  );
  if (existing.rows[0]) return { ok: true, value: { lordId: existing.rows[0].lord_id } };

  const lordId = randomUUID();
  try {
    await options.db.pool.query(
      `INSERT INTO lords (lord_id, world_id, account_id, name, name_key, portrait, banner_sign, banner_color, lord_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        lordId,
        input.worldId,
        input.accountId,
        name.value,
        lordNameKey(name.value),
        input.portrait,
        input.bannerSign,
        input.bannerColor,
        input.type,
      ],
    );
  } catch (error) {
    if (String(error).includes("lords_name_idx")) return { ok: false, key: KERNEL_KEYS.nameTaken };
    throw error;
  }
  await options.db.pool.query(`UPDATE sessions SET lord_id = $2 WHERE account_id = $1 AND lord_id IS NULL`, [
    input.accountId,
    lordId,
  ]);
  options.journal.write({ channel: "audit", worldId: input.worldId, actorId: lordId, event: "lord.created" });
  return { ok: true, value: { lordId } };
}

/** Профиль лорда для снимка вида. */
export async function lordProfile(
  options: GatesOptions,
  lordId: string,
): Promise<{ portrait: string; bannerSign: string; bannerColor: string; type: string } | null> {
  const rows = await options.db.pool.query<{ portrait: string; banner_sign: string; banner_color: string; lord_type: string }>(
    `SELECT portrait, banner_sign, banner_color, lord_type FROM lords WHERE lord_id = $1`,
    [lordId],
  );
  const row = rows.rows[0];
  if (!row) return null;
  return {
    portrait: row.portrait,
    bannerSign: row.banner_sign,
    bannerColor: row.banner_color,
    type: row.lord_type,
  };
}
