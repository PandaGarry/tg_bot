import { useEffect, useState, type ReactNode } from "react";
import type { Locale, WorldViewBase } from "@tdl/protocol";
import { translator } from "../i18n/index.js";
import { BUILD_CATALOG, TOWNHALL_COSTS, TOWNHALL_MAX_LEVEL, type BuildTab } from "./BuildPanel.js";
import { ConceptIcon, type ConceptIconName } from "./ConceptIcon.js";
import type { UiMockupId } from "./mockups.js";

export type ConceptRoute = "court" | "reports" | "map" | "chronicle" | "sheet";

type ConceptPanelId = "build" | "train" | "research" | "commanders" | "clan" | "items" | "shop" | "mail";
type QuickActionId = ConceptPanelId | "reports" | "chronicle";

const NAV_ITEMS: { route: ConceptRoute; icon: ConceptIconName }[] = [
  { route: "court", icon: "court" },
  { route: "reports", icon: "reports" },
  { route: "map", icon: "map" },
  { route: "chronicle", icon: "chronicle" },
  { route: "sheet", icon: "settings" },
];

const QUICK_ACTIONS: QuickActionId[] = ["build", "train", "research", "commanders"];

const QUICK_LABELS: Record<Locale, Partial<Record<QuickActionId, string>>> = {
  ru: { build: "Стройка", train: "Войско", research: "Наука", commanders: "Герои" },
  en: { build: "Build", train: "Troops", research: "Study", commanders: "Heroes" },
};

const QUICK_META: Record<QuickActionId, { icon: ConceptIconName; key: string }> = {
  build: { icon: "build", key: "shell.hud.build" },
  train: { icon: "train", key: "shell.hud.queue.train" },
  research: { icon: "research", key: "shell.hud.queue.sci" },
  commanders: { icon: "commanders", key: "shell.hud.commanders" },
  clan: { icon: "clan", key: "shell.hud.clan" },
  items: { icon: "items", key: "shell.hud.items" },
  shop: { icon: "shop", key: "shell.hud.shop" },
  mail: { icon: "mail", key: "shell.hud.mail" },
  reports: { icon: "reports", key: "shell.nav.reports" },
  chronicle: { icon: "chronicle", key: "shell.nav.chronicle" },
};

const UI_COPY = {
  ru: {
    world: "ЗЕМЛИ ДВОРА",
    profile: "Владыка",
    supplies: "Запасы",
    nav: {
      court: "Двор",
      reports: "Сводки",
      map: "Карта",
      chronicle: "Летопись",
      sheet: "Совет",
    },
    page: "РАЗДЕЛ ДВОРА",
    back: "Вернуться во двор",
    previewOnly: "Эскиз экрана · система ещё не подключена",
    moduleNote: "Макет показывает место для раздела; несуществующие игровые данные не подставляются.",
    build: "Строительный двор",
    upgrade: "Улучшить ратушу",
    level: "Ратуша",
    road: "Мощение",
    economy: "Хозяйство",
    military: "Оборона",
    decor: "Двор и декор",
    chooseTile: "Выберите место на карте",
    moveTile: "Перенесите объект на свободную клетку",
    confirm: "Поставить",
    remove: "Убрать",
    cancel: "Отменить",
    turnOffRoad: "Завершить мощение",
    locked: "Нужен уровень ратуши",
    insufficient: "Не хватает запасов",
    maxLevel: "Максимальный уровень",
    loading: "Получаем данные двора",
    noValue: "—",
  },
  en: {
    world: "COURT LANDS",
    profile: "Court Warden",
    supplies: "Stores",
    nav: {
      court: "Court",
      reports: "Reports",
      map: "Map",
      chronicle: "Chronicle",
      sheet: "Council",
    },
    page: "COURT QUARTER",
    back: "Return to the court",
    previewOnly: "Screen concept · system not connected yet",
    moduleNote: "This mockup reserves space for the section; it does not invent game data.",
    build: "Building yard",
    upgrade: "Upgrade town hall",
    level: "Town hall",
    road: "Paving",
    economy: "Homestead",
    military: "Defence",
    decor: "Court and decor",
    chooseTile: "Choose a place on the map",
    moveTile: "Move the object to an empty tile",
    confirm: "Place",
    remove: "Remove",
    cancel: "Cancel",
    turnOffRoad: "Finish paving",
    locked: "Town hall level required",
    insufficient: "Not enough stores",
    maxLevel: "Maximum level",
    loading: "Receiving court data",
    noValue: "—",
  },
} as const;

const RESOURCES: { id: "meat" | "wood" | "stone" | "metal" | "mushrooms" | "gold"; key?: string }[] = [
  { id: "meat", key: "shell.hud.meat" },
  { id: "wood", key: "shell.hud.wood" },
  { id: "stone", key: "shell.hud.stone" },
  { id: "metal", key: "shell.hud.metal" },
  { id: "mushrooms", key: "shell.hud.mushrooms" },
  { id: "gold" },
];

