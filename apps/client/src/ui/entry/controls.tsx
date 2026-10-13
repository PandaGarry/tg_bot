/**
 * Примитивы окон входа, регистрации и создания: поле, поле пароля, согласие, кнопки, сегмент языка.
 * Всё — утилиты Tailwind и токены проекта; тени не используются.
 * Высоты адаптивны: ниже 600 px поля и кнопки 40 и 44 px, ниже 640 px подсказки скрыты (ошибки видны всегда).
 */

import { useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import type { Locale } from "@tdl/protocol";
import { store } from "../../store.js";

/* ---- Иконки (контур, 16 px) ---- */

const iconProps = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, width: 16, height: 16, "aria-hidden": true } as const;
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
    <rect x="5" y="11" width="14" height="9" rx="2.5" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

/* ---- Логотипы провайдеров ---- */

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

/* ---- Поля ---- */

const INPUT_CLASS =
  "h-full min-w-0 flex-1 bg-transparent text-[16px] text-stone-100 outline-none placeholder:text-stone-600 " +
  // Автозаполнение браузера не перекрашивает поле в жёлтый и не меняет цвет текста.
  "[&:-webkit-autofill]:[-webkit-text-fill-color:#f5f5f4] [&:-webkit-autofill]:[transition:background-color_9999s_ease-out_0s]";

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
  const helperId = `${id}-help`;
  const invalid = Boolean(error);
  return (
    <div className="flex flex-col">
      <label htmlFor={id} className="mb-1 text-[12px] leading-4 text-stone-400">
        {label}
      </label>
      <div
        className={`flex h-11 items-center gap-2 rounded-xl border bg-stone-900/70 pl-3 pr-1.5 transition-colors focus-within:border-stone-300 [@media(max-height:599px)]:h-10 ${
          invalid ? "border-rose-300/60" : "border-stone-700"
        }`}
      >
        {icon ? <span className="grid size-4 shrink-0 place-items-center text-stone-500">{icon}</span> : null}
        <input
          id={id}
          aria-invalid={invalid || undefined}
          aria-describedby={error || hint ? helperId : undefined}
          data-testid={testId}
          className={INPUT_CLASS}
          {...inputProps}
        />
        {trailing}
      </div>
      <span
        id={helperId}
        role={error ? "alert" : undefined}
        className={`mt-1 min-h-4 text-[11.5px] leading-4 [@media(max-height:599px)]:mt-0 ${error ? "text-rose-200" : "text-stone-500"} ${
          !error && hint ? "[@media(max-height:639px)]:hidden" : ""
        } ${!error ? "[@media(max-height:599px)]:hidden" : ""}`}
      >
        {error ?? hint ?? ""}
      </span>
    </div>
  );
}

/** Показ и скрытие пароля текстом, а не только иконкой. */
export function PasswordToggle({ shown, onToggle, labels }: { shown: boolean; onToggle: () => void; labels: { show: string; hide: string } }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="h-8 shrink-0 rounded-lg px-2 text-[12px] text-stone-400 transition-colors hover:text-stone-200"
    >
      {shown ? labels.hide : labels.show}
    </button>
  );
}

/** Согласие с галочкой. Кликабельна вся строка. */
export function Check({ checked, onChange, children, testId }: { checked: boolean; onChange: (value: boolean) => void; children: string; testId: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-snug text-stone-300">
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        data-testid={testId}
      />
      <span
        aria-hidden="true"
        className={`mt-px grid size-[18px] shrink-0 place-items-center rounded-[5px] border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-stone-300/60 ${
          checked ? "border-bone bg-bone text-stone-950" : "border-stone-600 bg-stone-900/70"
        }`}
      >
        {checked ? (
          <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M3 8.5 6.5 12 13 4.5" />
          </svg>
        ) : null}
      </span>
      <span>{children}</span>
    </label>
  );
}

/* ---- Кнопки ---- */

/** Основная кнопка на всю колонку: светлая, 48 px (44 px ниже 600 px). */
export function PrimaryButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="flex h-12 w-full items-center justify-center rounded-xl bg-bone px-4 text-[15px] font-semibold tracking-tight text-stone-950 transition-[background-color,transform] active:scale-[0.99] disabled:bg-stone-800 disabled:text-stone-500 [@media(max-height:599px)]:h-11"
    />
  );
}

/** Кнопка входа через внешний провайдер. Пока ключей нет — объявление, а не переход. */
export function ProviderButton({ label, mark, onClick, testId }: { label: string; mark: ReactNode; onClick: () => void; testId: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className="flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border border-stone-700 bg-stone-900/50 px-3 text-[13px] font-medium text-stone-200 transition-colors hover:border-stone-500 [@media(max-height:599px)]:h-10"
    >
      {mark}
      <span className="truncate">{label}</span>
    </button>
  );
}

/** Текстовая ссылка-действие (регистрация, назад). */
export function TextButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg px-1 text-[14px] text-stone-300 underline-offset-4 transition-colors hover:text-stone-100 hover:underline"
    />
  );
}

/** Разделитель «или» между формой и внешними входами. */
export function Divider({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 text-[12px] text-stone-500" role="separator">
      <span className="h-px flex-1 bg-stone-800" />
      <span>{text}</span>
      <span className="h-px flex-1 bg-stone-800" />
    </div>
  );
}

/** Переключатель языка РУС / ENG. Выбор запоминается (store.setLang). */
export function LangSwitch({ lang }: { lang: Locale }) {
  return (
    <div role="group" aria-label="Language" className="flex rounded-full border border-stone-700 bg-stone-900/70 p-0.5">
      {(["ru", "en"] as Locale[]).map((code) => (
        <button
          key={code}
          type="button"
          aria-pressed={lang === code}
          onClick={() => store.setLang(code)}
          className={`h-7 min-w-11 rounded-full px-2.5 text-[12px] font-semibold tracking-wide transition-colors ${
            lang === code ? "bg-stone-200 text-stone-950" : "text-stone-400 hover:text-stone-200"
          }`}
        >
          {code === "ru" ? "РУС" : "ENG"}
        </button>
      ))}
    </div>
  );
}
