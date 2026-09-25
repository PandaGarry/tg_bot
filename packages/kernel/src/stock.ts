/**
 * Склад. Ресурсы целые. Отдельной колонки под ресурс в ядре нет:
 * ресурс появляется в складе, потому что модуль объявил его id.
 */

import type { ResourceId, StockSnapshot } from "./types.js";
import type { StockEffect } from "./effects.js";

export interface StockChange {
  next: Record<ResourceId, number>;
  /** Ресурсы, которых не хватило: итог ушёл бы в минус. */
  deficits: ResourceId[];
}

/** Считает склад после дельт. Ничего не пишет и не обрезает по пределу. */
export function applyStockDeltas(stock: StockSnapshot, deltas: readonly StockEffect[]): StockChange {
  const next: Record<ResourceId, number> = { ...stock };
  const deficits: ResourceId[] = [];
  for (const delta of deltas) {
    if (!Number.isSafeInteger(delta.delta)) {
      deficits.push(delta.resource);
      continue;
    }
    const current = next[delta.resource] ?? 0;
    const value = current + delta.delta;
    if (value < 0) {
      deficits.push(delta.resource);
      next[delta.resource] = current;
      continue;
    }
    next[delta.resource] = value;
  }
  return { next, deficits };
}

/**
 * Собирает дельты эффектов в один список: один склад и один ресурс — одна строка.
 * Адресат склада входит в ключ: иначе выдача уходила бы не тому двору.
 */
export function mergeStockEffects(effects: readonly StockEffect[]): StockEffect[] {
  const merged = new Map<string, StockEffect>();
  for (const effect of effects) {
    const key = `${effect.target ?? ""}\u0000${effect.resource}`;
    const current = merged.get(key);
    if (current) merged.set(key, { ...current, delta: current.delta + effect.delta });
    else merged.set(key, { ...effect });
  }
  return [...merged.values()].filter((effect) => effect.delta !== 0);
}

/** Предел склада: сколько ещё влезет. Ресурс без предела не ограничен. */
export function clampToLimit(amount: number, limit: number | undefined): number {
  if (limit === undefined) return amount;
  return amount > limit ? limit : amount;
}

/** Итог сбора: скорость × время, но не больше остатка точки и не больше груза. */
export function gatheredAmount(
  speedPerHour: number,
  elapsedMs: number,
  stockLeft: number,
  capacity: number,
): number {
  if (speedPerHour <= 0 || elapsedMs <= 0) return 0;
  const raw = Math.floor((speedPerHour * elapsedMs) / 3_600_000);
  const byStock = Math.min(raw, Math.max(0, Math.floor(stockLeft)));
  const byCapacity = Math.min(byStock, Math.max(0, Math.floor(capacity)));
  return Math.max(0, byCapacity);
}
