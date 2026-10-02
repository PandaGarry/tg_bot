/**
 * Значки действий во дворе (поворот, перенос, подтвердить…). Картинки появятся после того, как заказчик
 * утвердит стиль набора: пока пустая карта, и кнопки показывают простой знак-заглушку.
 * Когда картинка утверждена — добавить путь сюда (`icons/act-<имя>.png`).
 */
export type ActionKind = "rotate-left" | "rotate-right" | "confirm" | "cancel" | "move" | "remove" | "close";

export const ACTION_ICON: Partial<Record<ActionKind, string>> = {};

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
