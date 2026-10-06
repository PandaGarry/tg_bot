/**
 * Публичный API HUD темы Mitchell.
 *
 * Клиентский код должен использовать только этот вход:
 *   import { MitchellHud } from "@tdl/theme-mitchell/hud";
 *   import "@tdl/theme-mitchell/styles";
 *
 * Внутренние компоненты и типы не экспортируются наружу как стабильное API —
 * их структура может меняться при полировке темы. Если нужно использовать
 * конкретный подкомпонент снаружи темы, импортируйте напрямую с упоминанием
 * в код-ревью, чтобы мы поняли прецедент и либо стабилизировали экспорт,
 * либо вынесли данные через props главного компонента.
 */

export { MitchellHud } from "./MitchellHud.js";
export type { MitchellHudProps } from "./MitchellHud.js";
export type {
  HudMitchellViewModel,
  HudLord,
  HudResource,
  HudEventBanner,
  HudQuestChapter,
  HudQuestItem,
  HudQueueItem,
  HudActionButton,
  HudChatLine,
  HudMarchSlot,
  HudSceneBubble,
  HudSceneBubbleKind,
  HudEventBadge,
} from "./types.js";
export { MenuDotsIcon } from "./components/ShieldNav.js";
