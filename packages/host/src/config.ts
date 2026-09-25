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
  /**
   * Команд в секунду на соединение. Тестовый мир поднимает флаг для
   * нагрузочного прогона; на боевом мира флага нет.
   */
  COMMAND_RATE: z.coerce.number().int().min(1).max(1_000).default(20),
  /**
   * Токен оператора: им включают и гасят модули до появления админской панели.
   * Пусто — путь закрыт целиком, а не открыт всем.
   */
  ADMIN_TOKEN: z.string().default(""),
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
  /** Команд в секунду на соединение. */
  commandRate: number;
  isProduction: boolean;
};

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
  return {
    ...parsed,
    registrationOpen: parsed.REGISTRATION_OPEN === "1",
    adminToken: parsed.ADMIN_TOKEN,
    commandRate: parsed.COMMAND_RATE,
    isProduction: parsed.NODE_ENV === "production",
  };
}
