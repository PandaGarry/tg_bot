/**
 * Часы мира. Часы стоят, пока процесс не работает: сроки лежат в мировом
 * времени, поэтому простой их не сжигает, а назад мировое время не идёт.
 */

import { monotonicWorldNow } from "@tdl/kernel";

/**
 * Часы мира вообще: и настоящие, и игровые. Один договор — разные источники,
 * чтобы подмена в тестах не расходилась с боем.
 */
export interface Clock {
  now(): number;
}

export interface ClockInit {
  /** Сколько миллисекунд мир стоял всего до этого подъёма. */
  offsetMs: number;
  /** Последнее известное мировое время. */
  lastWorldAtMs: number;
}

export class WorldClock implements Clock {
  private offsetMs: number;
  private lastWorldAtMs: number;

  constructor(init: ClockInit) {
    this.offsetMs = init.offsetMs;
    this.lastWorldAtMs = init.lastWorldAtMs;
  }

  nowReal(): number {
    return Date.now();
  }

  /** Мировое время шага. Никогда не идёт назад. */
  now(): number {
    const candidate = this.nowReal() - this.offsetMs;
    this.lastWorldAtMs = monotonicWorldNow(candidate, this.lastWorldAtMs);
    return this.lastWorldAtMs;
  }

  /** Простой: от последнего пульса до подъёма. Прыжок назад даёт ноль. */
  applyDowntime(downtime: number): void {
    if (downtime > 0) this.offsetMs += downtime;
  }

  get offset(): number {
    return this.offsetMs;
  }

  get lastWorldAt(): number {
    return this.lastWorldAtMs;
  }
}
