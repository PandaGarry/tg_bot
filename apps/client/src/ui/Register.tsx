/**
 * Регистрация аккаунта: логин, почта, пароль, подтверждение пароля и согласия.
 * Отдельный экран от создания персонажа: логин и никнейм — разные понятия.
 * Пароль наверх уходит один раз: проверка совпадения — на этом экране.
 */

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Locale } from "@tdl/protocol";
import { LIMITS } from "@tdl/protocol";
import { register } from "../net.js";
import { translator } from "../i18n/index.js";
import { useStore } from "../useStore.js";
import { goodEmail, goodLogin, goodPassword, samePassword } from "../shell/form.js";

export function Register({
  lang,
  onLogin,
}: {
  lang: Locale;
  /** Вернуться ко входу: регистрация уже была. */
  onLogin: () => void;
}) {
  const t = translator(lang);
  const state = useStore();
  const [login, setLogin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [rules, setRules] = useState(false);
  const [mail, setMail] = useState(false);
  const [sending, setSending] = useState(false);

  // Отказ ядра (логин занят, почта не та) снимает ожидание и говорит причину.
  const failureKey = state.errors[0]?.key;
  useEffect(() => {
    if (failureKey) setSending(false);
  }, [failureKey]);

  const loginOk = goodLogin(login);
  const emailOk = goodEmail(email);
  const passwordOk = goodPassword(password);
  const repeatOk = samePassword(password, repeat);
  const canSubmit = loginOk && emailOk && passwordOk && repeatOk && rules && !sending;

  /** Что именно не так: игрок видит одну короткую строку, без шутки. */
  const problemKey = !loginOk
    ? "shell.register.need.login"
    : !emailOk
      ? "shell.register.need.email"
      : !passwordOk
        ? "shell.register.need.password"
        : !repeatOk
          ? "shell.register.need.repeat"
          : !rules
            ? "shell.register.need.rules"
            : null;

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center gap-4 p-5 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
      <h1 className="text-xl text-bone">{t("shell.register.title")}</h1>
      <p className="text-xs text-stone-500">{t("shell.register.note")}</p>

      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSubmit) return;
          setSending(true);
          register(login.trim(), password, email.trim(), { rules: true, mail });
        }}
      >
        <Field label={t("shell.register.login")} hint={t("shell.register.login.hint")}>
          <input
            value={login}
            onChange={(event) => setLogin(event.target.value)}
            autoComplete="username"
            autoCorrect="off"
            spellCheck={false}
            maxLength={LIMITS.loginMax}
            data-testid="register-login"
            className={INPUT}
          />
        </Field>

        <Field label={t("shell.register.email")}>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            inputMode="email"
            type="email"
            maxLength={LIMITS.emailMax}
            data-testid="register-email"
            className={INPUT}
          />
        </Field>

        <Field label={t("shell.register.password")}>
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete="new-password"
            data-testid="register-password"
            className={INPUT}
          />
        </Field>

        <Field label={t("shell.register.repeat")}>
          <input
            value={repeat}
            onChange={(event) => setRepeat(event.target.value)}
            type="password"
            autoComplete="new-password"
            data-testid="register-repeat"
            className={INPUT}
          />
        </Field>

        <label className="flex items-start gap-2 text-xs text-stone-400">
          <input
            type="checkbox"
            checked={rules}
            onChange={(event) => setRules(event.target.checked)}
            data-testid="register-rules"
            className="mt-0.5 h-5 w-5 shrink-0"
          />
          <span>{t("shell.register.rules")}</span>
        </label>

        <label className="flex items-start gap-2 text-xs text-stone-400">
          <input
            type="checkbox"
            checked={mail}
            onChange={(event) => setMail(event.target.checked)}
            data-testid="register-mail"
            className="mt-0.5 h-5 w-5 shrink-0"
          />
          <span>{t("shell.register.mail")}</span>
        </label>

        <button
          type="submit"
          disabled={!canSubmit}
          className="min-h-[44px] rounded border border-stone-600 bg-stone-800 text-bone disabled:opacity-40"
        >
          {sending ? t("shell.register.sending") : t("shell.register.submit")}
        </button>
      </form>

      {/* Короткое имя, почта и пароль говорят, чего не хватает, до нажатия. */}
      <p data-testid="register-problem" className="min-h-[1rem] text-xs text-stone-500">
        {failureKey ? t(failureKey) : problemKey ? t(problemKey) : ""}
      </p>

      <button type="button" onClick={onLogin} className="min-h-[44px] text-sm text-stone-400">
        {t("shell.register.have")}
      </button>
    </main>
  );
}

const INPUT =
  "min-h-[44px] rounded border border-stone-700 bg-stone-900 px-3 text-bone outline-none focus:border-stone-500";

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm text-stone-400">
      {label}
      {children}
      {hint ? <span className="text-[11px] text-stone-600">{hint}</span> : null}
    </label>
  );
}
