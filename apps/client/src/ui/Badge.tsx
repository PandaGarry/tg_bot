// Универсальная метка непрочитанного: число (ярлык) или точка. Используется в чате, почте, ивентах.
// Число больше 99 показывается как «99+». Если count не задан или 0 — ничего не рисуем.
export function Badge({ count, dot = false, label }: { count?: number; dot?: boolean; label?: string }) {
  if (dot) return <span className="ui-badge ui-badge--dot" role="img" aria-label={label ?? "Есть непрочитанное"} />;
  if (!count || count <= 0) return null;
  const text = count > 99 ? "99+" : String(count);
  return (
    <span className="ui-badge" role="img" aria-label={label ?? `Непрочитано: ${text}`}>
      {text}
    </span>
  );
}
