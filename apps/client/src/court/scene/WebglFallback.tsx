/**
 * Запасной экран двора при отсутствии WebGL: сохраняет статичный фон
 * court-fallback.jpg и текстовую подсказку оболочки.
 */

import { C } from "../materials/palette.js";

export function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function WebglFallback({ message }: { message: string }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: `url(court-fallback.jpg) center / cover no-repeat, ${C.sky}` }}>
      <div className="court-note">{message}</div>
    </div>
  );
}
