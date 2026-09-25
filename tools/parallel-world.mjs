/**
 * Параллельный мир: тот же код, свой мир, вход только служебным логинам.
 *
 * Так готовятся доработки, не трогая основной мир: переключатели, расписание
 * и календарь живут на мир (`world_id`), поэтому две копии в одной базе не
 * мешают друг другу. Когда всё проверено — доработка уходит в основной мир
 * обычным рестартом (как смена сезона в игре).
 *
 * Настройки берутся из `.env.parallel`: скопируйте `.env.parallel.example`.
 */

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const configPath = join(root, ".env.parallel");
const examplePath = join(root, ".env.parallel.example");

if (!existsSync(configPath)) {
  process.stderr.write(
    `Нет файла .env.parallel — параллельному миру нечего читать.\nСкопируйте образец: cp .env.parallel.example .env.parallel\n`,
  );
  process.exit(1);
}

/** Разбор простого файла окружения: строки «КЛЮЧ=значение», «#» — комментарий. */
function parseEnv(text) {
  const values = {};
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    values[key] = value;
  }
  return values;
}

const fromFile = parseEnv(readFileSync(configPath, "utf8"));
// `.env.example` читается ради общего: базы, секрета, токена оператора.
const base = existsSync(join(root, ".env")) ? parseEnv(readFileSync(join(root, ".env"), "utf8")) : {};
const env = { ...base, ...fromFile, ...process.env };

const required = ["DATABASE_URL", "SESSION_SECRET"];
const missing = required.filter((key) => !env[key]);
if (missing.length > 0) {
  process.stderr.write(`В .env и .env.parallel не задано: ${missing.join(", ")}\n`);
  process.exit(1);
}
if (!env.ADMIN_LOGINS) {
  process.stderr.write("ADMIN_LOGINS пуст: в параллельный мир никто не войдёт. Впишите свой логин.\n");
  process.exit(1);
}

process.stdout.write(
  `Параллельный мир: ${env.WORLD_ID ?? "dev-1"}, порт ${env.PORT ?? 3100}, вход только у ${env.ADMIN_LOGINS}\n`,
);

const args = [
  "watch",
  "--ignore",
  "**/node_modules/**",
  "--ignore",
  "**/dist/**",
  "--ignore",
  ".devdb/**",
  "--ignore",
  "**/.vite-temp/**",
  join(root, "apps/server/src/index.ts"),
];
const child = spawn(join(root, "node_modules/.bin/tsx"), args, { cwd: root, env, stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
