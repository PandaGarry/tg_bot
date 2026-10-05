/**
 * Круглая кнопка-знак: вместо текста значок, подпись — в `aria-label` и подсказке.
 * Размер небольшой (36 px): на панели постановки и выбора здания место дорого.
 */
import { ACTION_GLYPH, ACTION_ICON, type ActionKind } from "./actionIcons.js";

export function ActionButton({
  kind,
  label,
  onClick,
  disabled,
  tone,
}: {
  kind: ActionKind;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "ok" | "warn";
}) {
  const src = ACTION_ICON[kind];
  return (
    <button
      type="button"
      className={`act${tone ? ` ${tone}` : ""}`}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {src ? <img src={src} alt="" draggable={false} /> : <span aria-hidden="true">{ACTION_GLYPH[kind]}</span>}
    </button>
  );
}
