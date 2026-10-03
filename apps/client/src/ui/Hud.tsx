/**
 * HUD-хром главного экрана (этап B, круг 8): материалы Bone-Wood №05.
 * Блок лорда и ресурсы: профиль слева, все ресурсы справа в одном ряду в обеих ориентациях.
 * Чисел, которых нет в системах, не рисуем: лорд без уровня и силы, пока их не даст шаг 4+.
 */

import { useState } from "react";
import type { Locale, WorldViewBase } from "@tdl/protocol";
import { translator } from "../i18n/index.js";
import { BuildPanel } from "./BuildPanel.js";
import { ActionButton } from "./ActionButton.js";
import { ICON_SRC } from "./iconSrc.js";
import { ResourceStrip } from "./ResourceStrip.js";

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

/**
 * Рамки — внешний декор и награда (решение 03.10.2026): рамка профиля и рамка аватара меняются независимо,
 * базовая выдаётся всем, остальные — за ивенты, сезон и донат. Идентификаторы придут из профиля лорда;
 * пока в данных их нет, берётся базовая.
 */
const LORD_PORTRAIT_SRC = "icons/lord-base.png";
const PLATE_SRC: Record<string, string> = { base: "icons/lord-plate.png" };
const AVATAR_FRAME_SRC: Record<string, string> = { base: "icons/lord-frame-base.png" };

const plateSrc = (id?: string) => PLATE_SRC[id ?? "base"] ?? PLATE_SRC.base;
const avatarFrameSrc = (id?: string) => AVATAR_FRAME_SRC[id ?? "base"] ?? AVATAR_FRAME_SRC.base;

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
  selected,
  roadTool,
  onRotate,
  onSelectMove,
  onSelectRemove,
  onSelectClose,
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
  pending: { name: string; move: boolean; removable: boolean; rotatable: boolean; valid: boolean } | null;
  /** Здание, выбранное тапом: панель «Переместить / Убрать». */
  selected: { name: string; removable: boolean } | null;
  onRotate: (dir: 1 | -1) => void;
  onSelectMove: () => void;
  onSelectRemove: () => void;
  onSelectClose: () => void;
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
  /** Рамки придут в данных профиля вместе с системой наград; пока их нет — берётся базовая. */
  const frames = (me ?? {}) as { profileFrame?: string; avatarFrame?: string };
  // Уровень и сила приходят из модуля двора: растут вместе с прогрессом.
  const court = (view.modules.court ?? {}) as { level?: number; power?: number };
  const level = Number(court.level ?? 1);
  const power = Number(court.power ?? 0);
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
      {/* Профиль слева, все шесть ресурсов справа в одном ряду — и в портрете, и в альбомной ориентации. */}
      <div className="hud-top">
      {me ? (
        <div className="hud-lord" style={{ backgroundImage: `url("${plateSrc(frames.profileFrame)}")` }}>
          {/* Карточка лорда по концепту C1: плашка профиля, портрет и рамка аватара — три раздельных слоя,
              чтобы рамки менялись наградами, не затрагивая лицо (решение 03.10.2026). */}
          <span className="portrait">
            <img className="face" src={LORD_PORTRAIT_SRC} alt="" />
            <img className="frame" src={avatarFrameSrc(frames.avatarFrame)} alt="" />
            <i className="lvl-tag">{level}</i>
          </span>
          <span className="rows">
            <b className="name">{me.name}</b>
            <span className="power-row">
              <img src="icons/i-power.png" alt="" />
              <b>{fmt(power)}</b>
            </span>
            <span className="state-row">
              <span className="vipb">
                <img src="icons/crown.png" alt="" />
                VIP 1
              </span>
              {/* Место под иконки бонусов: сами иконки появятся со своими системами. */}
              <span className="bonuses" aria-hidden="true" />
            </span>
          </span>
        </div>
      ) : null}

      {/* ресурсы двора: компактные значения, точные — по нажатию */}
      <ResourceStrip stock={view.stock ?? {}} lang={lang} />
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

      {/* выбранное здание: имя и действия-знаки (лента с кнопками аналогов придёт в фазе интерфейса здания) */}
      {selected && !pending ? (
        <div className="place-bar select-bar">
          <span className="place-name">{selected.name}</span>
          <ActionButton kind="move" label={t("shell.hud.select.move")} tone="ok" onClick={onSelectMove} />
          {selected.removable ? (
            <ActionButton kind="remove" label={t("shell.hud.build.remove")} tone="warn" onClick={onSelectRemove} />
          ) : null}
          <ActionButton kind="close" label={t("shell.hud.select.close")} onClick={onSelectClose} />
        </div>
      ) : null}

      {/* постройка в руках: повернуть, убрать (если можно), подтвердить, отменить */}
      {pending ? (
        <div className="place-bar">
          {pending.rotatable ? (
            <>
              <ActionButton kind="rotate-left" label={t("shell.hud.rotate.left")} onClick={() => onRotate(-1)} />
              <ActionButton kind="rotate-right" label={t("shell.hud.rotate.right")} onClick={() => onRotate(1)} />
            </>
          ) : null}
          {pending.move && pending.removable ? (
            <ActionButton kind="remove" label={t("shell.hud.build.remove")} tone="warn" onClick={onRemove} />
          ) : null}
          <ActionButton kind="confirm" label={t("shell.hud.build.confirm")} tone="ok" disabled={!pending.valid} onClick={onConfirm} />
          <ActionButton kind="cancel" label={t("shell.hud.build.cancel")} onClick={onCancel} />
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
