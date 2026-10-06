/**
 * Заглушка для портретной ориентации.
 * Показывается только на узких экранах в портрете (см. @media в theme.css).
 * В ландшафте на десктопах даже при малой высоте не мешает.
 */
export function PortraitGuard() {
  return (
    <div className="mt-portrait-guard" role="dialog" aria-modal="true" aria-label="Поверните устройство">
      <div className="mt-portrait-guard__icon" aria-hidden>📱</div>
      <div className="mt-portrait-guard__title">Поверните устройство</div>
      <div className="mt-portrait-guard__text">
        Mitchell — ландшафтный интерфейс. Пожалуйста, поверните телефон или планшет горизонтально, чтобы продолжить игру.
      </div>
    </div>
  );
}
