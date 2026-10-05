/** Остаток времени для таймера над зданием: «2д 04:12» от суток и «10:42:05» меньше суток. */
export function formatDuration(ms: number, dayLabel = "д"): string {
  const total = Math.max(0, Math.ceil((Number.isFinite(ms) ? ms : 0) / 1000));
  const d = Math.floor(total / 86_400);
  const h = Math.floor((total % 86_400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return d > 0 ? `${d}${dayLabel} ${p(h)}:${p(m)}` : `${p(h)}:${p(m)}:${p(s)}`;
}