const BUILD_TABS: BuildTab[] = ["economy", "military", "decor"];

export function ConceptHud({
  variant,
  view,
  lang,
  route,
  onRouteChange,
  children,
  placingName,
  pending,
  roadTool,
  onConfirm,
  onRemove,
  onCancel,
  onPlaceStart,
  onRoadTool,
  onUpgrade,
}: {
  variant: UiMockupId;
  view: WorldViewBase;
  lang: Locale;
  route: ConceptRoute;
  onRouteChange: (route: ConceptRoute) => void;
  children?: ReactNode;
  placingName: string | null;
  pending: { name: string; move: boolean; ready: boolean; removable: boolean } | null;
  roadTool: boolean;
  onConfirm: () => void;
  onRemove: () => void;
  onCancel: () => void;
  onPlaceStart: (type: string) => void;
  onRoadTool: () => void;
  onUpgrade: () => void;
}) {
  const t = translator(lang);
  const copy = UI_COPY[lang];
  const [panel, setPanel] = useState<ConceptPanelId | null>(null);
  const [buildTab, setBuildTab] = useState<BuildTab>("economy");
  const court = (view.modules.court ?? {}) as { townhallLevel?: number };
  const hallLevel = Number(court.townhallLevel ?? 1);

  useEffect(() => setPanel(null), [route, variant]);

  const openAction = (action: QuickActionId): void => {
    if (action === "reports" || action === "chronicle") {
      onRouteChange(action);
      setPanel(null);
      return;
    }
    if (action === "build") setBuildTab("economy");
    setPanel((current) => (current === action ? null : action));
  };

  const profile = <ProfileCard variant={variant} view={view} lang={lang} />;
  const resources = <ResourceBoard variant={variant} view={view} lang={lang} />;
  const nav = (
    <nav className={`concept-nav concept-nav--${variant}`} aria-label={lang === "ru" ? "Разделы игры" : "Game sections"}>
      {NAV_ITEMS.map(({ route: itemRoute, icon }) => (
        <button
          key={itemRoute}
          type="button"
          className={`concept-nav__item${route === itemRoute ? " is-active" : ""}`}
          aria-current={route === itemRoute ? "page" : undefined}
          aria-label={routeLabel(itemRoute, lang)}
          onClick={() => {
            onRouteChange(itemRoute);
            setPanel(null);
          }}
        >
          <ConceptIcon name={icon} className="concept-nav__icon" />
          <span>{routeLabel(itemRoute, lang)}</span>
        </button>
      ))}
    </nav>
  );
  const quick = (
    <div className={`concept-quick concept-quick--${variant}`} aria-label={lang === "ru" ? "Быстрые действия" : "Quick actions"}>
      {QUICK_ACTIONS.map((action) => {
        const meta = QUICK_META[action];
        const active = panel === action || route === action;
        return (
          <button
            key={action}
            type="button"
            className={`concept-quick__item${active ? " is-active" : ""}`}
            data-action={action}
            aria-label={t(meta.key)}
            title={t(meta.key)}
            onClick={() => openAction(action)}
          >
            <ConceptIcon name={meta.icon} className="concept-quick__icon" />
            <span>{QUICK_LABELS[lang][action] ?? t(meta.key)}</span>
          </button>
        );
      })}
    </div>
  );
  const worldPlaque = <WorldPlaque variant={variant} view={view} lang={lang} />;

  return (
    <div className={`concept-ui concept-ui--${variant}${route === "court" ? "" : " is-page"}`}>
      <>
          <header className="concept-header concept-header--forge">
            {profile}
            <div className="concept-forge-status">{worldPlaque}</div>
            {resources}
          </header>
          {quick}
          {nav}
      </>

      {route !== "court" ? (
        <section className={`concept-page concept-page--${variant}`} aria-labelledby="concept-page-title">
          <header className="concept-page__header">
            <div>
              <p>{copy.page}</p>
              <h1 id="concept-page-title">{routeLabel(route, lang)}</h1>
            </div>
            <button type="button" className="concept-page__back" onClick={() => onRouteChange("court")}>
              <ConceptIcon name="court" />
              <span>{copy.back}</span>
            </button>
          </header>
          <div className="concept-page__body">{children}</div>
        </section>
      ) : null}

      {panel === "build" ? (
        <ConceptBuildPanel
          variant={variant}
          view={view}
          lang={lang}
          tab={buildTab}
          setTab={setBuildTab}
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
          onClose={() => setPanel(null)}
        />
      ) : null}
      {panel && panel !== "build" ? (
        <ConceptActionPanel variant={variant} panel={panel} lang={lang} onClose={() => setPanel(null)} />
      ) : null}

      {placingName && !pending && !roadTool ? (
        <div className={`concept-placement concept-placement--${variant}`} role="status">
          <ConceptIcon name="build" />
          <div>
            <b>{placingName}</b>
            <span>{copy.chooseTile}</span>
          </div>
          <button type="button" onClick={onCancel}>{copy.cancel}</button>
        </div>
      ) : null}
      {pending ? (
        <div className={`concept-placement concept-placement--${variant}`} role="group" aria-label={pending.move ? copy.moveTile : copy.chooseTile}>
          <ConceptIcon name={pending.move ? "map" : "build"} />
          <div>
            <b>{pending.move ? pending.name : copy.chooseTile}</b>
            <span>{pending.move && !pending.ready ? copy.moveTile : pending.name}</span>
          </div>
          {pending.move && !pending.ready ? null : <button className="is-primary" type="button" onClick={onConfirm}>{copy.confirm}</button>}
          {pending.move && pending.removable && pending.ready ? <button className="is-danger" type="button" onClick={onRemove}>{copy.remove}</button> : null}
          <button type="button" onClick={onCancel}>{copy.cancel}</button>
        </div>
      ) : null}
      {!pending && roadTool ? (
        <div className={`concept-placement concept-placement--${variant}`} role="status">
          <ConceptIcon name="road" />
          <div>
            <b>{t("shell.hud.b.road")}</b>
            <span>{copy.chooseTile}</span>
          </div>
          <button type="button" onClick={onCancel}>{copy.turnOffRoad}</button>
        </div>
      ) : null}

      {route !== "court" ? <div className="concept-page__veil" aria-hidden="true" /> : null}
    </div>
  );
}

