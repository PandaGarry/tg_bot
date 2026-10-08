/**
 * Экран мира: склад, гнёзда модулей, отчёты. Клиент ничего не считает сам:
 * числа приходят снимком и патчем.
 */

import { useEffect, useState } from "react";
import type { Locale, SlotId, WorldViewBase } from "@tdl/protocol";
import { translator } from "../i18n/index.js";
import { Slot } from "../slots.js";
import { logout, sendCommand } from "../net.js";
import { store } from "../store.js";
import { useRef } from "react";
import { addChronicle, hasChronicle } from "../shell/chronicle.js";
import { Chronicle } from "./Chronicle.js";
import { ConceptHud, type ConceptRoute } from "./ConceptHud.js";
import { ConceptIcon } from "./ConceptIcon.js";
import { MockupSwitcher } from "./MockupSwitcher.js";
import { applyUiMockup, readUiMockup, type UiMockupId } from "./mockups.js";
import "../mockups.css";
import { Diagnostics } from "./Diagnostics.js";
import { bridge } from "../game/bridge.js";
import type { CourtGrid, CourtPendingPlacement, CourtSceneMode, CourtState } from "../shared/court.js";

export function World({ view, lang, serverNow }: { view: WorldViewBase; lang: Locale; serverNow: number }) {
  const t = translator(lang);
  const [route, setRoute] = useState<ConceptRoute>("court");
  const [mockup, setMockup] = useState<UiMockupId>(() => readUiMockup());
  const [, forceTick] = useState(0);
  // Режим стройки: выбранная карточка, режим дороги и подтверждаемая постановка.
  const [placing, setPlacing] = useState<string | null>(null);
  const [roadTool, setRoadTool] = useState(false);
  const [pending, setPending] = useState<CourtPendingPlacement | null>(null);
  // Серверный вид двора; сцена принимает его через bridge и ничего не считает сама.
  const court = (view.modules.court ?? {}) as CourtState;
  const grid = court.grid as CourtGrid | undefined;

  useEffect(() => {
    const timer = window.setInterval(() => forceTick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => applyUiMockup(mockup), [mockup]);

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

  // Авторитетный серверный снимок двора → Pixi. Bridge запоминает последний снимок,
  // поэтому поздняя инициализация WebGL не теряет первую сетку.
  useEffect(() => {
    bridge.emit("state:update", { court });
  }, [court.grid, court.townhallLevel]);

  // Режимы интерфейса влияют только на призрак/ввод сцены, но не на данные игры.
  useEffect(() => {
    const mode: CourtSceneMode = { active: route === "court", placing, roadTool, pending };
    bridge.emit("scene:mode", mode);
  }, [route, placing, roadTool, pending]);

  useEffect(() => {
    const onTileClick = ({ x, z }: { x: number; z: number }): void => {
      if (route !== "court") return;
      if (placing) {
        setPending({ type: placing, x, z });
        setPlacing(null);
        return;
      }
      if (roadTool) {
        const exists = grid?.roads.some((road) => road.x === x && road.z === z) ?? false;
        sendCommand("court.road", exists ? { x, z, remove: true } : { x, z });
        return;
      }
      if (pending?.from) setPending({ ...pending, x, z });
    };

    const onBuildingClick = ({ type, x, z }: { type: string; x: number; z: number }): void => {
      if (route !== "court") return;
      if (placing || roadTool || pending?.from) {
        onTileClick({ x, z });
        return;
      }
      setPending({ type, x, z, from: { x, z } });
    };

    const offTile = bridge.on("tile:click", onTileClick);
    const offBuilding = bridge.on("building:click", onBuildingClick);
    return () => {
      offTile();
      offBuilding();
    };
  }, [route, placing, roadTool, pending, grid]);

  return (
    <main className={`flex flex-col ${route === "court" ? "court-mode" : "app-mode"}`}>
      <ConceptHud
        variant={mockup}
        view={view}
        lang={lang}
        route={route}
        onRouteChange={setRoute}
        placingName={placing ? t(`shell.hud.b.${placing}`) : null}
        pending={
          pending
            ? {
                name: t(`shell.hud.b.${pending.type}`),
                move: Boolean(pending.from),
                ready: !pending.from || pending.x !== pending.from.x || pending.z !== pending.from.z,
                removable: pending.type === "road" || ["lantern", "bench", "well", "flag"].includes(pending.type),
              }
            : null
        }
        roadTool={roadTool}
        onConfirm={() => {
          if (!pending) return;
          if (pending.type === "road" && pending.from) {
            sendCommand("court.road", { x: pending.x, z: pending.z, moveFrom: { x: pending.from.x, z: pending.from.z } });
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
          setPending(null);
          setRoadTool(false);
          setPlacing(type);
        }}
        onRoadTool={() => {
          setPending(null);
          setPlacing(null);
          setRoadTool((value) => !value);
        }}
        onUpgrade={() => sendCommand("court.upgrade")}
      >
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
          <>
            <Slot
              slot={"sheet" as SlotId}
              view={view}
              lang={lang}
              serverNow={serverNow}
              extra={{ opened: true, open: () => undefined, close: () => undefined }}
              empty={<Panel>{t("shell.sheet.title")}: пусто</Panel>}
            />
            <Diagnostics lang={lang} />
            <section className="concept-account-card">
              <div className="concept-account-card__title">{t("shell.account.title")}</div>
              <p>{t("shell.account.note")}</p>
              <button type="button" onClick={() => logout()}>{t("shell.account.logout")}</button>
            </section>
          </>
        ) : null}
      </ConceptHud>
      {route === "court" ? <CourtTape lang={lang} variant={mockup} /> : null}
      <MockupSwitcher lang={lang} selected={mockup} onSelect={setMockup} />
    </main>
  );
}

/** Лента хрониста поверх сцены: первая фраза про частокол, закрывается один раз. */
function CourtTape({ lang, variant }: { lang: Locale; variant: UiMockupId }) {
  const t = translator(lang);
  const [hidden, setHidden] = useState(() => localStorage.getItem("tdl.tape.palisade") === "1");
  if (hidden) return null;
  return (
    <aside className={`concept-narrative concept-narrative--${variant}`}>
      <span className="concept-narrative__seal"><ConceptIcon name="chronicle" /></span>
      <div className="concept-narrative__copy">
        <small>{lang === "ru" ? "ЗАПИСЬ ЛЕТОПИСЦА" : "CHRONICLER'S NOTE"}</small>
        <p>{t("shell.tutor.palisade")}</p>
      </div>
      <button
        type="button"
        aria-label={t("shell.tape.ok")}
        onClick={() => {
          localStorage.setItem("tdl.tape.palisade", "1");
          setHidden(true);
        }}
      >
        {t("shell.tape.ok")}
      </button>
    </aside>
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
  return <div className="world-panel rounded border border-stone-800 bg-stone-900/60 p-3 text-sm text-stone-400">{children}</div>;
}
