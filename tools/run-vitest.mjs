#!/usr/bin/env node
/**
 * Запуск vitest с проверкой результата.
 *
 * Зачем: установленный vitest 5.0.1 возвращает код 0 даже при упавших тестах
 * (проверено 14.10: forks, threads и JSON-отчёт с numFailedTests: 1).
 * Поэтому обёртка читает итоговые строки вывода и сама выходит с кодом 1,
 * если есть провалы, ошибки набора или ненулевой код самого vitest.
 *
 * Использование (из папки пакета): node ../../tools/run-vitest.mjs run [аргументы]
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const bin = join(process.cwd(), "node_modules", ".bin", "vitest");
if (!existsSync(bin)) {
  process.stderr.write(`run-vitest: не найден ${bin}. Выполните pnpm install.\n`);
  process.exit(1);
}

const ANSI = /\x1b\[[0-9;]*[A-Za-z]/g;
// Итоговые строки vitest: «Tests  1 failed | 2 passed (3)», «Test Files  1 failed (1)».
const FAILED_SUMMARY = /^\s*(Tests|Test Files)\s+.*\bfailed\b/m;
const ERROR_LINE = /^\s*(Unhandled Error|Unhandled Rejection|Vitest caught \d+ unhandled error)/m;

let captured = "";
const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
const relay = (chunk, target) => {
  const text = chunk.toString();
  captured += text;
  target.write(text);
};
child.stdout.on("data", (chunk) => relay(chunk, process.stdout));
child.stderr.on("data", (chunk) => relay(chunk, process.stderr));

child.on("error", (error) => {
  process.stderr.write(`run-vitest: не удалось запустить vitest: ${error.message}\n`);
  process.exit(1);
});

child.on("close", (code, signal) => {
  const plain = captured.replace(ANSI, "");
  const failed = FAILED_SUMMARY.test(plain) || ERROR_LINE.test(plain);
  const hasSummary = /^\s*Tests\s+/m.test(plain) || /No test files found/.test(plain);
  if (signal) {
    process.stderr.write(`run-vitest: vitest завершён сигналом ${signal}\n`);
    process.exit(1);
  }
  if (failed) {
    process.stderr.write("run-vitest: есть упавшие тесты или ошибки — код 1 (vitest сам мог вернуть 0).\n");
    process.exit(1);
  }
  if (code !== 0) {
    process.stderr.write(`run-vitest: vitest вернул код ${code}.\n`);
    process.exit(code ?? 1);
  }
  if (!hasSummary && !args.includes("--passWithNoTests")) {
    process.stderr.write("run-vitest: в выводе нет итоговой строки «Tests» — результат не проверен, код 1.\n");
    process.exit(1);
  }
  process.exit(0);
});
