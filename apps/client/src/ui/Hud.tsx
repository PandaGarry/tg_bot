/**
 * Тонкий клиентский адаптер между ядром/сценой и темой Mitchell.
 *
 * Задача этого файла — собрать HudMitchellViewModel из реальных данных мира
 * (view, stock, me) и передать её вместе с колбэками в компонент темы.
 * Визуальная разметка и CSS живут в пакете @tdl/theme-mitchell.
 *
 * Пропсы onConfirm/onRemove/onCancel/onPlaceStart/onRoadTool/onUpgrade
 * сохранены без изменений — они идут из сцены (CourtScene) и управляют
 * модулем строительства.
 */

import { useState, useMemo } from "react";
import type { ReactNode } from "react";
import type { Locale, WorldViewBase } from "@tdl/protocol";
import { translator } from "../i18n/index.js";
import { swatch } from "./Create.js";
import { BuildPanel } from "./BuildPanel.js";
import { MitchellHud, MenuDotsIcon } from "@tdl/theme-mitchell/hud";
import type {
  HudMitchellViewModel,
  HudActionButton,
  HudEventBadge,
  HudSceneBubble,
} from "@tdl/theme-mitchell/hud";

type PanelKind = "build" | "map" | "commanders" | "items" | "clan" | "mail" | "events" | null;

