/**
 * 2D-заглушка двора (этап 0 миграции, [28-pixi-migration.md](../../../docs/game/28-pixi-migration.md)):
 * диметрический контур сетки по размеру с сервера — до того, как на месте
 * сцены встанет Pixi (этап 2). Реактивный слой; в game/ это место займёт canvas.
 */

const TILE_W = 71.4;
const TILE_H = 41.4;

export function CourtPlaceholder({ size, label }: { size: number; label: string }) {
  // Ромб площадки: центр — середина сетки. Координаты мира → экран ромба.
  const cx = (size * TILE_W) / 2;
  const cy = (size * TILE_H) / 2;
  const points = (x: number, z: number): [number, number] => [
    (x - z) * (TILE_W / 2) + cx,
    (x + z) * (TILE_H / 2) + cy,
  ];
  const [cornerX, cornerY] = points(0, 0);
  const [rightX, rightY] = points(size, 0);
  const [bottomX, bottomY] = points(size, size);
  const [leftX, leftY] = points(0, size);
  const lines: { x1: number; y1: number; x2: number; y2: number; edge: boolean }[] = [];
  for (let i = 0; i <= size; i += 1) {
    const a = points(i, 0);
    const b = points(i, size);
    const c = points(0, i);
    const d = points(size, i);
    lines.push({ x1: a[0], y1: a[1], x2: b[0], y2: b[1], edge: i === 0 || i === size });
    lines.push({ x1: c[0], y1: c[1], x2: d[0], y2: d[1], edge: i === 0 || i === size });
  }
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-[#0c0704]">
      <span className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 whitespace-nowrap text-xs text-[#8a7a5f]">
        {label}
      </span>
      <svg
        viewBox={`${cornerX - 8} ${cornerY - 8} ${rightX - cornerX + 16} ${bottomY - cornerY + 16}`}
        className="h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
      >
        <polygon
          points={`${cornerX},${cornerY} ${rightX},${rightY} ${bottomX},${bottomY} ${leftX},${leftY}`}
          fill="#161009"
          stroke="#3a2c1d"
          strokeWidth={2}
        />
        {lines.map((line, index) => (
          <line
            key={index}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke={line.edge ? "#5a4327" : "#2a2015"}
            strokeWidth={line.edge ? 2 : 0.75}
          />
        ))}
      </svg>
    </div>
  );
}
