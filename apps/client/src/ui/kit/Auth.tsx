/**
 * Набор компонентов окон входа и регистрации: поле, кнопки, кнопка провайдера,
 * переключатель языка. Стили — классы `auth-*` в styles.css; тени не используются.
 * Поля и кнопки не ниже 44 px, шрифт поля 16 px (на телефоне не масштабирует страницу).
 */

import { useId, useState } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import type { Locale } from "@tdl/protocol";
import { store } from "../../store.js";
import { translator } from "../../i18n/index.js";

export function AuthScreen({ lang, children }: { lang: Locale; children: ReactNode }) {
  return (
    <main className="auth-screen" data-lang={lang}>
      <div className="auth-column">{children}</div>
    </main>
  );
}

export function LangSwitch({ lang }: { lang: Locale }) {
  return (
    <div className="auth-lang" role="group" aria-label="Language">
      {(["ru", "en"] as Locale[]).map((code) => (
        <button
          key={code}
          type="button"
          aria-pressed={lang === code}
          onClick={() => store.setLang(code)}
          className={`auth-lang-btn ${lang === code ? "auth-lang-btn-on" : ""}`}
        >
          {code === "ru" ? "РУС" : "ENG"}
        </button>
      ))}
    </div>
  );
}

/** Поле с подписью сверху, подсказкой и ошибкой рядом. Ошибка объявляется вспомогательным технологиям. */
export function AuthField({
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
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="auth-field">
      <label htmlFor={id} className="auth-label">
        {label}
      </label>
      <div className={`auth-box ${error ? "auth-box-error" : ""}`}>
        {icon ? <span className="auth-icon" aria-hidden="true">{icon}</span> : null}
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          data-testid={testId}
          className="auth-input"
          {...inputProps}
        />
        {trailing}
      </div>
      {hint && !error ? (
        <span id={hintId} className="auth-hint">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={errorId} className="auth-error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

/** Показ и скрытие пароля. Кнопка с текстом, а не только иконкой. */
export function PasswordToggle({ lang, shown, onToggle }: { lang: Locale; shown: boolean; onToggle: () => void }) {
  const t = translator(lang);
  return (
    <button type="button" className="auth-toggle" onClick={onToggle} aria-pressed={shown}>
      {shown ? t("shell.auth.password.hide") : t("shell.auth.password.show")}
    </button>
  );
}

export function AuthButton({
  variant = "primary",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" }) {
  return (
    <button type="button" {...props} className={`auth-btn auth-btn-${variant} ${props.className ?? ""}`}>
      {children}
    </button>
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
    <button type="button" className="auth-btn auth-btn-provider" onClick={onClick} data-testid={testId}>
      <span className="auth-provider-mark" aria-hidden="true">{mark}</span>
      {label}
    </button>
  );
}

export function Divider({ text }: { text: string }) {
  return (
    <div className="auth-divider" role="separator">
      <span>{text}</span>
    </div>
  );
}

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

export const GoogleMark = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12s4.3 9.5 9.5 9.5c5.5 0 9.1-3.9 9.1-9.3 0-.6-.1-1.1-.2-1.6H12z" />
  </svg>
);

export const YandexMark = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <rect x="2" y="2" width="20" height="20" rx="5" fill="#FC3F1D" />
    <path fill="#fff" d="M13.6 19h-2.3V6.6h-1.2c-2.2 0-3.4 1.1-3.4 2.9 0 2 .9 3 2.7 4.2l1.5 1L7.1 19H4.7l3.4-5.1C6.1 12.7 5 11.4 5 9.5 5 7 6.7 5.4 9.9 5.4h3.7V19z" />
  </svg>
);

export const UserIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c1.8-3.2 4.6-5 8-5s6.2 1.8 8 5" />
  </svg>
);

export const MailIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18">
    <rect x="3" y="5" width="18" height="14" rx="3" />
    <path d="m4 7 8 6 8-6" />
  </svg>
);

export const LockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18">
    <rect x="5" y="10" width="14" height="10" rx="3" />
    <path d="M8 10V7a4 4 0 1 1 8 0v3" />
  </svg>
);
