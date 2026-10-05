import { useEffect, useState } from "react";
import type { Locale, WorldViewBase } from "@tdl/protocol";
import { translator } from "../i18n/index.js";
import { BuildPanel } from "./BuildPanel.js";
import { ICON_SRC } from "./iconSrc.js";
import { ResourceStrip, formatAmount } from "./ResourceStrip.js";
import { swatch } from "./Create.js";

type PanelKind = "profile" | "build" | "train" | "sci" | "commanders" | "items" | "shop" | null;
type HudAction = { kind: Exclude<PanelKind, null | "profile">; icon: string; key: string; shortKey: string };

const LEFT_ACTIONS: HudAction[] = [
  { kind: "build", icon: "hammer", key: "shell.hud.build", shortKey: "shell.hud.side.build" },
  { kind: "train", icon: "swords", key: "shell.hud.queue.train", shortKey: "shell.hud.side.train" },
  { kind: "sci", icon: "flask", key: "shell.hud.queue.sci", shortKey: "shell.hud.side.research" },
];

const RIGHT_ACTIONS: HudAction[] = [
  { kind: "commanders", icon: "helmet", key: "shell.hud.commanders", shortKey: "shell.hud.side.commanders" },
  { kind: "items", icon: "bag", key: "shell.hud.items", shortKey: "shell.hud.side.items" },
  { kind: "shop", icon: "shop", key: "shell.hud.shop", shortKey: "shell.hud.side.shop" },
];

const PANEL_ICONS: Record<Exclude<PanelKind, null>, string> = {
  profile: "lord",
  build: "hammer",
  train: "swords",
  sci: "flask",
  commanders: "helmet",
  items: "bag",
  shop: "shop",
};

const PANEL_COPY: Record<Exclude<PanelKind, null>, { title: string; body: string }> = {
  profile: { title: "shell.hud.profile", body: "shell.hud.profile.note" },
  build: { title: "shell.hud.build", body: "shell.hud.soon.build" },
  train: { title: "shell.hud.queue.train", body: "shell.hud.soon.train" },
  sci: { title: "shell.hud.queue.sci", body: "shell.hud.soon.research" },
  commanders: { title: "shell.hud.commanders", body: "shell.hud.soon.commanders" },
  items: { title: "shell.hud.items", body: "shell.hud.soon.items" },
  shop: { title: "shell.hud.shop", body: "shell.hud.soon.shop" },
};

function formatPower(value: number, lang: Locale): string {
  return formatAmount(value, lang);
}

