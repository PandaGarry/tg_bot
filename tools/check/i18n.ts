/**
 * Тексты: ключ есть в ru и en, ключ, который просит экран, есть в словаре.
 * Сборка падает на любом расхождении: игрок не должен видеть сырой ключ.
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { kernelStrings, KERNEL_KEYS } from "@tdl/protocol";
import { modules } from "@tdl/modules";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const problems: string[] = [];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** Ключи, которые просит код: t("ключ") и t('ключ'). */
function usedKeys(file: string): string[] {
  const source = readFileSync(file, "utf8");
  const keys: string[] = [];
  const pattern = /\bt\(\s*["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) keys.push(match[1] as string);
  return keys;
}

function parity(where: string, ru: Record<string, string>, en: Record<string, string>): void {
  for (const key of Object.keys(ru)) {
    if (!(key in en)) problems.push(`${where}: ключ ${key} есть в ru и нет в en`);
  }
  for (const key of Object.keys(en)) {
    if (!(key in ru)) problems.push(`${where}: ключ ${key} есть в en и нет в ru`);
  }
}

// Слова ядра и оболочки.
parity("ядро", kernelStrings.ru, kernelStrings.en);

const shellPath = join(root, "apps", "client", "src", "i18n", "shell.ts");
let shellRu: Record<string, string> = {};
let shellEn: Record<string, string> = {};
try {
  const shellModule = (await import(shellPath)) as { shellStrings: { ru: Record<string, string>; en: Record<string, string> } };
  shellRu = shellModule.shellStrings.ru;
  shellEn = shellModule.shellStrings.en;
  parity("оболочка", shellRu, shellEn);
} catch {
  problems.push("оболочка: нет apps/client/src/i18n/shell.ts со словарями ru и en");
}

// Модули: слова самого модуля и ключи, которые он просит на экране.
for (const definition of modules) {
  const ru = (definition.content?.strings.ru ?? {}) as Record<string, string>;
  const en = (definition.content?.strings.en ?? {}) as Record<string, string>;
  parity(`модуль ${definition.id}`, ru, en);
  const dir = join(root, "packages", "modules", definition.id, "src");
  for (const file of walk(dir)) {
    for (const key of usedKeys(file)) {
      if (!(key in ru)) {
        problems.push(`${relative(root, file)}: ключ ${key} не объявлен в словаре модуля ${definition.id}`);
      }
    }
  }
}

// Клиент: ключи ядра и оболочки.
const clientSrc = join(root, "apps", "client", "src");
const kernelKeys = new Set(Object.keys(kernelStrings.ru));
const shellKeys = new Set(Object.keys(shellRu));
for (const file of walk(clientSrc)) {
  if (file.includes(`${join("src", "i18n")}`)) continue;
  for (const key of usedKeys(file)) {
    if (kernelKeys.has(key) || shellKeys.has(key)) continue;
    // Ключ модуля клиент берёт через словарь модуля, не через t().
    problems.push(`${relative(root, file)}: ключ ${key} неизвестен ни ядру, ни оболочке`);
  }
}

// Ключи отказов ядра должны быть в словаре ядра.
for (const key of Object.values(KERNEL_KEYS)) {
  if (!kernelKeys.has(key)) problems.push(`ядро: ключ отказа ${key} без текста`);
}

if (problems.length === 0) {
  console.log(
    `тексты в порядке: ядро ${kernelKeys.size} ключей, оболочка ${shellKeys.size} ключей, модулей ${modules.length}`,
  );
} else {
  console.error(`Тексты сломаны:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
