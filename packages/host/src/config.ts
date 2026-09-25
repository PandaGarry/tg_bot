/**
 * Настройки процесса. Секрет только в окружении: в репозитории и в журнале его нет.
 */

import { existsSync } from "node:fs";
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
  isProduction: boolean;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): HostConfig {
  const parsed = configSchema.parse(env);
  return {
    ...parsed,
    registrationOpen: parsed.REGISTRATION_OPEN === "1",
    isProduction: parsed.NODE_ENV === "production",
  };
}
