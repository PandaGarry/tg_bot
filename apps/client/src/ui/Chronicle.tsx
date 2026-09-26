/**
 * Хроника: слова хрониста, которые остаются у игрока. Тексты хранятся
 * ключами словаря, поэтому смена языка переводит и прошлые записи.
 */

import type { Locale } from "@tdl/protocol";
import { translator } from "../i18n/index.js";
import { useChronicle } from "../shell/chronicle.js";

export function Chronicle({ lang }: { lang: Locale }) {
  const t = translator(lang);
  const entries = useChronicle();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
      <h2 className="text-sm text-stone-400">{t("shell.chronicle.title")}</h2>
      <p className="text-xs text-stone-500">{t("shell.chronicle.note")}</p>
      {entries.length === 0 ? (
        <Panel>{t("shell.chronicle.empty")}</Panel>
      ) : (
        entries.map((entry) => (
          <Panel key={entry.key}>
            <span className="mb-1 block text-[11px] uppercase tracking-wide text-stone-500">
              {entry.kind === "intro" ? t("shell.chronicle.intro") : t("shell.chronicle.title")}
            </span>
            <span className="text-sm leading-relaxed text-stone-300">{t(entry.key)}</span>
          </Panel>
        ))
      )}
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="rounded border border-stone-800 bg-stone-900/60 p-3">{children}</div>;
}
