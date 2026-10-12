/**
 * Регистрация аккаунта: логин, почта, пароль, подтверждение пароля и согласия.
 * Отдельный экран от создания персонажа: логин и никнейм — разные понятия.
 * Пароль наверх уходит один раз: проверка совпадения — на этом экране.
 */

import { useEffect, useState } from "react";
import type { Locale } from "@tdl/protocol";
import { LIMITS } from "@tdl/protocol";
import { register } from "../net.js";
import { translator } from "../i18n/index.js";
import {
  AuthButton,
  AuthField,
  AuthScreen,
  LangSwitch,
  LockIcon,
  MailIcon,
  PasswordToggle,
  UserIcon,
} from "./kit/Auth.js";
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
  const [show, setShow] = useState(false);
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
    <AuthScreen lang={lang}>
      <div className="auth-top">
        <LangSwitch lang={lang} />
      </div>

      <header className="auth-head">
        <h1 className="auth-title auth-title-sm">{t("shell.register.title")}</h1>
        <p className="auth-sub">{t("shell.register.note")}</p>
      </header>

      <form
        className="auth-card"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSubmit) return;
          setSending(true);
          register(login.trim(), password, email.trim(), { rules: true, mail });
        }}
      >
        <AuthField
          label={t("shell.register.login")}
          hint={t("shell.register.login.hint")}
          icon={<UserIcon />}
          testId="register-login"
          inputProps={{
            value: login,
            onChange: (event) => setLogin(event.target.value),
            autoComplete: "username",
            autoCorrect: "off",
            autoCapitalize: "none",
            spellCheck: false,
            maxLength: LIMITS.loginMax,
          }}
        />

        <AuthField
          label={t("shell.register.email")}
          icon={<MailIcon />}
          testId="register-email"
          inputProps={{
            value: email,
            onChange: (event) => setEmail(event.target.value),
            autoComplete: "email",
            inputMode: "email",
            type: "email",
            autoCapitalize: "none",
            maxLength: LIMITS.emailMax,
          }}
        />

        <AuthField
          label={t("shell.register.password")}
          icon={<LockIcon />}
          testId="register-password"
          trailing={<PasswordToggle lang={lang} shown={show} onToggle={() => setShow((v) => !v)} />}
          inputProps={{
            value: password,
            onChange: (event) => setPassword(event.target.value),
            type: show ? "text" : "password",
            autoComplete: "new-password",
          }}
        />

        <AuthField
          label={t("shell.register.repeat")}
          icon={<LockIcon />}
          testId="register-repeat"
          inputProps={{
            value: repeat,
            onChange: (event) => setRepeat(event.target.value),
            type: show ? "text" : "password",
            autoComplete: "new-password",
          }}
        />

        <label className="auth-check">
          <input
            type="checkbox"
            checked={rules}
            onChange={(event) => setRules(event.target.checked)}
            data-testid="register-rules"
          />
          <span>{t("shell.register.rules")}</span>
        </label>

        <label className="auth-check">
          <input
            type="checkbox"
            checked={mail}
            onChange={(event) => setMail(event.target.checked)}
            data-testid="register-mail"
          />
          <span>{t("shell.register.mail")}</span>
        </label>

        <AuthButton type="submit" disabled={!canSubmit} className="auth-submit">
          {sending ? t("shell.register.sending") : t("shell.register.submit")}
        </AuthButton>
      </form>

      {/* Короткое имя, почта и пароль говорят, чего не хватает, до нажатия. */}
      <p data-testid="register-problem" role="status" className="auth-note">
        {failureKey ? t(failureKey) : problemKey ? t(problemKey) : ""}
      </p>

      <p className="auth-foot">
        <button type="button" onClick={onLogin} className="auth-link">
          {t("shell.register.have")}
        </button>
      </p>
    </AuthScreen>
  );
}