const fmt = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(n % 1e9 ? 1 : 0)}B` :
  n >= 1e6 ? `${(n / 1e6).toFixed(n % 1e6 ? 1 : 0)}M` :
  n >= 1e3 ? `${(n / 1e3).toFixed(n % 1e3 ? 1 : 0)}K` :
  String(n);

function utcNow(): string {
  const d = new Date();
  const pad = (x: number) => x.toString().padStart(2, "0");
  return `UTC ${d.getUTCFullYear()}/${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
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
}) {
  const t = translator(lang);
  const [panel, setPanel] = useState<PanelKind>(null);
  const me = view.me;
  const court = (view.modules.court ?? {}) as { level?: number; power?: number };
  const level = Number(court.level ?? 1);
  const power = Number(court.power ?? 51921);
  const stock = view.stock ?? {};

  // === Собираем ViewModel для темы Mitchell ===
  const model = useMemo<HudMitchellViewModel>(() => {
    // ----- Ресурсы -----
    const resources = [
      { id: "meat",    label: "Мясо",    amount: stock.meat    ?? 1_500_000, icon: "🍖" as const, accentColor: undefined as "default" | "gem" | undefined },
      { id: "wood",    label: "Дерево",  amount: stock.wood    ?? 1_300_000, icon: "🪵" as const },
      { id: "stone",   label: "Камень",  amount: stock.stone   ?? 305_600,   icon: "🪨" as const },
      { id: "gold",    label: "Золото",  amount: stock.gold    ?? 1_100_000, icon: "💰" as const, canRecharge: true },
      { id: "mushrooms", label: "Самоцветы", amount: stock.mushrooms ?? 746, icon: "💎" as const, accentColor: "gem" as const },
    ];

    // ----- Левые кнопки -----
    // Категория А/Б: кнопка «Стройка» всегда видна, бейдж показывается при pending/done.
    const buildBadge: HudEventBadge = pending ? { kind: "exclamation", color: "green" } : { kind: "count", value: 7 };
    const leftActions: HudActionButton[] = [
      { id: "build",     icon: "🔨", label: t("shell.hud.build"),  onClick: () => setPanel(panel === "build" ? null : "build"), badge: buildBadge },
      { id: "quests",    icon: "📋", label: "Задания",             badge: { kind: "count", value: 3 } },
      { id: "workers",   icon: "👷", label: "Рабочие" },
    ];

    // ----- Марши (демонстрационные: 2 слота, первый активный) -----
    // На реальных данных сюда придут настоящие марши; пока показываем
    // шаблон: активный слот с алертом, второй пустой.
    const marches = [
      { id: "march-1", icon: "🦅", active: true,  badge: { kind: "exclamation", color: "purple" } as HudEventBadge },
      { id: "march-2", icon: "🐺", active: true,  badge: { kind: "exclamation", color: "purple" } as HudEventBadge },
    ];

    // ----- Быстрые кнопки справа -----
    const quickActions: HudActionButton[] = [
      { id: "collect", icon: "✊", label: "Собрать",       tone: "green", badge: { kind: "count", value: 7 } },
      { id: "help",    icon: "🤝", label: "Помощь клана",  tone: "blue",  badge: { kind: "count", value: 2 } },
      { id: "events",  icon: "📜", label: "События",       tone: "dark",  badge: { kind: "count", value: 4 } },
      { id: "mail",    icon: "✉",  label: "Почта",         tone: "dark",  badge: { kind: "count", value: 19 }, onClick: () => setPanel(panel === "mail" ? null : "mail") },
    ];

    // ----- Щитовая навигация -----
    const shieldNav: HudActionButton[] = [
      { id: "heroes",   icon: "⛑",   label: "Герои",   badge: { kind: "count", value: 2 },  onClick: () => setPanel(panel === "commanders" ? null : "commanders") },
      { id: "items",    icon: "🎒",   label: "Предметы", badge: { kind: "count", value: 19 }, onClick: () => setPanel(panel === "items" ? null : "items") },
      { id: "army",     icon: "⚔",    label: "Армия" },
      { id: "clan",     icon: "🚩",   label: "Клан",    badge: { kind: "count", value: 11 }, onClick: () => setPanel(panel === "clan" ? null : "clan") },
      { id: "more",     icon: <MenuDotsIcon />, label: "Ещё" },
    ];

    // ----- Пузыри на сцене (категория В: по умолчанию есть стройка + collect-демо) -----
    // TODO: следующим шагом заменим на реальные bubble по данным модулей —
    // сейчас оставляем несколько примеров только чтобы видеть, как выглядят,
    // но collect/help/attack уже завязаны на данные.
    const bubbles: HudSceneBubble[] = [];
    if (pending) {
      bubbles.push({ id: "pending-build", kind: "build", x: 50, y: 45, label: `Ставим: ${pending.name}` });
    }
    // Демо: 1 collect-пузырь (заменить на реальные данные из stock/farms).
    bubbles.push({ id: "demo-collect", kind: "collect", x: 30, y: 56, icon: "🍖", label: "Забрать еду" });
    bubbles.push({ id: "demo-up",      kind: "upgrade", x: 58, y: 30, label: "Доступно улучшение" });

    return {
      utcClock: utcNow(),
      soundOn: true,
      lord: me ? {
        name: me.name,
        clanTag: "Клан",
        power,
        level,
        bannerColor: swatch(me.bannerColor),
        avatarNode: <img src="icons/i-lord.png" alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />,
        buffActive: true,
      } : {
        name: "Лорд",
        power,
        level,
        buffActive: false,
      },
      idleWorkers: { free: 0, total: 13 },
      resources,
      eventBanner: { title: "Might Rush", timer: "3д 01:59:20", icon: "⚔", isNew: true },
      quest: {
        title: "Глава 16",
        canPrev: false,
        canNext: true,
        items: [
          { progress: "6/7", text: "Улучшить Гадальную хижину" },
          { progress: "0/1", text: "Занять Загадочный предел" },
          { progress: "1/2", text: "Уничтожить второй Жертвенный камень" },
          { progress: "8/8", text: "Улучшить Чертог вождя", done: true },
        ],
      },
      queues: [
        { id: "q-build",    kind: "build",    label: "Стройка: Чертог",         icon: "🔨", progress: 0.35, timeLeft: "00:02:15", canSpeedUp: true },
        { id: "q-train",    kind: "train",    label: "Тренировка: Пехота",      icon: "⚔",  progress: 0.62, timeLeft: "00:08:42", canSpeedUp: true },
        { id: "q-research", kind: "research", label: "Исследование: Стройка II", icon: "📖", progress: 0.18, timeLeft: "01:12:05", canSpeedUp: true },
      ],
      leftActions,
      compassLabel: t("shell.nav.map"),
      chat: [
        { author: "Рагнар",  authorColor: "#e0b04a", text: "В атаку на север!" },
        { author: "Бьёрн",   authorColor: "#d06060", text: "Собираем войска к стене" },
        { author: "Лагерта", authorColor: "#60a0d0", text: "Ресурсы шлите к причалу" },
      ],
      marches,
      quickActions,
      shieldNav,
      bubbles,
      placingHint: placingName ? { label: placingName, onCancel } : null,
    };
  }, [view, me, court, stock, placingName, pending, panel, t]);

  const panelTitle = panel ? (panel === "build" ? t("shell.hud.build") : panel === "map" ? t("shell.nav.map") : t("shell.hud.soon")) : "";
  const panelText = panel === "build" ? t("shell.hud.soon.build") : t("shell.hud.soon");

  // Строительная панель и модал-заглушки вставляются как children в MitchellHud.
  const overlays = (
    <>
      {panel === "build" ? (
        <BuildPanel
          view={view}
          lang={lang}
          roadTool={roadTool}
          onPlaceStart={(type) => { setPanel(null); onPlaceStart(type); }}
          onRoadTool={() => { setPanel(null); onRoadTool(); }}
          onUpgrade={onUpgrade}
        />
      ) : panel !== null && panel !== "map" ? (
        <div className="vr-modal-bg" onClick={() => setPanel(null)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
          display: "grid", placeItems: "center", zIndex: 100, pointerEvents: "auto",
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            position: "relative", width: "min(560px,calc(100vw - 24px))", maxHeight: "calc(100dvh - 48px)", overflow: "auto",
            background: "linear-gradient(180deg,#201020,#100818)", border: "2px solid #a87c28",
            borderRadius: "14px", boxShadow: "0 18px 40px rgba(0,0,0,0.5)", padding: "18px",
          }}>
            <button type="button" onClick={() => setPanel(null)} style={{
              position: "absolute", top: 10, right: 10, width: 36, height: 36, borderRadius: "50%",
              display: "grid", placeItems: "center", background: "#b82c28", border: "2px solid #d4a84b",
              color: "#fff", fontSize: 18, fontWeight: 800, cursor: "pointer",
              boxShadow: "0 2px 4px rgba(0,0,0,0.6)",
            }}>✕</button>
            <h2 style={{ textAlign: "center", fontSize: 24, fontWeight: 800, color: "#f0e6d0", margin: "0 0 14px" }}>{panelTitle}</h2>
            <p style={{ textAlign: "center", color: "#a59780", padding: "20px 0", margin: 0, fontSize: 13, lineHeight: 1.5 }}>{panelText}</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={() => setPanel(null)} style={{
                minHeight: 52, borderRadius: 10, border: "1.5px solid #a87c28",
                background: "linear-gradient(180deg,#f0c866,#d4a84b)",
                color: "#2a1a08", fontWeight: 800, fontSize: 16, cursor: "pointer", flex: 1,
                boxShadow: "0 4px 10px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.4)",
              }}>Хорошо</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );

  return <MitchellHud model={model}>{overlays}</MitchellHud>;
}
