/**
 * Клиентский адаптер HUD темы Mitchell.
 *
 * ВАЖНО: в этом файле рендерятся ТОЛЬКО элементы, подкреплённые РЕАЛЬНЫМИ
 * данными от сервера. Демо/мок-данные и «заглушки чтобы было» — запрещены.
 * Пока соответствующий модуль не готов и не отдаёт данных, элемент не
 * отображается (не рисуем даже пустую плашку или пузырь «для вида»).
 *
 * Добавление каждого нового визуального элемента согласуется с заказчиком:
 * постоянный это хром или событийный, от каких данных зависит, когда
 * появляется и исчезает.
 */

import { useState, useMemo } from "react";
import type { ReactNode } from "react";
import type { Locale, WorldViewBase } from "@tdl/protocol";
import { MitchellHud, MenuDotsIcon } from "@tdl/theme-mitchell/hud";
import type {
  HudMitchellViewModel,
  HudActionButton,
  HudEventBadge,
} from "@tdl/theme-mitchell/hud";
import { swatch } from "./Create.js";
import { BuildPanel } from "./BuildPanel.js";

type PanelKind = "build" | null;

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
  lang: _lang,
  placingName,
  pending: _pending,
  roadTool,
  onConfirm: _onConfirm,
  onRemove: _onRemove,
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
  const [panel, setPanel] = useState<PanelKind>(null);
  const me = view.me;
  const court = (view.modules.court ?? {}) as { level?: number; power?: number };
  const level = Number(court.level ?? 1);
  const power = Number(court.power ?? 0);
  const stock = view.stock ?? {};

  // --- Реальные ресурсы из stock (показываем только те, что реально есть в модели) ---
  const resources = [
    stock.meat !== undefined       && { id: "meat",       label: "Мясо",       amount: stock.meat,       icon: "🍖" as const },
    stock.wood !== undefined       && { id: "wood",       label: "Дерево",      amount: stock.wood,       icon: "🪵" as const },
    stock.stone !== undefined      && { id: "stone",      label: "Камень",      amount: stock.stone,      icon: "🪨" as const },
    stock.gold !== undefined       && { id: "gold",       label: "Золото",      amount: stock.gold,       icon: "💰" as const, canRecharge: true },
    stock.mushrooms !== undefined  && { id: "mushrooms",  label: "Самоцветы",   amount: stock.mushrooms,  icon: "💎" as const, accentColor: "gem" as const },
  ].filter(Boolean) as HudMitchellViewModel["resources"];

  // --- Навигация: только кнопка стройки на данный момент реально работает ---
  const noBadge: HudEventBadge = { kind: "none" };

  // Левые кнопки: 🔨 реально открывает BuildPanel, остальные — структура
  // (пока модули не готовы, оставляем кнопки видимыми как хром, но без клика и бейджей).
  const leftActions: HudActionButton[] = [
    { id: "build",    icon: "🔨", label: "Строительство", onClick: () => setPanel(panel === "build" ? null : "build"), badge: noBadge },
    // TODO: кнопка «Задания» появится с модулем квестов (пока прячем, нет данных).
    // TODO: кнопка «Рабочие» появится с модулем населения/армии (пока прячем).
  ];

  // Быстрые кнопки справа — пока без бейджей и без действий (модули в разработке).
  // Постоянный хром А: кнопки видны, но клик пока ничего не делает.
  const quickActions: HudActionButton[] = [
    // TODO: «Собрать» показываем как пузырь с анимацией ТОЛЬКО когда ферма
    //       накопила ресурс (по реальному циклу сбора здания). Пока НЕ рисуем.
    // TODO: «Помощь клана» — после введения клан-модуля. Пока НЕ рисуем.
    // TODO: «События» — после введения ивентового модуля. Пока НЕ рисуем.
    // TODO: «Почта» — после модуля почты. Пока НЕ рисуем.
  ];

  // Щитовая навигация — постоянный хром А.
  // На данный момент только кнопки-скелеты без действий (все будущие экраны в разработке).
  const shieldNav: HudActionButton[] = [
    { id: "heroes", icon: "⛑",  label: "Герои",    badge: noBadge },
    { id: "items",  icon: "🎒",  label: "Предметы", badge: noBadge },
    { id: "army",   icon: "⚔",   label: "Армия",    badge: noBadge },
    { id: "clan",   icon: "🚩",  label: "Клан",     badge: noBadge },
    { id: "more",   icon: <MenuDotsIcon />,  label: "Ещё",      badge: noBadge },
  ];

  // --- Собираем модель ---
  const model = useMemo<HudMitchellViewModel>(() => {
    return {
      utcClock: utcNow(),
      soundOn: true,
      lord: me ? {
        name: me.name,
        clanTag: undefined, // TODO: клан-тег из клан-модуля, когда будет
        power,
        level,
        bannerColor: swatch(me.bannerColor),
        avatarNode: (
          <img
            src="icons/i-lord.png"
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ),
        buffActive: false, // TODO: реальный buff из модуля эффектов
      } : {
        name: "Лорд",
        power,
        level,
        buffActive: false,
      },
      // Работники/армия — пока нет модуля, не показываем.
      idleWorkers: undefined,
      resources,
      // Баннеры/квесты/очереди/марши/чат-пузыри: модули в разработке — не рендерим.
      eventBanner: undefined,
      quest: undefined,
      queues: [],
      leftActions,
      compassLabel: "Карта мира",
      chat: [],
      marches: [],
      quickActions,
      shieldNav,
      bubbles: [],
      placingHint: placingName ? { label: placingName, onCancel } : null,
      tapeMessage: undefined,
      tapeActions: undefined,
    };
  }, [me, power, level, resources, leftActions, quickActions, shieldNav, placingName, onCancel]);

  // Дети HUD — только реальная панель строительства при открытии
  const children: ReactNode = panel === "build" ? (
    <BuildPanel
      view={view}
      lang={_lang}
      roadTool={roadTool}
      onPlaceStart={(type) => { setPanel(null); onPlaceStart(type); }}
      onRoadTool={() => { setPanel(null); onRoadTool(); }}
      onUpgrade={onUpgrade}
    />
  ) : null;

  return <MitchellHud model={model}>{children}</MitchellHud>;
}
