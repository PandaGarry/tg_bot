/**
 * Экран мира: склад, гнёзда модулей, отчёты. Клиент ничего не считает сам:
 * числа приходят снимком и патчем.
 */

import { useEffect, useState } from "react";
import type { Locale, SlotId, WorldViewBase } from "@tdl/protocol";
import { translator } from "../i18n/index.js";
import { Slot, hasSlot } from "../slots.js";
import { store } from "../store.js";
import { Diagnostics } from "./Diagnostics.js";

const NAV: { route: string; key: string }[] = [
  { route: "court", key: "shell.nav.court" },
  { route: "map", key: "shell.nav.map" },
  { route: "reports", key: "shell.nav.reports" },
  { route: "sheet", key: "shell.nav.sheet" },
];

export function World({ view, lang, serverNow }: { view: WorldViewBase; lang: Locale; serverNow: number }) {
  const t = translator(lang);
  const [route, setRoute] = useState("court");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [, forceTick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => forceTick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <main className="flex min-h-[100dvh] flex-col">
      <header className="sticky top-0 z-10 border-b border-stone-800 bg-stone-950/95 pt-[env(safe-area-inset-top)]">
        <Slot slot={"hud.resources" as SlotId} view={view} lang={lang} serverNow={serverNow} empty={<ResourceBar view={view} lang={lang} />} />
      </header>

      <section className="flex-1 overflow-y-auto p-3">
        {route === "court" ? (
          <Slot
            slot={"court.view" as SlotId}
            view={view}
            lang={lang}
            serverNow={serverNow}
            empty={<Panel>{t("shell.court.stub")}</Panel>}
          />
        ) : null}

        {route === "map" ? (
          <Slot
            slot={"map.layers" as SlotId}
            view={view}
            lang={lang}
            serverNow={serverNow}
            extra={{
              draw: {
                tileSize: 16,
                scale: 1,
                width: 0,
                height: 0,
                visible: { x: 0, y: 0, w: 0, h: 0 },
                project: (x: number, y: number) => ({ sx: x * 16, sy: y * 16 }),
                mark: () => undefined,
                fill: () => undefined,
                line: () => undefined,
              },
            }}
            empty={<Panel>{t("shell.court.stub")}</Panel>}
          />
        ) : null}

        {route === "reports" ? <Reports lang={lang} /> : null}
        {route === "sheet" ? (
          <Slot
            slot={"sheet" as SlotId}
            view={view}
            lang={lang}
            serverNow={serverNow}
            extra={{ opened: true, open: () => undefined, close: () => undefined }}
            empty={<Panel>{t("shell.sheet.title")}: пусто</Panel>}
          />
        ) : null}

        <Diagnostics lang={lang} />
      </section>

      <nav className="sticky bottom-0 border-t border-stone-800 bg-stone-950/95 pb-[env(safe-area-inset-bottom)]">
        <div className="flex">
          {NAV.map((item) => (
            <button
              key={item.route}
              type="button"
              onClick={() => {
                setRoute(item.route);
                if (item.route === "sheet") setSheetOpen(true);
              }}
              className={`min-h-[44px] flex-1 text-xs ${
                route === item.route ? "text-bone" : "text-stone-500"
              }`}
            >
              {t(item.key)}
            </button>
          ))}
        </div>
      </nav>

      {sheetOpen && !hasSlot("sheet" as SlotId) ? null : null}
      {sheetOpen ? (
        <div className="fixed inset-0 z-20 flex items-end bg-black/70" onClick={() => setSheetOpen(false)}>
          <div
            className="max-h-[80dvh] w-full overflow-y-auto rounded-t-lg border-t border-stone-700 bg-stone-950 p-3"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm text-stone-400">{t("shell.sheet.title")}</span>
              <button type="button" onClick={() => setSheetOpen(false)} className="min-h-[44px] px-3 text-sm text-stone-400">
                {t("shell.close")}
              </button>
            </div>
            <Slot
              slot={"sheet" as SlotId}
              view={view}
              lang={lang}
              serverNow={serverNow}
              extra={{ opened: sheetOpen, open: () => setSheetOpen(true), close: () => setSheetOpen(false) }}
              empty={<Panel>пусто</Panel>}
            />
          </div>
        </div>
      ) : null}
    </main>
  );
}

function ResourceBar({ view, lang }: { view: WorldViewBase; lang: Locale }) {
  const labels = translator(lang);
  const names: Record<string, string> = {
    meat: "shell.hud.meat",
    wood: "shell.hud.wood",
    stone: "shell.hud.stone",
    metal: "shell.hud.metal",
    mushrooms: "shell.hud.mushrooms",
  };
  const entries = Object.entries(view.stock ?? {});
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 px-3 py-2 text-xs">
      {entries.length === 0 ? <span className="text-stone-500">склад пуст</span> : null}
      {entries.map(([id, amount]) => (
        <span key={id} className="text-stone-400">
          {names[id] ? labels(names[id] as string) : id}: <span className="font-mono text-bone">{amount}</span>
        </span>
      ))}
    </div>
  );
}

function Reports({ lang }: { lang: Locale }) {
  const t = translator(lang);
  const state = store.get();
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm text-stone-400">{t("shell.reports.title")}</h2>
      {state.reports.length === 0 ? <Panel>{t("shell.reports.empty")}</Panel> : null}
      {state.reports.map((report, index) => (
        <Panel key={`${report.at}-${index}`}>
          <ul className="flex flex-col gap-1 text-sm text-stone-300">
            {report.rows.map((row, rowIndex) => (
              <li key={`${row.key}-${rowIndex}`}>{t(row.key, row.params)}</li>
            ))}
          </ul>
        </Panel>
      ))}
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="rounded border border-stone-800 bg-stone-900/60 p-3 text-sm text-stone-400">{children}</div>;
}
