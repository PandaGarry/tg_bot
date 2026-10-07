/**
 * Типы данных MitchellHud.
 *
 * Пакет темы НЕ зависит от @tdl/protocol и от моделей сервера.
 * Клиентский адаптер собирает ViewModel из любого источника и
 * передаёт в тему только эти простые структуры. Это позволяет
 * менять/тестировать тему изолированно.
 */

import type { ReactNode } from "react";

/** Статус/поведение элемента навигации по категориям (А/Б/В/Г — см. README). */
export type HudEventBadge =
  | { kind: "none" }
  | { kind: "count"; value: number }
  | { kind: "alert" }
  | { kind: "exclamation"; color?: "red" | "purple" | "green" };

export interface HudLord {
  name: string;
  clanTag?: string;
  power: number;
  level: number;
  /** Реальный VIP-уровень из игровых данных; не подменять уровнем ратуши. */
  vipLevel?: number;
  /** Содержимое аватара (emoji или <img> уже в разметке адаптера). */
  bannerColor?: string;
  avatarNode?: ReactNode;
  buffActive?: boolean;
}

export interface HudResource {
  id: string;
  label: string;
  amount: number;
  /** Эмодзи/иконка. На следующем шаге заменим на SVG. */
  icon: ReactNode;
  accentColor?: "default" | "gem";
  /** Есть ли возможность пополнить — показывает кнопку "+" только на первом ресурсе или на всех? */
  canRecharge?: boolean;
}

export interface HudEventBanner {
  title: string;
  timer: string;
  icon: ReactNode;
  isNew?: boolean;
}

export interface HudQuestItem {
  progress?: string;
  text: string;
  done?: boolean;
}
export interface HudQuestChapter {
  title: string;
  items: HudQuestItem[];
  canPrev: boolean;
  canNext: boolean;
}

export interface HudQueueItem {
  id: string;
  kind: "build" | "train" | "research";
  label: string;
  icon: ReactNode;
  /** 0..1 */
  progress: number;
  timeLeft: string;
  canSpeedUp?: boolean;
}

export interface HudActionButton {
  id: string;
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  badge?: HudEventBadge;
  tone?: "default" | "green" | "blue" | "dark" | "red";
  shape?: "square" | "round" | "shield";
}

export interface HudChatLine {
  author: string;
  authorColor?: string;
  text: string;
}

export interface HudMarchSlot {
  id: string;
  icon: ReactNode;
  /** Пустой слот серый; занятый — яркий с бейджем/таймером. */
  active: boolean;
  badge?: HudEventBadge;
  timeLeft?: string;
}

export type HudSceneBubbleKind = "build" | "upgrade" | "idle" | "collect" | "help" | "attack";

export interface HudSceneBubble {
  id: string;
  kind: HudSceneBubbleKind;
  /** Позиция в процентах от левого/верхнего края сцены 0..100. */
  x: number;
  y: number;
  icon?: ReactNode;
  label?: string;
  /** Пузырь кликабелен? (например, «собрать» — да, индикатор стройки — нет) */
  onClick?: () => void;
}

export interface HudMitchellViewModel {
  /** UTC-строка «YYYY/MM/DD HH:MM», отображается в правом верхнем углу. */
  utcClock: string;
  soundOn?: boolean;
  lord: HudLord;
  resources: HudResource[];
  idleWorkers?: { free: number; total: number };
  eventBanner?: HudEventBanner;
  quest?: HudQuestChapter;
  queues: HudQueueItem[];
  leftActions: HudActionButton[];
  compassLabel?: string;
  chat: HudChatLine[];
  marches: HudMarchSlot[];
  quickActions: HudActionButton[];
  shieldNav: HudActionButton[];
  /** Пузыри событий на сцене — пустой массив = ничего не рисуем. */
  bubbles: HudSceneBubble[];
  /** Всплывающая подсказка при постановке здания. */
  placingHint?: { label: string; onCancel: () => void } | null;
  /** Сообщение в хронике (лента событий внизу). */
  tapeMessage?: ReactNode;
  tapeActions?: { label: string; onClick: () => void }[];
}
