/**
 * Цветовая палитра темы Mitchell (Nordic / Scandinavian SLG look).
 * Используется в JS/TS-коде (Three.js материалы, канвас, программные стили).
 *
 * Пакет темы на данный момент не подключён к клиенту — этот файл существует
 * как каркас и не влияет на внешний вид игры до соответствующего шага плана.
 */

export const mitchellPalette = {
  // Панели / дерево / кожа
  panelDark: "#1f1208",
  panelBlack: "#0c0704",
  panelWood: "#3a2618",
  panelEdge: "#7c5028",

  // Золото (окантовка, акценты)
  gold: "#d4a84b",
  goldLight: "#f0c866",
  goldDark: "#a87c28",

  // Скандинавский синий (вымпелы, прогресс, апгрейд)
  blue: "#2f6fb5",
  blueLight: "#5aa0ee",
  blueDark: "#1e4a7a",

  // Статусные
  green: "#4caf40",
  greenDark: "#2d7a25",
  red: "#b82c28",
  redLight: "#e05550",
  orange: "#dd6e2b",

  // Ресурсы
  resFood: "#dd6e2b",
  resWood: "#bd844d",
  resStone: "#908c88",
  resGold: "#dfb842",
  resGem: "#db4248",

  // Текст
  text: "#f0e6d0",
  textMuted: "#a59780",
  textDim: "#7a6b55",

  // Сцена (природа)
  grass: "#5a8c3a",
  grassLight: "#78aa48",
  grassAutumn: "#b0a048",
  dirt: "#9c7a50",
  wood: "#4a2e16",
  woodLight: "#7c5028",
  thatch: "#c09848",
  water: "#35608c",
  waterDeep: "#25405c",
  snow: "#e8eef5",
  rock: "#6c7480",
  mountainFar: "#6c7c8c",

  // Небо (день)
  skyTop: "#5a82b0",
  skyHorizon: "#78a0c8",
  sunTint: "#fff0d0",

  white: "#ffffff",
  black: "#000000",
} as const;

export type MitchellColorName = keyof typeof mitchellPalette;
