/**
 * Настройки процесса. Секрет только в окружении: в репозитории и в журнале его нет.
 */

import { existsSync } from "node:fs";
import { isIP } from "node:net";
import { dirname, join } from "node:path";
import { z } from "zod";

export const configSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL не задан"),
  /** 0 — любой свободный порт: так поднимаются тесты. */
  PORT: z.coerce.number().int().nonnegative().default(3000),
  HOST: z.string().default("0.0.0.0"),
  SESSION_SECRET: z.string().min(16, "SESSION_SECRET короче 16 знаков"),
  REGISTRATION_OPEN: z.enum(["0", "1"]).default("1"),
  WORLD_NAME: z.string().min(1).default("Первый мир"),
  WORLD_SEED: z.coerce.number().int().default(1541),
  WORLD_SIZE: z.coerce.number().int().min(32).max(1200).default(200),
  WORLD_ID: z.string().default("world-1"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  /**
   * Команд в секунду на аккаунт в пределах одного мира. Тестовый мир
   * может снизить лимит для проверки общей квоты нескольких сокетов.
   */
  COMMAND_RATE: z.coerce.number().int().min(1).max(1_000).default(20),
  /**
   * Токен оператора: им включают и гасят модули до появления админской панели.
   * Пусто — путь закрыт целиком, а не открыт всем.
   */
  ADMIN_TOKEN: z.string().default(""),
  /**
   * Кто может войти в мир. `public` — все, `admins` — только служебные логины:
   * так поднимается параллельный мир для проверок и так же закрывается боевой
   * на время работ. Регистрация в закрытом мире тоже только по списку.
   */
  ACCESS_MODE: z.enum(["public", "admins"]).default("public"),
  /** Служебные логины через запятую: им открыт вход в закрытый мир. */
  ADMIN_LOGINS: z.string().default(""),
  /** Exact browser origins allowed to open production WebSocket sessions. */
  ALLOWED_ORIGINS: z.string().default(""),
  /** Exact IPs of reverse proxies allowed to supply X-Forwarded-For; CIDR is intentionally unsupported. */
  TRUSTED_PROXY_IPS: z.string().default(""),
});

/**
 * Ищет .env вверх от рабочего каталога и читает его. Уже заданное окружение
 * файл не перебивает: process.loadEnvFile не трогает занятые переменные.
 */