export function Hud({
  view,
  lang,
  placingName,
  pending,
  roadTool,
  onConfirm,
  onRemove,
  onCancel,
  onPlaceStart,
  onRoadTool,
  onUpgrade,
  onPanelOpenChange,
}: {
  view: WorldViewBase;
  lang: Locale;
  placingName: string | null;
  pending: { name: string; move: boolean; removable: boolean } | null;
  roadTool: boolean;
  onConfirm: () => void;
  onRemove: () => void;
  onCancel: () => void;
  onPlaceStart: (type: string) => void;
  onRoadTool: () => void;
  onUpgrade: () => void;
  onPanelOpenChange: (open: boolean) => void;
}) {
  const t = translator(lang);
  const [panel, setPanel] = useState<PanelKind>(null);
  const me = view.me;
  const court = (view.modules.court ?? {}) as { level?: number; power?: number };
  const level = Number(court.level ?? 1);
  const power = Number(court.power ?? 0);
  const panelCopy = panel ? PANEL_COPY[panel] : null;

  useEffect(() => {
    onPanelOpenChange(panel !== null);
  }, [panel, onPanelOpenChange]);

  useEffect(() => {
    if (!panel) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPanel(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [panel]);

  const togglePanel = (kind: Exclude<PanelKind, null>) => {
    setPanel((current) => (current === kind ? null : kind));
  };

  const renderActions = (actions: HudAction[], side: "left" | "right") => (
    <nav className={`hud-rb-row hud-rb-${side}`} aria-label={t(side === "left" ? "shell.hud.actions" : "shell.hud.services")}>
      {actions.map(({ kind, icon, key, shortKey }) => {
        const active = panel === kind;
        return (
          <button
            key={kind}
            type="button"
            className={`hud-action${active ? " active" : ""}`}
            aria-label={t(key)}
            aria-expanded={active}
            title={t(key)}
            onClick={() => togglePanel(kind)}
          >
            <span className="hud-action-image">
              <img className="hud-ic" src={ICON_SRC[icon] ?? "icons/i-gear.png"} alt="" />
            </span>
            <span className="hud-action-label">{t(shortKey)}</span>
          </button>
        );
      })}
    </nav>
  );

  return (
    <>
      <header className="hud-top" aria-label={t("shell.hud.resources")}>
        {me ? (
          <button
            type="button"
            className="hud-lord"
            data-banner={me.bannerColor}
            aria-label={`${t("shell.hud.profile")}: ${me.name}`}
            aria-expanded={panel === "profile"}
            onClick={() => togglePanel("profile")}
          >
            <span className="portrait" style={{ backgroundColor: swatch(me.bannerColor) }}>
              <img className="hud-ic" src="icons/i-lord.png" alt="" />
              <span className="portrait-level">{level}</span>
            </span>
            <span className="rows">
              <span className="name-row">
                <b>{me.name}</b>
                <span className="lord-caret" aria-hidden="true">⌄</span>
              </span>
              <span className="power-row">
                <img src={ICON_SRC.power} alt="" />
                <b>{formatPower(power, lang)}</b>
                <span className="lord-type">{t(`shell.type.${me.type}`)}</span>
              </span>
            </span>
          </button>
        ) : <span className="hud-lord hud-lord-empty" />}

        <ResourceStrip stock={view.stock ?? {}} lang={lang} />
      </header>

      {renderActions(LEFT_ACTIONS, "left")}
      {renderActions(RIGHT_ACTIONS, "right")}

      {panel === "build" ? (
        <BuildPanel
          view={view}
          lang={lang}
          roadTool={roadTool}
          onPlaceStart={(type) => {
            setPanel(null);
            onPlaceStart(type);
          }}
          onRoadTool={() => {
            setPanel(null);
            onRoadTool();
          }}
          onUpgrade={onUpgrade}
        />
      ) : null}

      {panel && panel !== "build" && panelCopy ? (
        <section className="hud-panel" role="dialog" aria-label={t(panelCopy.title)}>
          <header className="hud-panel-head">
            <span className="hud-panel-mark">
              <img src={PANEL_ICONS[panel] === "lord" ? "icons/i-lord.png" : ICON_SRC[PANEL_ICONS[panel]]} alt="" />
            </span>
            <div className="hud-panel-title">
              <b>{t(panelCopy.title)}</b>
              {panel !== "profile" ? <p>{t(panelCopy.body)}</p> : null}
            </div>
            <button type="button" className="hud-panel-close" aria-label={t("shell.close")} onClick={() => setPanel(null)}>×</button>
          </header>
          {panel === "profile" && me ? (
            <dl className="hud-profile-details">
              <div><dt>{t("shell.hud.level")}</dt><dd>{level}</dd></div>
              <div><dt>{t("shell.hud.power.label")}</dt><dd>{formatPower(power, lang)}</dd></div>
              <div><dt>{t("shell.create.type")}</dt><dd>{t(`shell.type.${me.type}`)}</dd></div>
            </dl>
          ) : null}
        </section>
      ) : null}

      {!pending && !roadTool && placingName ? (
        <div className="place-bar">
          <span className="place-name">{placingName}</span>
          <button type="button" onClick={onCancel}>{t("shell.hud.build.cancel")}</button>
        </div>
      ) : null}

      {pending ? (
        <div className="place-bar">
          <span className="place-name">{pending.name}</span>
          <button type="button" className="ok" onClick={onConfirm}>{t("shell.hud.build.confirm")}</button>
          {pending.move && pending.removable ? <button type="button" className="warn" onClick={onRemove}>{t("shell.hud.build.remove")}</button> : null}
          <button type="button" onClick={onCancel}>{t("shell.hud.build.cancel")}</button>
        </div>
      ) : null}

      {!pending && roadTool ? (
        <div className="place-bar">
          <span className="place-name">{t("shell.hud.b.road")}</span>
          <button type="button" onClick={onCancel}>{t("shell.hud.road.done")}</button>
        </div>
      ) : null}
    </>
  );
}
