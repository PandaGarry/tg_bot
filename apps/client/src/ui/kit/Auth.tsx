/**
 * Кит окон входа, регистрации и создания лорда (14.10).
 * Примитивы: Screen (неподвижное окно), Top (шапка с назад и языком), Field (поле с подписью и подсказкой),
 * PasswordToggle, Button, Check, ProviderButton, Divider, иконки. Стили — `auth.css`, без теней.
 */

import { useId, useState } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import type { Locale } from "@tdl/protocol";
import { store } from "../../store.js";
import { translator } from "../../i18n/index.js";
import "./auth.css";

/** Неподвижное окно: вся высота видимой области, без прокрутки. */
export function Screen({ lang, children }: { lang: Locale; children: ReactNode }) {
  return (
    <main className="ui-screen" data-lang={lang}>
      <div className="ui-col">{children}</div>
    </main>
  );
}

/** Шапка: слева — назад (если нужно), справа — язык. */
export function Top({ lang, back, onBack }: { lang: Locale; back?: string; onBack?: () => void }) {
  return (
    <header className="ui-top">
      {back && onBack ? (
        <button type="button" className="ui-back" onClick={onBack} data-testid="register-back">
          <span aria-hidden="true">←</span>
          {back}
        </button>
      ) : (
        <span />
      )}
      <LangSwitch lang={lang} />
    </header>
  );
}

export function LangSwitch({ lang }: { lang: Locale }) {
  return (
    <div className="ui-seg" role="group" aria-label="Language">
      {(["ru", "en"] as Locale[]).map((code) => (
        <button
          key={code}
          type="button"
          aria-pressed={lang === code}
          onClick={() => store.setLang(code)}
          className={`ui-seg-btn ${lang === code ? "ui-seg-btn-on" : ""}`}
        >
          {code === "ru" ? "РУС" : "ENG"}
        </button>
      ))}
    </div>
  );
}

/** Поле: подпись сверху, поле 44 px, строка подсказки или ошибки под ним (место зарезервировано). */
export function Field({
  label,
  hint,
  error,
  icon,
  trailing,
  inputProps,
  testId,
}: {
  label: string;
  hint?: string;
  error?: string;
  icon?: ReactNode;
  trailing?: ReactNode;
  inputProps: InputHTMLAttributes<HTMLInputElement>;
  testId?: string;
}) {
  const id = useId();
  const helperId = `${id}-helper`;
  return (
    <div className="ui-field">
      <label htmlFor={id} className="ui-label">
        {label}
      </label>
      <div className={`ui-box ${trailing ? "ui-box-trailing" : ""} ${error ? "ui-box-error" : ""}`}>
        {icon ? (
          <span className="ui-icon" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? helperId : undefined}
          data-testid={testId}
          className="ui-input"
          style={icon ? undefined : { paddingLeft: 13 }}
          {...inputProps}
        />
        {trailing}
      </div>
      <span id={helperId} className={`ui-helper ${error ? "ui-helper-error" : hint ? "ui-helper-hint" : ""}`} role={error ? "alert" : undefined}>
        {error ?? hint ?? ""}
      </span>
    </div>
  );
}

/** Показ и скрытие пароля: текстом, а не только иконкой. */
export function PasswordToggle({ lang, shown, onToggle }: { lang: Locale; shown: boolean; onToggle: () => void }) {
  const t = translator(lang);
  return (
    <button type="button" className="ui-toggle" onClick={onToggle} aria-pressed={shown}>
      {shown ? t("shell.auth.password.hide") : t("shell.auth.password.show")}
    </button>
  );
}

export function Button({
  variant = "primary",
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" }) {
  return (
    <button type="button" {...props} className={`ui-btn ui-btn-${variant} ${className}`}>
      {children}
    </button>
  );
}

/** Согласие: галочка с крупной областью касания, текст переносится. */
export function Check({
  checked,
  onChange,
  children,
  testId,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  children: string;
  testId: string;
}) {
  return (
    <label className="ui-check">
      <input
        type="checkbox"
        className="ui-check-input"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        data-testid={testId}
      />
      <span className="ui-check-box" aria-hidden="true">
        {checked ? (
          <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="m3 8.5 3 3 7-7" />
          </svg>
        ) : null}
      </span>
      <span>{children}</span>
    </label>
  );
}

export function ProviderButton({
  label,
  mark,
  onClick,
  testId,
}: {
  label: string;
  mark: ReactNode;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <button type="button" className="ui-btn ui-btn-provider" onClick={onClick} data-testid={testId}>
      <span aria-hidden="true" style={{ display: "inline-flex" }}>
        {mark}
      </span>
      {label}
    </button>
  );
}

export function Divider({ text }: { text: string }) {
  return (
    <div className="ui-divider" role="separator">
      <span>{text}</span>
    </div>
  );
}

export const GoogleMark = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12s4.3 9.5 9.5 9.5c5.5 0 9.1-3.9 9.1-9.3 0-.6-.1-1.1-.2-1.6H12z" />
  </svg>
);

export const YandexMark = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <rect x="2" y="2" width="20" height="20" rx="5" fill="#FC3F1D" />
    <path fill="#fff" d="M13.6 19h-2.3V6.6h-1.2c-2.2 0-3.4 1.1-3.4 2.9 0 2 .9 3 2.7 4.2l1.5 1L7.1 19H4.7l3.4-5.1C6.1 12.7 5 11.4 5 9.5 5 7 6.7 5.4 9.9 5.4h3.7V19z" />
  </svg>
);

const iconProps = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, width: 16, height: 16 };
export const UserIcon = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c1.8-3.2 4.6-5 8-5s6.2 1.8 8 5" />
  </svg>
);
export const MailIcon = () => (
  <svg {...iconProps}>
    <rect x="3" y="5" width="18" height="14" rx="3" />
    <path d="m4 7 8 6 8-6" />
  </svg>
);
export const LockIcon = () => (
  <svg {...iconProps}>
    <rect x="5" y="10" width="14" height="10" rx="3" />
    <path d="M8 10V7a4 4 0 1 1 8 0v3" />
  </svg>
);

/** Состояние «провайдер пока не подключён»: сообщение, без перехода. */
export function useProviderNote(lang: Locale) {
  const t = translator(lang);
  const [note, setNote] = useState<string | null>(null);
  return {
    note,
    ask(provider: string) {
      setNote(t("shell.auth.provider.pending", { provider }));
    },
  };
}