function WorldPlaque({ variant, view, lang }: { variant: UiMockupId; view: WorldViewBase; lang: Locale }) {
  const copy = UI_COPY[lang];
  return (
    <div className={`concept-world concept-world--${variant}`}>
      <span className="concept-world__sigil"><ConceptIcon name="court" /></span>
      <span>
        <small>{copy.world}</small>
        <b>{view.world.name}</b>
      </span>
      <span className="concept-world__stamp" aria-hidden="true">01</span>
    </div>
  );
}

function ProfileCard({ variant, view, lang }: { variant: UiMockupId; view: WorldViewBase; lang: Locale }) {
  const copy = UI_COPY[lang];
  const court = (view.modules.court ?? {}) as { townhallLevel?: number };
  const level = Number(court.townhallLevel ?? 1);
  return (
    <div className={`concept-profile concept-profile--${variant}`}>
      <span className="concept-profile__portrait"><ConceptIcon name="lord" /></span>
      <span className="concept-profile__copy">
        <small>{copy.profile}</small>
        <b>{view.me?.name ?? copy.loading}</b>
        <span>{copy.level} · {level}</span>
      </span>
      <span className="concept-profile__crest"><ConceptIcon name="clan" /></span>
    </div>
  );
}

function ResourceBoard({ variant, view, lang }: { variant: UiMockupId; view: WorldViewBase; lang: Locale }) {
  const t = translator(lang);
  const stock = view.stock ?? {};
  return (
    <div className={`concept-resources concept-resources--${variant}`} aria-label={UI_COPY[lang].supplies}>
      {RESOURCES.map(({ id, key }) => {
        const value = Number(stock[id] ?? 0);
        const label = id === "gold" ? (lang === "ru" ? "Золото" : "Gold") : t(key ?? "");
        return (
          <div key={id} className={`concept-resource concept-resource--${id}`} data-resource={id} title={label}>
            <span className="concept-resource__icon"><ConceptIcon name={id} /></span>
            <span className="concept-resource__value">{formatAmount(value, lang)}</span>
            <span className="concept-resource__label">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function formatAmount(value: number, lang: Locale): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(lang === "ru" ? "ru-RU" : "en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function ConceptBuildPanel({
  variant,
  view,
  lang,
  tab,
  setTab,
  roadTool,
  onPlaceStart,
  onRoadTool,
  onUpgrade,
  onClose,
}: {
  variant: UiMockupId;
  view: WorldViewBase;
  lang: Locale;
  tab: BuildTab;
  setTab: (tab: BuildTab) => void;
  roadTool: boolean;
  onPlaceStart: (type: string) => void;
  onRoadTool: () => void;
  onUpgrade: () => void;
  onClose: () => void;
}) {
  const t = translator(lang);
  const copy = UI_COPY[lang];
  const stock = view.stock ?? {};
  const court = (view.modules.court ?? {}) as { townhallLevel?: number };
  const level = Number(court.townhallLevel ?? 1);
  const nextCost = TOWNHALL_COSTS[level + 1];
  const canUpgrade = level < TOWNHALL_MAX_LEVEL && Boolean(nextCost?.every(([id, amount]) => (stock[id] ?? 0) >= amount));
  return (
    <section className={`concept-build-panel concept-build-panel--${variant}`} aria-label={copy.build}>
      <header className="concept-build-panel__head">
        <div>
          <p>{copy.page}</p>
          <h2>{copy.build}</h2>
        </div>
        <button type="button" className="concept-panel-close" aria-label={lang === "ru" ? "Закрыть" : "Close"} onClick={onClose}>×</button>
      </header>
      <button type="button" className="concept-upgrade" onClick={onUpgrade} disabled={!canUpgrade}>
        <span className="concept-upgrade__icon"><ConceptIcon name="court" /></span>
        <span className="concept-upgrade__text">
          <b>{t("shell.hud.b.townhall")} · {level}</b>
          <small>{level >= TOWNHALL_MAX_LEVEL ? copy.maxLevel : `${copy.upgrade} · ${level + 1}`}</small>
        </span>
        <span className="concept-upgrade__cost">
          {nextCost?.map(([id, amount]) => <span key={id}>{resourceAbbreviation(id, lang)} {amount}</span>) ?? copy.maxLevel}
        </span>
      </button>
      <div className="concept-build-tabs" role="tablist" aria-label={copy.build}>
        {BUILD_TABS.map((id) => {
          const label = t(`shell.hud.build.tab.${id}`);
          return (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "is-active" : ""} onClick={() => setTab(id)}>
              {label}
            </button>
          );
        })}
      </div>
      {tab === "decor" ? (
        <button type="button" className={`concept-road-card${roadTool ? " is-active" : ""}`} onClick={onRoadTool}>
          <span className="concept-building-art"><ConceptIcon name="road" /></span>
          <span><b>{copy.road}</b><small>{t("shell.hud.b.road")}</small></span>
          <span className="concept-road-card__mark">{roadTool ? "●" : "＋"}</span>
        </button>
      ) : null}
      <div className={`concept-building-grid concept-building-grid--${variant}`}>
        {BUILD_CATALOG.filter((item) => item.tab === tab).map((item) => {
          const locked = level < item.th;
          const canAfford = item.cost.every(([id, amount]) => (stock[id] ?? 0) >= amount);
          const disabled = locked || !canAfford;
          return (
            <button
              key={item.id}
              type="button"
              className="concept-building-card"
              data-building-id={item.id}
              disabled={disabled}
              onClick={() => onPlaceStart(item.id)}
            >
              <span className="concept-building-art"><ConceptIcon name={item.id as ConceptIconName} /></span>
              <span className="concept-building-card__copy">
                <b>{t(`shell.hud.b.${item.id}`)}</b>
                <small>{locked ? `${copy.locked} · ${item.th}` : item.cost.map(([id, amount]) => `${resourceAbbreviation(id, lang)} ${amount}`).join(" · ")}</small>
                {!locked && !canAfford ? <em>{copy.insufficient}</em> : null}
              </span>
              <span className="concept-building-card__arrow">{disabled ? "·" : "↗"}</span>
            </button>
          );
        })}
      </div>
      <p className="concept-build-panel__foot">{copy.moduleNote}</p>
    </section>
  );
}

function ConceptActionPanel({ variant, panel, lang, onClose }: { variant: UiMockupId; panel: Exclude<ConceptPanelId, "build">; lang: Locale; onClose: () => void }) {
  const t = translator(lang);
  const meta = QUICK_META[panel];
  return (
    <section className={`concept-action-panel concept-action-panel--${variant}`} aria-live="polite">
      <header>
        <span className="concept-action-panel__icon"><ConceptIcon name={meta.icon} /></span>
        <div><small>{UI_COPY[lang].page}</small><h2>{t(meta.key)}</h2></div>
        <button type="button" className="concept-panel-close" aria-label={lang === "ru" ? "Закрыть" : "Close"} onClick={onClose}>×</button>
      </header>
      <p>{UI_COPY[lang].previewOnly}</p>
      <small>{UI_COPY[lang].moduleNote}</small>
    </section>
  );
}

function routeLabel(route: ConceptRoute, lang: Locale): string {
  return UI_COPY[lang].nav[route];
}

function resourceAbbreviation(id: string, lang: Locale): string {
  const labels: Record<string, [string, string]> = {
    meat: ["Мяс", "Meat"],
    wood: ["Дер", "Wood"],
    stone: ["Кам", "Stone"],
    metal: ["Мет", "Metal"],
    mushrooms: ["Гриб", "Shroom"],
    gold: ["Зол", "Gold"],
  };
  return labels[id]?.[lang === "ru" ? 0 : 1] ?? id;
}
