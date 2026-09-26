/**
 * Часы мира. Часы мира стоят, пока процесс не работает:
 * сроки в базе лежат в мировом времени, и простой их не сжигает.
 */

/** Пульс мира: раз в 10 секунд. Дыра после жёсткого падения не длиннее этого шага. */
export const PULSE_INTERVAL_MS = 10_000;

/** Простой: от последнего пульса до подъёма. Прыжок часов назад простоем не считается. */
export function downtimeMs(nowRealMs: number, lastPulseRealMs: number): number {
  if (!Number.isFinite(nowRealMs) || !Number.isFinite(lastPulseRealMs)) return 0;
  const diff = nowRealMs - lastPulseRealMs;
  return diff > 0 ? diff : 0;
}

/** Мировое время не идёт назад, даже если часы сервера прыгнули. */
export function monotonicWorldNow(candidate: number, lastWorldNow: number): number {
  return candidate > lastWorldNow ? candidate : lastWorldNow;
}

/** Срок в мировом времени. Простой сдвигает его вместе с часами мира. */
export function shiftWakeAt(wakeAt: number, downtime: number): number {
  return wakeAt + downtime;
}

export function msUntil(wakeAt: number, now: number): number {
  return wakeAt - now;
}

export const MINUTE_MS = 60_000;
export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;

/** Ступенька таймера для клиента: 1с, 1м, 1ч, 1д. */
export function remainingLabel(ms: number): { value: number; unit: "s" | "m" | "h" | "d" } {
  const safe = Math.max(0, Math.floor(ms / 1000));
  if (safe < 120) return { value: safe, unit: "s" };
  if (safe < 7200) return { value: Math.floor(safe / 60), unit: "m" };
  if (safe < 172_800) return { value: Math.floor(safe / 3600), unit: "h" };
  return { value: Math.floor(safe / 86_400), unit: "d" };
}
