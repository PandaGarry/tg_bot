export const UI_MOCKUP_IDS = ["bonewood", "chronicle", "ash", "snow", "ledger"] as const;

export type UiMockupId = (typeof UI_MOCKUP_IDS)[number];

const STORAGE_KEY = "tdl.ui.mockup";
const DEFAULT_MOCKUP: UiMockupId = "bonewood";

export function isUiMockupId(value: string | null): value is UiMockupId {
  return value !== null && (UI_MOCKUP_IDS as readonly string[]).includes(value);
}

export function readUiMockup(): UiMockupId {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return isUiMockupId(value) ? value : DEFAULT_MOCKUP;
  } catch {
    return DEFAULT_MOCKUP;
  }
}

/** Только визуальный выбор в этом браузере; серверное состояние игры не затрагивается. */
export function applyUiMockup(id: UiMockupId): void {
  document.documentElement.dataset.uiMockup = id;
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Private browsing may block storage; the in-memory preview still works.
  }
}

export function initializeUiMockup(): void {
  document.documentElement.dataset.uiMockup = readUiMockup();
}
