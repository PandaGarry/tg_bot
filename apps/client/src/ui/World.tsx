/**
 * Экран мира: склад, гнёзда модулей, отчёты. Клиент ничего не считает сам:
 * числа приходят снимком и патчем.
 */

import { useEffect, useState } from "react";
import type { Locale, SlotId, WorldViewBase } from "@tdl/protocol";
import { translator } from "../i18n/index.js";
import { Slot, hasSlot } from "../slots.js";
import { logout, sendCommand } from "../net.js";
import { ICON_SRC } from "./iconSrc.js";
import { store } from "../store.js";
import { useRef } from "react";
import { addChronicle, hasChronicle } from "../shell/chronicle.js";
import { CourtPlaceholder } from "./CourtPlaceholder.js";
import { Chronicle } from "./Chronicle.js";
import { Hud } from "./Hud.js";
import "../hud.css";
import { Diagnostics } from "./Diagnostics.js";

// Карта — в центре дока (решение заказчика, круг 18); по краям — чтение и служебное.
const NAV: { route: string; key: string; icon: string; center?: boolean }[] = [
  { route: "court", key: "shell.nav.court", icon: "banner" },
  { route: "reports", key: "shell.nav.reports", icon: "scroll" },
  { route: "map", key: "shell.nav.map", icon: "map", center: true },
  { route: "chronicle", key: "shell.nav.chronicle", icon: "quill" },
  { route: "sheet", key: "shell.nav.sheet", icon: "gear" },
];

