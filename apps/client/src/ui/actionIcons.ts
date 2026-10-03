/**
 * Значки действий во дворе (поворот, перенос, подтвердить…). Набор «простые знаки»: понятные силуэты,
 * объёмная мягкая отрисовка, ровный контур, **прозрачный фон**, без сезонных примет (снег, доски, железо) —
 * стиль не привязан к поре года, поэтому одинаково годится для зимы, весны и лета.
 * Утверждён заказчиком 03.10.2026 (контактный лист — docs/game/ui/concepts/phase-06-icons/v2/sheet-v2.jpg).
 * Файлы 256×256 PNG32: apps/client/public/icons/act-<имя>.png.
 */
export type ActionKind = "rotate-left" | "rotate-right" | "confirm" | "cancel" | "move" | "remove" | "close";

export const ACTION_ICON: Partial<Record<ActionKind, string>> = {
  "rotate-left": "icons/act-rotate-left.png",
  "rotate-right": "icons/act-rotate-right.png",
  confirm: "icons/act-confirm.png",
  cancel: "icons/act-cancel.png",
  move: "icons/act-move.png",
  remove: "icons/act-remove.png",
  close: "icons/act-close.png",
};

/** Знаки-заглушки, пока нет картинок. */
export const ACTION_GLYPH: Record<ActionKind, string> = {
  "rotate-left": "↶",
  "rotate-right": "↷",
  confirm: "✓",
  cancel: "✕",
  move: "✥",
  remove: "⌫",
  close: "✕",
};
