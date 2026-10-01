/**
 * Контракт скина двора.
 *
 * Ядро игры (сервер, модуль court, store) отдаёт только ДАННЫЕ: размер сетки,
 * занятые клетки, уровни построек. Скин — это набор React-Three компонентов, которые
 * превращают эти данные в картинку. Скин не читает store, не шлёт команды и не
 * считает правила: поэтому его можно заменить целиком (другая «игра» на том же
 * ядре) или выдать игроку отдельную постройку/оформление за ивент или покупку.
 *
 * Уровень постройки меняет внешний вид внутри скина: скин сам решает, сколько у него
 * ступеней (ядро хранит просто число `level`).
 */

import type { ComponentType } from "react";
import type { BannerSpec } from "./banner.js";

/** Данные для земли: размер сетки и клетки, где нельзя класть мелкий декор. */
export interface GroundProps {
  size: number;
  /** Ключи клеток `x:z` — дороги и пятна построек. */
  blocked: ReadonlySet<string>;
}

/** Ворота: только уровень; позиция и ширина проёма заданы геометрией двора (kit.GATE_HALF). */
export interface GateProps {
  level: number;
}

/** Тропинка: клетки, которые игрок выложил сам. */
export interface RoadProps {
  roads: readonly { x: number; z: number }[];
  size: number;
}

/** Цитадель: центр двора. Уровень выбирает вид (5 стадий), герб игрока ложится на флаг. */
export interface CitadelProps {
  level: number;
  banner?: BannerSpec;
}

export interface CourtSkin {
  /** Стабильный идентификатор: хранится у игрока, его выдают за ивенты и покупки. */
  id: string;
  /** Название для витрины/настроек (позже уйдёт в i18n). */
  name: string;
  /** Сколько визуальных ступеней у ворот; ядро может хранить больший уровень. */
  gateTiers: number;
  Ground: ComponentType<GroundProps>;
  /** Частокол по периметру, с проёмом под ворота. */
  Fence: ComponentType;
  Gate: ComponentType<GateProps>;
  /** Центральное здание: пятно 3×3 клетки, вход на +x (к воротам), основание в y = 0. */
  Citadel: ComponentType<CitadelProps>;
  /** Тропинка игрока: декор, который должен ложиться в общий вид двора. */
  Road: ComponentType<RoadProps>;
  /** Ели, валуны и дальний лес вокруг двора. */
  Trees: ComponentType;
  /** Набор текстур сезона в public/textures/<имя>/ (зима, позже весна и лето). */
  season: string;
}