export function World({ view, lang, serverNow }: { view: WorldViewBase; lang: Locale; serverNow: number }) {
  const t = translator(lang);
  const [route, setRoute] = useState("court");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [, forceTick] = useState(0);
  // Режим стройки: выбранная карточка, режим дороги и подтверждаемая постановка.
  const [placing, setPlacing] = useState<string | null>(null);
  const [roadTool, setRoadTool] = useState(false);
  const [pending, setPending] = useState<{
    type: string;
    x: number;
    z: number;
    from?: { x: number; z: number };
  } | null>(null);
  // Данные модуля двора из вида: сетку и уровень Ратуши рисует сцена.
  const court = (view.modules.court ?? {}) as {
    grid?: { size: number; buildings: { type: string; x: number; z: number }[]; roads: { x: number; z: number }[] };
    townhallLevel?: number;
  };

  useEffect(() => {
    const timer = window.setInterval(() => forceTick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Хронист говорит один раз: первая фраза остаётся в хронике навсегда.
  useEffect(() => {
    if (!hasChronicle("shell.tutor.palisade")) addChronicle("shell.tutor.palisade", "narrator", serverNow);
  }, [serverNow]);

  // Вход во двор: сервер отдаёт сетку, стартовый набор и заводит такт.
  const courtEntered = useRef(false);
  useEffect(() => {
    if (route !== "court" || courtEntered.current || !view.me) return;
    courtEntered.current = true;
    sendCommand("court.enter");
  }, [route, view.me]);

  return (
    // на дворе фиксированный контейнер вместо dvh: навигация не прыгает после поворота (круг 13)
    <main className={`flex flex-col ${route === "court" ? "court-mode" : "app-mode"}`}>
      {route === "court" ? (
        <>
          {/* Оконце сцены: в этап 0 — 2D-заглушка, в этап 1+ сцена живёт в
              #pixi-root позади HUD, поэтому слой не перехватывает клики. */}
          <div className="pointer-events-none fixed inset-0 z-0">
            <CourtPlaceholder size={Number(court.grid?.size ?? 14)} label={t("shell.court.scene2d")} />
          </div>
          <Hud
            view={view}
            lang={lang}
            placingName={placing ? t(`shell.hud.b.${placing}`) : null}
            pending={
              pending
                ? {
                    name: t(`shell.hud.b.${pending.type}`),
                    move: Boolean(pending.from),
                    // сносить можно только декор и плиты дороги
                    removable: pending.type === "road" || ["lantern", "bench", "well", "flag"].includes(pending.type),
                  }
                : null
            }
            roadTool={roadTool}
            onConfirm={() => {
              if (!pending) return;
              if (pending.type === "road" && pending.from) {
                // перенос плиты дороги — одна атомарная команда
                sendCommand("court.road", { x: pending.x, z: pending.z, moveFrom: pending.from });
              } else if (pending.from) {
                sendCommand("court.move", {
                  type: pending.type,
                  fromX: pending.from.x,
                  fromZ: pending.from.z,
                  toX: pending.x,
                  toZ: pending.z,
                });
              } else {
                sendCommand("court.place", { type: pending.type, x: pending.x, z: pending.z });
              }
              setPending(null);
            }}
            onRemove={() => {
              if (!pending?.from) return;
              if (pending.type === "road") {
                sendCommand("court.road", { x: pending.from.x, z: pending.from.z, remove: true });
              } else {
                sendCommand("court.remove", { type: pending.type, x: pending.from.x, z: pending.from.z });
              }
              setPending(null);
            }}
            onCancel={() => {
              setPending(null);
              setRoadTool(false);
              setPlacing(null);
            }}
            onPlaceStart={(type) => {
              setRoadTool(false);
              setPlacing(type);
            }}
            onRoadTool={() => {
              setPlacing(null);
              setRoadTool((value) => !value);
            }}
            onUpgrade={() => sendCommand("court.upgrade")}
          />
          <CourtTape lang={lang} />
        </>
      ) : null}
      {route !== "court" ? (
        <>
      <header className="sticky top-0 z-10 border-b border-stone-800 bg-stone-950/95 pt-[env(safe-area-inset-top)]">
        <Slot slot={"hud.resources" as SlotId} view={view} lang={lang} serverNow={serverNow} empty={<ResourceBar view={view} lang={lang} />} />
      </header>

      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-2 overflow-y-auto p-3 pb-28">
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
            empty={<Panel>{t("shell.map.stub")}</Panel>}
          />
        ) : null}

        {route === "reports" ? <Reports lang={lang} /> : null}
        {route === "chronicle" ? <Chronicle lang={lang} /> : null}
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

        </section>
        </>
      ) : null}

      <nav className="game-nav">
        <div className="flex">
          {NAV.map((item) => (
            <button
              key={item.route}
              type="button"
              onClick={() => {
                setRoute(item.route);
                if (item.route === "sheet") setSheetOpen(true);
              }}
              className={[
                item.center ? "nav-map" : "",
                route === item.route ? "active" : "",
              ]
                .filter(Boolean)
                .join(" ") || undefined}
            >
              <img className="nic" src={ICON_SRC[item.icon] ?? "icons/gear.png"} alt="" />
              <span>{t(item.key)}</span>
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
            {/* Служебная полоса и аккаунт: пока нет экрана настроек, живут здесь. */}
            <Diagnostics lang={lang} />
            <div className="mt-3 border-t border-stone-800 pt-3">
              <div className="mb-1 text-xs uppercase tracking-wide text-stone-500">{t("shell.account.title")}</div>
              <p className="mb-2 text-xs leading-relaxed text-stone-400">{t("shell.account.note")}</p>
              <button
                type="button"
                onClick={() => logout()}
                className="min-h-[44px] w-full rounded border border-stone-700 px-3 text-sm text-bone"
              >
                {t("shell.account.logout")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

/** Лента хрониста поверх сцены: первая фраза про частокол, закрывается один раз. */
function CourtTape({ lang }: { lang: Locale }) {
  const t = translator(lang);
  const [hidden, setHidden] = useState(() => localStorage.getItem("tdl.tape.palisade") === "1");
  if (hidden) return null;
  return (
    <div className="court-tape">
      <span className="flex-1">{t("shell.tutor.palisade")}</span>
      <button
        type="button"
        onClick={() => {
          localStorage.setItem("tdl.tape.palisade", "1");
          setHidden(true);
        }}
      >
        {t("shell.tape.ok")}
      </button>
    </div>
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
    <div className="mx-auto flex w-full max-w-3xl flex-wrap gap-x-3 gap-y-1 px-3 py-2 text-xs">
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
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
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
