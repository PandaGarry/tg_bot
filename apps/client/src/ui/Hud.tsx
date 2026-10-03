/**
 * HUD-хром главного экрана (этап B, круг 8): материалы Bone-Wood №05.
 * Блок лорда и ресурсы сверху, «Строить»/«Карта» слева, вкладки справа.
 * Чисел, которых нет в системах, не рисуем: лорд без уровня и силы, пока их не даст шаг 4+.
 */

import { useState } from "react";
import type { Locale, WorldViewBase } from "@tdl/protocol";
import { translator } from "../i18n/index.js";
import { swatch } from "./Create.js";
import { BuildPanel } from "./BuildPanel.js";
import { ICON_SRC } from "./iconSrc.js";

const RES_ICONS: Record<string, string> = {
  meat: "meat",
  wood: "wood",
  stone: "stone",
  metal: "metal",
  mushrooms: "mushroom",
  gold: "gold",
};

type PanelKind = "build" | "train" | "sci" | "commanders" | "clan" | "items" | "shop" | "mail" | null;

/** Левый столбик (по RoK-референсу 2.6): «Строить» + очереди тренировки и исследования.
    Все иконки HUD уникальны — повторов нет (круг 18). */
const QUEUES: { kind: "train" | "sci"; icon: string; key: string }[] = [
  { kind: "train", icon: "swords", key: "shell.hud.queue.train" },
  { kind: "sci", icon: "flask", key: "shell.hud.queue.sci" },
];

/** Правая колонка — служебные механики (решение заказчика из круга 4):
    командиры (шлем), клан (щит), предметы (сумка), лавка, почта. */
const TABS: { kind: Exclude<PanelKind, "build" | "train" | "sci" | null>; icon: string; key: string }[] = [
  { kind: "commanders", icon: "helmet", key: "shell.hud.commanders" },
  { kind: "clan", icon: "clan", key: "shell.hud.clan" },
  { kind: "items", icon: "bag", key: "shell.hud.items" },
  { kind: "shop", icon: "shop", key: "shell.hud.shop" },
  { kind: "mail", icon: "mail", key: "shell.hud.mail" },
];

