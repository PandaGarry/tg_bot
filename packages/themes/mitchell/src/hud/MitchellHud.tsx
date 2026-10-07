import type { ReactNode } from "react";
import styles from "./MitchellHud.module.css";
import type { HudMitchellViewModel } from "./types.js";
import { LordCard } from "./components/LordCard.js";
import { ResourceBar } from "./components/ResourceBar.js";
import { ClockBar } from "./components/ClockBar.js";
import topBarStyles from "./components/TopBar.module.css";
import { EventBanner } from "./components/EventBanner.js";
import { QuestPanel } from "./components/QuestPanel.js";
import { QueuesList } from "./components/QueuesList.js";
import { LeftActions } from "./components/LeftActions.js";
import { CompassButton } from "./components/CompassButton.js";
import { ChatPanel } from "./components/ChatPanel.js";
import { MarchesPanel } from "./components/MarchesPanel.js";
import { QuickActions } from "./components/QuickActions.js";
import { ShieldNav } from "./components/ShieldNav.js";
import { SceneBubbles } from "./components/SceneBubbles.js";
import { PlacingHint } from "./components/PlacingHint.js";
import { PortraitGuard } from "./components/PortraitGuard.js";

export interface MitchellHudProps {
  /** Собранная ViewModel со всеми данными, которые рисует HUD. */
  model: HudMitchellViewModel;
  /** Колбэки зональных кнопок (адаптер на клиенте знает, что вызывать). */
  on?: {
    recharge?: () => void;
    soundToggle?: () => void;
    settings?: () => void;
    eventBanner?: () => void;
    questPrev?: () => void;
    questNext?: () => void;
    queueSpeedUp?: (id: string) => void;
    marchSlot?: (id: string) => void;
  };
  /** Слот для модалов/строительной панели — клиент вставляет свой React-узел. */
  children?: ReactNode;
}

/**
 * MitchellHud — полная ландшафтная HUD-композиция темы Mitchell.
 *
 * Компонент «глупый»: принимает готовую ViewModel и набор колбэков.
 * Ничего не знает о сервере, @tdl/protocol, сторе или маршрутизации.
 * Все внутренние компоненты лежат в ./components/ и импортируются по именам.
 */
export function MitchellHud({ model, on, children }: MitchellHudProps) {
  return (
    <div className={styles.root} data-theme="mitchell" data-layout="landscape">
      {/* Портретная заглушка (показывается только в узком портрете) */}
      <PortraitGuard />

      {/* Верхняя полоса */}
      <header className={topBarStyles.topbar}>
        <LordCard lord={model.lord} />
        <ResourceBar resources={model.resources} idleWorkers={model.idleWorkers} onRecharge={on?.recharge} />
        <ClockBar
          utcClock={model.utcClock}
          soundOn={model.soundOn}
          onSoundToggle={on?.soundToggle}
          onSettings={on?.settings}
        />
      </header>

      {/* Ивентовый баннер (рендерится только если передан) */}
      <EventBanner banner={model.eventBanner} onClick={on?.eventBanner} />

      {/* Квесты */}
      <QuestPanel quest={model.quest} onPrev={on?.questPrev} onNext={on?.questNext} />

      {/* Очереди (не рендерятся при пустом списке) */}
      <QueuesList queues={model.queues} onSpeedUp={on?.queueSpeedUp} />

      {/* Левый столбец действий */}
      <LeftActions actions={model.leftActions} />

      {/* Компас */}
      <CompassButton label={model.compassLabel ?? "Карта мира"} />

      {/* Мини-чат */}
      <ChatPanel lines={model.chat} />

      {/* Марши */}
      <MarchesPanel slots={model.marches} onSlotClick={on?.marchSlot} />

      {/* Быстрые круглые кнопки справа */}
      <QuickActions actions={model.quickActions} />

      {/* Щитовая навигация */}
      <ShieldNav actions={model.shieldNav} />

      {/* Пузыри на сцене (только при наличии событий) */}
      <SceneBubbles bubbles={model.bubbles} />

      {/* Подсказка при постановке здания */}
      {model.placingHint ? (
        <PlacingHint label={model.placingHint.label} onCancel={model.placingHint.onCancel} />
      ) : null}

      {/* Слот для модалов и оверлеев клиента (строительная панель и т.п.) */}
      {children ? <div className={styles.slot}>{children}</div> : null}
    </div>
  );
}
