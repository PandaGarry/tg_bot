/**
 * Примитивы окон входа, регистрации и создания — вариант A «Forge» (решено 14.10).
 * Тёмный тёплый уголь, кремовая основная кнопка, тонкая рамка поля, ржавый акцент фокуса и выбора.
 * Тени не используются. Высоты: поле 44 px; ниже 600 px — 40 px. Подсказки скрыты ниже 640 px, ошибки видны всегда.
 */

import { useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import type { Locale } from "@tdl/protocol";
import { store } from "../../store.js";

const icon = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, width: 16, height: 16, "aria-hidden": true } as const;

export const UserIcon = () => (
  <svg {...icon}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c1.8-3.2 4.6-5 8-5s6.2 1.8 8 5" />
  </svg>
);
export const MailIcon = () => (
  <svg {...icon}>
    <rect x="3" y="5" width="18" height="14" rx="3" />
    <path d="m4 7 8 6 8-6" />
  </svg>
);
export const LockIcon = () => (
  <svg {...icon}>
    <rect x="5" y="11" width="14" height="9" rx="2.5" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

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

const INPUT =
  "h-full min-w-0 flex-1 bg-transparent text-[16px] text-parch outline-none placeholder:text-mute/60 " +
  // Автозаполнение не перекрашивает поле в жёлтый и не меняет цвет текста.
  "[&:-webkit-autofill]:[-webkit-text-fill-color:#f1e8d4] [&:-webkit-autofill]:[transition:background-color_9999s_ease-out_0s]";

/** Поле: подпись сверху, поле 44 px, строка подсказки или ошибки под ним (место зарезервировано — без прыжков). */
export function Field({
  label,
  hint,
  error,
  icon: leading,
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
      <label htmlFor={id} className="mb-1 text-[12px] leading-4 text-mute [@media(max-height:639px)]:mb-0.5">
        {label}
      </label>
      <div
        className={`flex h-11 items-center gap-2 rounded-lg border bg-ink-2 pl-3 pr-1.5 transition-colors focus-within:border-parch/80 [@media(max-height:599px)]:h-10 ${
          invalid ? "border-rose-300/70" : "border-line"
        }`}
      >
        {leading ? <span className="grid size-4 shrink-0 place-items-center text-mute">{leading}</span> : null}
        <input
          id={id}
          aria-invalid={invalid || undefined}
          aria-describedby={error || hint ? helperId : undefined}
          data-testid={testId}
          className={INPUT}
          {...inputProps}
        />
        {trailing}
      </div>
      <span
        id={helperId}
        role={error ? "alert" : undefined}
        className={`mt-1 min-h-4 text-[11.5px] leading-4 [@media(max-height:599px)]:mt-0.5 ${error ? "text-rose-200" : "text-mute"} ${
          !error && hint ? "[@media(max-height:639px)]:hidden" : ""
        }`}
      >
        {error ?? hint ?? ""}
      </span>
    </div>
  );
}

/** Показ пароля текстом (не только иконкой). */
export function PasswordToggle({ shown, onToggle, labels }: { shown: boolean; onToggle: () => void; labels: { show: string; hide: string } }) {
  return (
    <button type="button" onClick={onToggle} className="h-8 shrink-0 rounded-md px-2 !text-[12px] text-mute transition-colors hover:text-parch">
      {shown ? labels.hide : labels.show}
    </button>
  );
}

/** Согласие с галочкой; кликабельна вся строка. */
export function Check({ checked, onChange, children, testId }: { checked: boolean; onChange: (value: boolean) => void; children: string; testId: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-snug text-parch/80">
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(event) => onChange(event.target.checked)} data-testid={testId} />
      <span
        aria-hidden="true"
        className={`mt-px grid size-[18px] shrink-0 place-items-center rounded-[5px] border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-rust/70 ${
          checked ? "border-rust bg-rust text-parch" : "border-line bg-ink-2"
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

/** Основная кнопка на всю колонку: кремовая, 48 px (44 px ниже 600 px). */
export function PrimaryButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="flex h-12 w-full items-center justify-center rounded-lg bg-parch px-4 !text-[15px] font-semibold text-ink transition-[background-color,transform] outline-none focus-visible:ring-2 focus-visible:ring-rust active:scale-[0.99] disabled:border disabled:border-line disabled:bg-ink-2 disabled:text-mute/70 [@media(max-height:640px)]:h-11"
    />
  );
}

/** Вход через внешний провайдер. Пока ключей нет — объявление, а не переход. */
export function ProviderButton({ label, mark, onClick, testId }: { label: string; mark: ReactNode; onClick: () => void; testId: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className="flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg border border-line bg-ink-2 px-3 !text-[13px] font-medium text-parch transition-colors hover:border-mute [@media(max-height:599px)]:h-10"
    >
      {mark}
      <span className="truncate">{label}</span>
    </button>
  );
}

/** Текстовая ссылка-действие. */
export function TextButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="inline-flex h-9 items-center gap-1 rounded-md px-1 !text-[14px] text-mute underline-offset-4 transition-colors hover:text-parch hover:underline"
    />
  );
}

/** Разделитель «или». */
export function Divider({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 text-[13px] text-mute" role="separator">
      <span className="h-px flex-1 bg-line" />
      <span>{text}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

/** Переключатель языка РУС / ENG. Выбор запоминается (store.setLang). */
export function LangSwitch({ lang }: { lang: Locale }) {
  return (
    <div role="group" aria-label="Language" className="flex rounded-full border border-line bg-ink-2 p-0.5">
      {(["ru", "en"] as Locale[]).map((code) => (
        <button
          key={code}
          type="button"
          aria-pressed={lang === code}
          onClick={() => store.setLang(code)}
          className={`h-7 min-w-11 rounded-full px-2.5 !text-[12px] font-semibold tracking-wide transition-colors ${
            lang === code ? "bg-parch text-ink" : "text-mute hover:text-parch"
          }`}
        >
          {code === "ru" ? "РУС" : "ENG"}
        </button>
      ))}
    </div>
  );
}