/** Короткий формат чисел: миллионы и миллиарды не ломают строку ресурсов (круг 15). */
// числа (раунд 5): полностью до 100 999 999; сотни млн — «NNN млн»; миллиарды — «1.2 млрд»
const fmt = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(n % 1e9 ? 1 : 0)} млрд` :
  n >= 1e8 ? `${Math.floor(n / 1e6)} млн` :
  String(n);

/** Целевое левое меню (требования заказчика, круг 14) рисуется только из данных систем:
    постройка (обычная + ускоренная за донат), марш ×5 с подменю и прогрессом,
    тренировка ×4 (воины, лучники, всадники, осадное) с таймерами, исследование ×2 с подменю,
    лазарет — только при раненых. Систем ставит этап C; пустых мест-заглушек больше нет. */
type QueueCell = { icon: string; key: string };

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
  // Уровень и сила приходят из модуля двора: растут вместе с прогрессом.
  const court = (view.modules.court ?? {}) as { level?: number; power?: number };
  const level = Number(court.level ?? 1);
  const power = Number(court.power ?? 0);
  // Ресурсная строка: пять основных ресурсов игры (материалы HUD, круг 4).
  // Значения берём со склада сервера; пока модуль двора их не выдаёт — честные нули (круг 11).
  const stock = view.stock ?? {};
  const resRow: [string, number][] = [
    ["meat", stock.meat ?? 0],
    ["wood", stock.wood ?? 0],
    ["stone", stock.stone ?? 0],
    ["metal", stock.metal ?? 0],
    ["mushrooms", stock.mushrooms ?? 0],
    ["gold", stock.gold ?? 0],
  ];

  const TITLES: Record<Exclude<PanelKind, null>, string> = {
    build: "shell.hud.build",
    train: "shell.hud.queue.train",
    sci: "shell.hud.queue.sci",
    commanders: "shell.hud.commanders",
    clan: "shell.hud.clan",
    items: "shell.hud.items",
    shop: "shell.hud.shop",
    mail: "shell.hud.mail",
  };
  const panelTitle = panel ? t(TITLES[panel]) : "";
  const panelText = panel === "build" ? t("shell.hud.soon.build") : t("shell.hud.soon");

  return (
    <>
      {/* панель персонажа по прототипу HUD: портрет-ячейка, ник, «Ур.» + полоса опыта, VIP.
          Уровень, опыт и VIP появят системы (этап C/D) — пока вид с честными стартовыми значениями. */}
      {/* верхняя строка: карточка лорда и ресурсы — flex не даёт им пересечься */}
      <div className="hud-top">
      {me ? (
        <div className="hud-lord">
          <span className="portrait" style={{ background: swatch(me.bannerColor) }}>
            <img className="hud-ic" src="icons/i-lord.png" alt="" />
          </span>
          <span className="rows">
            <span className="name-row">
              <b>{me.name}</b>
              <i className="lvl-tag">Ур. {level}</i>
            </span>
            <span className="power-row">
              <img src="icons/i-power.png" alt="" />
              <b>{fmt(power)}</b>
            </span>
            <span className="vip-row">
              <span className="vipb">
                <img className="hud-ic" src="icons/crown.png" alt="" />
                VIP 1
              </span>
            </span>
          </span>
        </div>
      ) : null}

      {/* ресурсы двора */}
      <div className="hud-res">
        {resRow.map(([id, amount]) => (
          <span className={`chip${id === "gold" ? " chip-gold" : ""}`} key={id}>
            <span className="ic">
              <img className="hud-ic" src={`icons/${RES_ICONS[id] ?? "gear"}.png`} alt="" />
            </span>
            <b>{fmt(amount)}</b>
          </span>
        ))}
      </div>
      </div>

      {/* левая панель: «Строить» и очереди (карта одна — в нижнем доке, круг 17) */}
      <div className="hud-rb-row">
        <button type="button" className="hud-rb" onClick={() => setPanel(panel === "build" ? null : "build")}>
          <img className="hud-ic" src={ICON_SRC.hammer} alt="" />
        </button>
        {QUEUES.map((q) => (
          <button
            key={q.kind}
            type="button"
            className="hud-queue"
            onClick={() => setPanel(panel === q.kind ? null : q.kind)}
          >
            <img className="hud-ic" src={ICON_SRC[q.icon] ?? "icons/gear.png"} alt="" />
          </button>
        ))}
      </div>

      {/* правая панель: полководцы, клан, предметы, лавка */}
      <div className="hud-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.kind}
            type="button"
            className="hud-tab"
            onClick={() => setPanel(panel === tab.kind ? null : tab.kind)}
          >
            <img className="hud-ic" src={ICON_SRC[tab.icon] ?? "icons/gear.png"} alt="" />
          </button>
        ))}
      </div>

      {/* панель строительства: живые вкладки и карточки; остальные панели — честное «придёт позже» */}
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
      {panel && panel !== "build" ? (
        <div className="hud-panel">
          <b>{panelTitle}</b>
          <p>{panelText}</p>
          <button type="button" onClick={() => setPanel(null)}>
            {t("shell.tape.ok")}
          </button>
        </div>
      ) : null}

      {/* выбор клетки: только отмена — текст не нужен */}
      {!pending && !roadTool && placingName ? (
        <div className="place-bar">
          <button type="button" onClick={onCancel}>
            {t("shell.hud.build.cancel")}
          </button>
        </div>
      ) : null}

      {/* подтверждение: призрак на клетке — «Подтвердить»; переносимое можно и убрать */}
      {pending ? (
        <div className="place-bar">
          <button type="button" className="ok" onClick={onConfirm}>
            {t("shell.hud.build.confirm")}
          </button>
          {pending.move && pending.removable ? (
            <button type="button" className="warn" onClick={onRemove}>
              {t("shell.hud.build.remove")}
            </button>
          ) : null}
          <button type="button" onClick={onCancel}>
            {t("shell.hud.build.cancel")}
          </button>
        </div>
      ) : null}

      {/* режим дороги: тап кладёт или убирает плиту */}
      {!pending && roadTool ? (
        <div className="place-bar">
          <button type="button" onClick={onCancel}>
            {t("shell.hud.road.done")}
          </button>
        </div>
      ) : null}
    </>
  );
}
