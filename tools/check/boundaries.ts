/**
 * Границы пакетов. Сборка падает, если модуль импортирует другой модуль,
 * если модуль тянет хост или базу, если клиент тянет серверный код,
 * а ядро знает имена модулей и ресурсов.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { modules } from "@tdl/modules";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const problems: string[] = [];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

function importsOf(file: string): string[] {
  const source = readFileSync(file, "utf8");
  const specifiers: string[] = [];
  const pattern = /(?:from\s+|import\s*\(\s*)["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) specifiers.push(match[1] as string);
  return specifiers;
}

const modulesRoot = join(root, "packages", "modules");
const moduleDirs = readdirSync(modulesRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules")
  .map((entry) => entry.name);

const packageNames = new Map<string, string>();
for (const dir of moduleDirs) {
  const pkgPath = join(modulesRoot, dir, "package.json");
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    packageNames.set(pkg.name, dir);
  } catch {
    problems.push(`модуль ${dir} без package.json`);
  }
}

// Модуль не импортирует другой модуль и не тянет хост с базой.
const forbiddenForModules = ["@tdl/host", "@tdl/modules", "pg", "drizzle-orm"];
for (const dir of moduleDirs) {
  const own = join(modulesRoot, dir);
  const ownName = [...packageNames.entries()].find(([, value]) => value === dir)?.[0];
  for (const file of walk(own)) {
    for (const specifier of importsOf(file)) {
      const target = packageNames.get(specifier);
      if (target && target !== dir) {
        problems.push(`${relative(root, file)}: модуль ${dir} импортирует модуль ${target}`);
      }
      if (target && target === dir && specifier !== ownName) {
        problems.push(`${relative(root, file)}: модуль ${dir} импортирует себя по имени пакета`);
      }
      for (const bad of forbiddenForModules) {
        if (specifier === bad || specifier.startsWith(`${bad}/`)) {
          problems.push(`${relative(root, file)}: модулю нельзя тянуть ${specifier}`);
        }
      }
    }
  }
}

// Ядро не знает имён модулей и ресурсов.
const kernelFiles = walk(join(root, "packages", "kernel", "src"));
const kernelSource = kernelFiles.map((file) => readFileSync(file, "utf8")).join("\n");
for (const definition of modules) {
  if (kernelSource.includes(`"${definition.id}"`) || kernelSource.includes(`'${definition.id}'`)) {
    problems.push(`ядро знает имя модуля ${definition.id}`);
  }
  for (const resource of definition.rules?.resources ?? []) {
    if (kernelSource.includes(resource.id)) problems.push(`ядро знает имя ресурса ${resource.id}`);
  }
  for (const table of definition.server?.tables ?? []) {
    if (kernelSource.includes(table)) problems.push(`ядро знает имя таблицы модуля ${table}`);
  }
}

// Клиент не тянет серверные пакеты.
const clientRoot = join(root, "apps", "client");
if (statSync(clientRoot, { throwIfNoEntry: false })) {
  for (const file of walk(join(clientRoot, "src"))) {
    for (const specifier of importsOf(file)) {
      if (specifier === "@tdl/host" || specifier.startsWith("@tdl/host/")) {
        problems.push(`${relative(root, file)}: клиент импортирует хост`);
      }
      if (packageNames.has(specifier)) {
        problems.push(`${relative(root, file)}: клиент импортирует модуль напрямую, только через реестр`);
      }
    }
  }
}

// Ядро не зависит от хоста, протокола и модулей.
const kernelPkg = JSON.parse(readFileSync(join(root, "packages", "kernel", "package.json"), "utf8"));
for (const dependency of Object.keys({ ...kernelPkg.dependencies, ...kernelPkg.devDependencies })) {
  if (["@tdl/host", "@tdl/protocol", "@tdl/modules", "pg", "drizzle-orm", "react"].includes(dependency)) {
    problems.push(`ядро зависит от ${dependency}`);
  }
}

if (problems.length === 0) {
  console.log(`границы пакетов в порядке: ${moduleDirs.length} модул(ей), ядро без имён игры`);
} else {
  console.error(`Границы пакетов сломаны:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
