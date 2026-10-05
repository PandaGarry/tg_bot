/**
 * Экран мира: склад, гнёзда модулей, отчёты. Клиент ничего не считает сам:
 * числа приходят снимком и патчем.
 */

import { useEffect, useRef, useState } from "react";
import type { Locale, SlotId, WorldViewBase } from "@tdl/protocol";
import { translator } from "../i18n/index.js";
import { Slot } from "../slots.js";
import { logout, sendCommand } from "../net.js";
import { ICON_SRC } from "./iconSrc.js";
import { store } from "../store.js";
import { addChronicle, hasChronicle } from "../shell/chronicle.js";
import { CourtScene } from "../court/CourtScene.js";
import { Chronicle } from "./Chronicle.js";
import { Hud } from "./Hud.js";
import { ResourceStrip } from "./ResourceStrip.js";
import "../hud.css";
import { Diagnostics } from "./Diagnostics.js";

// Карта мира появится отдельным экраном позже. Пока центральная вкладка возвращает во двор.
const NAV: { route: string; key: string; icon: string; center?: boolean }[] = [
  { route: "tasks", key: "shell.nav.tasks", icon: "quill" },
  { route: "reports", key: "shell.nav.mail", icon: "mail" },
  { route: "court", key: "shell.nav.court", icon: "banner", center: true },
  { route: "clan", key: "shell.nav.clan", icon: "shield" },
  { route: "settings", key: "shell.nav.settings", icon: "gear" },
];

export function World({ view, lang, serverNow }: { view: WorldViewBase; lang: Locale; serverNow: number }) {
  const t = translator(lang);
  const [route, setRoute] = useState("court");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [hudPanelOpen, setHudPanelOpen] = useState(false);
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
          <div className="fixed inset-0 z-0">
            <CourtScene
              texts={{ rotate: t("shell.court.rotate"), nowebgl: t("shell.court.nowebgl") }}
              grid={court.grid ?? null}
              thLevel={Number(court.townhallLevel ?? 1)}
              tool={placing ? { kind: "place", type: placing } : roadTool ? { kind: "road" } : null}
              pending={pending}
              onTarget={(x, z) => {
                if (pending) setPending({ ...pending, x, z });
                else if (placing) {
                  setPending({ type: placing, x, z });
                  setPlacing(null);
                }
              }}
              onRoad={(x, z, has) => {
                if (roadTool) sendCommand("court.road", { x, z, remove: has });
              }}
              onPickup={(type, x, z) => {
                setPlacing(null);
                setRoadTool(false);
                setPending({ type, x, z, from: { x, z } });
              }}
            />
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
            onPanelOpenChange={setHudPanelOpen}
          />
          {!hudPanelOpen && !placing && !pending && !roadTool ? <CourtTape lang={lang} /> : null}
        </>
      ) : null}
      {route !== "court" ? (
        <>
      <header className="world-topbar">
        <ResourceStrip stock={view.stock ?? {}} lang={lang} className="world-resourcebar" />
      </header>

      <section className="world-content">
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

        {route === "tasks" ? <SystemPage lang={lang} title="shell.tasks.title" body="shell.tasks.empty" icon="quill" /> : null}
        {route === "reports" ? <Reports lang={lang} /> : null}
        {route === "clan" ? <SystemPage lang={lang} title="shell.hud.clan" body="shell.clan.empty" icon="shield" /> : null}
        {route === "chronicle" ? <Chronicle lang={lang} /> : null}
        {route === "sheet" ? (
          <Slot
            slot={"sheet" as SlotId}
            view={view}
            lang={lang}
            serverNow={serverNow}
            extra={{ opened: true, open: () => undefined, close: () => undefined }}
            empty={<Panel>{t("shell.sheet.empty")}</Panel>}
          />
        ) : null}

        </section>
        </>
      ) : null}

      <nav className="game-nav" aria-label={t("shell.nav.primary")}>
        <div className="nav-inner">
          {NAV.map((item) => {
            const isSettings = item.route === "settings";
            const active = isSettings ? sheetOpen : route === item.route;
            return (
              <button
                key={item.route}
                type="button"
                className={`nav-item${item.center ? " nav-center" : ""}${active ? " active" : ""}`}
                aria-current={!isSettings && active ? "page" : undefined}
                aria-label={t(item.key)}
                onClick={() => {
                  if (isSettings) {
                    setSheetOpen(true);
                    return;
                  }
                  setSheetOpen(false);
                  setRoute(item.route);
                }}
              >
                <img className="nic" src={ICON_SRC[item.icon] ?? "icons/i-gear.png"} alt="" />
                <span>{t(item.key)}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {sheetOpen ? (
        <div className="hud-overlay" onClick={() => setSheetOpen(false)}>
          <section className="settings-sheet" role="dialog" aria-modal="true" aria-label={t("shell.nav.settings")} onClick={(event) => event.stopPropagation()}>
            <header className="settings-head">
              <div><span className="eyebrow">{t("shell.settings.eyebrow")}</span><h2>{t("shell.nav.settings")}</h2></div>
              <button type="button" className="hud-panel-close" aria-label={t("shell.close")} onClick={() => setSheetOpen(false)}>×</button>
            </header>
            <div className="settings-shortcuts">
              <button type="button" onClick={() => { setRoute("chronicle"); setSheetOpen(false); }}>
                <img src={ICON_SRC.quill} alt="" /><span>{t("shell.nav.chronicle")}</span>
              </button>
              <button type="button" onClick={() => { setRoute("sheet"); setSheetOpen(false); }}>
                <img src={ICON_SRC.gear} alt="" /><span>{t("shell.nav.sheet")}</span>
              </button>
            </div>
            <Slot
              slot={"sheet" as SlotId}
              view={view}
              lang={lang}
              serverNow={serverNow}
              extra={{ opened: sheetOpen, open: () => setSheetOpen(true), close: () => setSheetOpen(false) }}
              empty={<Panel>{t("shell.sheet.empty")}</Panel>}
            />
            <Diagnostics lang={lang} />
            <div className="settings-account">
              <b>{t("shell.account.title")}</b>
              <p>{t("shell.account.note")}</p>
              <button type="button" onClick={() => logout()}>{t("shell.account.logout")}</button>
            </div>
          </section>
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

function SystemPage({ lang, title, body, icon }: { lang: Locale; title: string; body: string; icon: string }) {
  const t = translator(lang);
  return (
    <section className="system-page">
      <span className="system-page-icon"><img src={ICON_SRC[icon] ?? "icons/i-gear.png"} alt="" /></span>
      <p className="eyebrow">{t("shell.page.eyebrow")}</p>
      <h1>{t(title)}</h1>
      <p className="system-page-note">{t(body)}</p>
    </section>
  );
}

function Reports({ lang }: { lang: Locale }) {
  const t = translator(lang);
  const state = store.get();
  return (
    <section className="inbox-page">
      <header className="page-heading">
        <img src={ICON_SRC.mail} alt="" />
        <div><p className="eyebrow">{t("shell.page.eyebrow")}</p><h1>{t("shell.reports.title")}</h1></div>
      </header>
      {state.reports.length === 0 ? <Panel>{t("shell.reports.empty")}</Panel> : null}
      {state.reports.map((report, index) => (
        <Panel key={`${report.at}-${index}`}>
          <ul className="report-rows">
            {report.rows.map((row, rowIndex) => (
              <li key={`${row.key}-${rowIndex}`}>{t(row.key, row.params)}</li>
            ))}
          </ul>
        </Panel>
      ))}
    </section>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="world-card">{children}</div>;
}