export function loadEnvFile(startDir: string = process.cwd()): string | null {
  let dir = startDir;
  for (let depth = 0; depth < 4; depth += 1) {
    const candidate = join(dir, ".env");
    if (existsSync(candidate)) {
      try {
        process.loadEnvFile(candidate);
      } catch {
        return null;
      }
      return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

export type HostConfig = z.infer<typeof configSchema> & {
  registrationOpen: boolean;
  /** Токен оператора: пустая строка — путь выключен. */
  adminToken: string;
  /** Команд в секунду на аккаунт в пределах одного мира. */
  commandRate: number;
  /** Служебные логины: сравнение по ключу логина, как в воротах. */
  adminLogins: readonly string[];
  /** Exact origins allowed to open WebSocket sessions; empty only outside production. */
  allowedOrigins: readonly string[];
  /** Exact trusted proxy IPs; empty means ignore X-Forwarded-For. */
  trustedProxyIps: readonly string[];
  /** Мир открыт всем или только служебным аккаунтам. */
  accessPublic: boolean;
  isProduction: boolean;
};


function assertProductionConfig(parsed: z.infer<typeof configSchema>, env: NodeJS.ProcessEnv): void {
  if (parsed.NODE_ENV !== "production") return;
  const problems: string[] = [];
  const isWeakSecret = (value: string): boolean => {
    const normalized = value.trim().toLowerCase();
    const placeholders = new Set(["dev-only-secret-change-me", "change-me", "changeme", "secret", "password", "test", "development", "default"]);
    return value.length < 32 || new Set(value).size < 8 || placeholders.has(normalized);
  };
  if (isWeakSecret(parsed.SESSION_SECRET)) problems.push("SESSION_SECRET must be a random value of at least 32 characters");
  if (isWeakSecret(parsed.ADMIN_TOKEN)) problems.push("ADMIN_TOKEN must be a separate random value of at least 32 characters");
  if (parsed.SESSION_SECRET === parsed.ADMIN_TOKEN) problems.push("SESSION_SECRET and ADMIN_TOKEN must differ");
  if (!env.WORLD_ID?.trim()) problems.push("WORLD_ID must be explicitly set");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(parsed.WORLD_ID)) problems.push("WORLD_ID must be a 1–64 character slug");
  if (!env.ACCESS_MODE?.trim()) problems.push("ACCESS_MODE must be explicitly set");
  if (!env.REGISTRATION_OPEN?.trim()) problems.push("REGISTRATION_OPEN must be explicitly set to 0 or 1");
  if (parsed.ACCESS_MODE === "admins" && parsed.ADMIN_LOGINS.length === 0) problems.push("ADMIN_LOGINS must contain at least one login when ACCESS_MODE=admins");
  const allowedOrigins = parsed.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean);
  if (!env.ALLOWED_ORIGINS?.trim() || allowedOrigins.length === 0) {
    problems.push("ALLOWED_ORIGINS must be explicitly set to one or more HTTPS origins");
  }
  if (new Set(allowedOrigins).size !== allowedOrigins.length) problems.push("ALLOWED_ORIGINS must not contain duplicates");
  // Production deployment terminates TLS at a reverse proxy. Without an
  // explicit peer allowlist, every proxied player would share the proxy IP
  // for login/register rate limits, or attacker-supplied XFF could be trusted.
  const trustedProxyIps = parsed.TRUSTED_PROXY_IPS.split(",").map((ip) => ip.trim()).filter(Boolean);
  if (!env.TRUSTED_PROXY_IPS?.trim() || trustedProxyIps.length === 0) {
    problems.push("TRUSTED_PROXY_IPS must explicitly list the exact reverse-proxy peer IPs");
  }
  for (const origin of allowedOrigins) {
    try {
      const url = new URL(origin);
      if (url.protocol !== "https:" || url.origin !== origin || url.username || url.password) {
        problems.push("ALLOWED_ORIGINS must contain exact HTTPS origins without paths or credentials");
      }
    } catch {
      problems.push("ALLOWED_ORIGINS contains an invalid origin");
    }
  }
  if (parsed.PORT === 0) problems.push("PORT must be non-zero in production");
  try {
    const protocol = new URL(parsed.DATABASE_URL).protocol;
    if (protocol !== "postgres:" && protocol !== "postgresql:") problems.push("DATABASE_URL must use PostgreSQL");
  } catch {
    problems.push("DATABASE_URL must be a valid PostgreSQL URL");
  }
  if (problems.length > 0) {
    // Never include actual env values here: configuration errors must not leak secrets.
    throw new Error("Production configuration rejected: " + problems.join("; "));
  }
}
export function loadConfig(env: NodeJS.ProcessEnv = process.env): HostConfig {
  let parsed: z.infer<typeof configSchema>;
  try {
    parsed = configSchema.parse(env);
  } catch (error) {
    // Понятная подсказка вместо простыни разбора: чаще всего нет файла .env.
    const missing = ["DATABASE_URL", "SESSION_SECRET"].filter((key) => !env[key]);
    const hint =
      missing.length > 0
        ? `Не задано: ${missing.join(", ")}. Создайте файл .env: cp .env.example .env и заполните его.`
        : "Проверьте настройки окружения и файл .env.";
    throw new Error(`${hint}\n${String(error)}`);
  }
  assertProductionConfig(parsed, env);
  const trustedProxyIps = parsed.TRUSTED_PROXY_IPS.split(",").map((ip) => {
    const normalized = ip.trim().toLowerCase();
    return normalized.startsWith("::ffff:") ? normalized.slice(7) : normalized;
  }).filter(Boolean);
  if (trustedProxyIps.some((ip) => isIP(ip) === 0)) {
    throw new Error("TRUSTED_PROXY_IPS must contain exact IPv4/IPv6 addresses; CIDR ranges are not supported");
  }
  if (new Set(trustedProxyIps).size !== trustedProxyIps.length) {
    throw new Error("TRUSTED_PROXY_IPS must not contain duplicates");
  }
  return {
    ...parsed,
    registrationOpen: parsed.REGISTRATION_OPEN === "1",
    adminToken: parsed.ADMIN_TOKEN,
    adminLogins: parsed.ADMIN_LOGINS.split(",")
      .map((login) => login.trim().toLowerCase())
      .filter((login) => login.length > 0),
    allowedOrigins: parsed.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean),
    trustedProxyIps,
    accessPublic: parsed.ACCESS_MODE === "public",
    commandRate: parsed.COMMAND_RATE,
    isProduction: parsed.NODE_ENV === "production",
  };
}
