// Единственный HUD игры: вариант «03 · Кузня приказов» (выбор заказчика).
export const UI_MOCKUP_IDS = ["forge"] as const;

export type UiMockupId = (typeof UI_MOCKUP_IDS)[number];

export const UI_HUD: UiMockupId = "forge";

/** Выставляет вариант на корне: CSS-правила привязаны к data-ui-mockup. */
export function applyUiMockup(id: UiMockupId): void {
  document.documentElement.dataset.uiMockup = id;
}

export function initializeUiMockup(): void {
  applyUiMockup(UI_HUD);
}
