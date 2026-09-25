/**
 * Сборка реестра. Сканирует packages/modules/<id>/src/module.ts, пишет
 * registry.gen.ts для сервера и для клиента. Реестр коммитится.
 * Сломанный контракт роняет сборку на шаге проверки, а не здесь.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const modulesDir = join(root, "packages", "modules");
const serverRegistryPath = join(modulesDir, "registry.gen.ts");
const viewsRegistryPath = join(modulesDir, "views.gen.ts");
const modulesPackagePath = join(modulesDir, "package.json");

const BANNER = `// Сгенерировано tools/gen-registry.mjs. Правки затираются: запустите pnpm gen.
`;

function identifier(name) {
  const cleaned = name.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const safe = cleaned.length > 0 ? cleaned : "module";
  return /^[0-9]/.test(safe) ? `m_${safe}` : safe;
}

function readPackageName(dir) {
  const pkgPath = join(dir, "package.json");
  if (!existsSync(pkgPath)) return null;
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  return typeof pkg.name === "string" ? pkg.name : null;
}

function hasView(dir) {
  return existsSync(join(dir, "src", "view.tsx")) || existsSync(join(dir, "src", "view.ts"));
}

function scan() {
  const found = [];
  for (const entry of readdirSync(modulesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".")) continue;
    const dir = join(modulesDir, entry.name);
    const moduleFile = join(dir, "src", "module.ts");
    if (!existsSync(moduleFile)) continue;
    const packageName = readPackageName(dir);
    if (!packageName) {
      throw new Error(`у модуля ${entry.name} нет package.json с именем`);
    }
    found.push({
      dir: entry.name,
      packageName,
      id: identifier(entry.name),
      hasView: hasView(dir),
      hasModule: true,
    });
  }
  found.sort((a, b) => a.dir.localeCompare(b.dir));
  return found;
}

function writeServerRegistry(found) {
  const imports = found.map((module) => `import ${module.id} from "${module.packageName}/module";`).join("\n");
  const list = found.map((module) => `  ${module.id},`).join("\n");
  const content = `${BANNER}
import type { ModuleDefinition } from "@tdl/kernel";
${imports}

/** Все модули сборки. Порядок загрузки считает ядро по depends. */
export const modules: ModuleDefinition[] = [
${list}
];

/** Имена модулей сборки: по ним проверяются границы пакетов. */
export const moduleIds: string[] = [${found.map((module) => `"${module.dir}"`).join(", ")}];
`;
  writeFileSync(serverRegistryPath, content, "utf8");
}

/**
 * Виды модулей лежат в пакете реестра, а не в клиенте: клиент тянет один
 * пакет, а модульные пакеты остаются его зависимостями. Добавление модуля
 * не требует правок клиента.
 */
function writeViewsRegistry(found) {
  const withView = found.filter((module) => module.hasView);
  const imports = withView
    .map((module) => `import ${module.id}View from "${module.packageName}/view";`)
    .join("\n");
  const list = withView.map((module) => `  ${module.id}View,`).join("\n");
  const content = `${BANNER}
import type { ModuleView } from "@tdl/protocol";
${imports.length > 0 ? `${imports}\n` : ""}
/** Виды модулей сборки: гнёзда и слои карты. */
export const views: ModuleView[] = [
${list ? `${list}\n` : ""}];
`;
  writeFileSync(viewsRegistryPath, content, "utf8");
}

/**
 * Зависимости пакета реестра: добавили модуль — он попал и в сборку, и в пакет.
 * Постоянные зависимости ядра реестра здесь же: без них не собрать виды.
 */
const REGISTRY_DEPENDENCIES = {
  "@tdl/kernel": "workspace:*",
  "@tdl/protocol": "workspace:*",
};

function syncModulesPackage(found) {
  const pkg = JSON.parse(readFileSync(modulesPackagePath, "utf8"));
  const wanted = { ...REGISTRY_DEPENDENCIES };
  for (const module of found) {
    wanted[module.packageName] = "workspace:*";
  }
  const current = pkg.dependencies ?? {};
  const same =
    Object.keys(wanted).length === Object.keys(current).length &&
    Object.entries(wanted).every(([name, version]) => current[name] === version);
  if (same) return false;
  pkg.dependencies = Object.fromEntries(Object.entries(wanted).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(modulesPackagePath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  return true;
}

const found = scan();
writeServerRegistry(found);
writeViewsRegistry(found);
const depsChanged = syncModulesPackage(found);
const summary = found.map((module) => `${module.dir}${module.hasView ? " (+вид)" : ""}`).join(", ");
console.log(`реестр: ${found.length} модул(ей) — ${summary || "нет"}`);
if (depsChanged) console.log("зависимости пакета реестра обновлены: запустите pnpm install");
