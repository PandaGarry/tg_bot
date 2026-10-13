/**
 * Регистрация аккаунта: логин, почта, пароль, повтор и два согласия.
 * Ошибка показывается под полем после ухода с поля, а не на пустой форме.
 * Кнопка «Зарегистрироваться» закреплена внизу экрана на телефоне.
 * Отдельно от создания персонажа: логин и имя лорда — разные вещи.
 */

import { useEffect, useState } from "react";
import type { Locale } from "@tdl/protocol";
import { LIMITS } from "@tdl/protocol";
import { register } from "../net.js";
import { translator } from "../i18n/index.js";
import { useStore } from "../useStore.js";
import { goodEmail, goodLogin, goodPassword, samePassword } from "../shell/form.js";
import { friendlyError } from "../shell/errors.js";
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
import { Notice, useNotice } from "./kit/Notice.js";

type Field = "login" | "email" | "password" | "repeat";

export function Register({
  lang,
  onLogin,
}: {
  lang: Locale;
  /** Вернуться ко входу. */
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
  // Поле «тронуто», когда игрок в нём был и ушёл. Ошибки показываем только для тронутых полей.
  const [touched, setTouched] = useState<Record<Field, boolean>>({ login: false, email: false, password: false, repeat: false });
  const notice = useNotice();

  // Отказ ядра снимает ожидание и говорит причину спокойной фразой.
  const failureKey = state.errors[0]?.key;
  useEffect(() => {
    if (failureKey) {
      setSending(false);
      notice.say(friendlyError(lang, failureKey), "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failureKey]);

  const loginOk = goodLogin(login);
  const emailOk = goodEmail(email);
  const passwordOk = goodPassword(password);
  const repeatOk = samePassword(password, repeat);
  const canSubmit = loginOk && emailOk && passwordOk && repeatOk && rules && !sending;

  const errorFor = (field: Field): string | undefined => {
    if (!touched[field]) return undefined;
    if (field === "login" && !loginOk) return t("shell.register.need.login");
    if (field === "email" && !emailOk) return t("shell.register.need.email");
    if (field === "password" && !passwordOk) return t("shell.register.need.password");
    if (field === "repeat" && !repeatOk) return t("shell.register.need.repeat");
    return undefined;
  };
  const blur = (field: Field) => setTouched((prev) => ({ ...prev, [field]: true }));

  /** Подсказка над кнопкой: чего не хватает, только когда игрок уже что-то ввёл. */
  const started = login || email || password || repeat;
  const missingKey = !started
    ? null
    : !rules
      ? "shell.register.need.rules"
      : !loginOk || !emailOk || !passwordOk || !repeatOk
        ? "shell.register.need.fields"
        : null;

  return (
    <AuthScreen lang={lang}>
      <Notice message={notice.message} tone={notice.tone} id={notice.id} />

      <header className="auth-top">
        <button type="button" onClick={onLogin} className="auth-back" data-testid="register-back">
          ← {t("shell.register.back")}
        </button>
        <LangSwitch lang={lang} />
      </header>

      <div className="auth-intro">
        <h1 className="auth-title auth-title-sm">{t("shell.register.title")}</h1>
        <p className="auth-sub">{t("shell.register.note")}</p>
      </div>

      <form
        id="register-form"
        className="auth-card reg-card"
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
          error={errorFor("login")}
          icon={<UserIcon />}
          testId="register-login"
          inputProps={{
            value: login,
            onChange: (event) => setLogin(event.target.value),
            onBlur: () => blur("login"),
            autoComplete: "username",
            autoCorrect: "off",
            autoCapitalize: "none",
            spellCheck: false,
            maxLength: LIMITS.loginMax,
          }}
        />

        <AuthField
          label={t("shell.register.email")}
          error={errorFor("email")}
          icon={<MailIcon />}
          testId="register-email"
          inputProps={{
            value: email,
            onChange: (event) => setEmail(event.target.value),
            onBlur: () => blur("email"),
            autoComplete: "email",
            inputMode: "email",
            type: "email",
            autoCapitalize: "none",
            maxLength: LIMITS.emailMax,
          }}
        />

        <AuthField
          label={t("shell.register.password")}
          hint={t("shell.register.password.hint")}
          error={errorFor("password")}
          icon={<LockIcon />}
          testId="register-password"
          trailing={<PasswordToggle lang={lang} shown={show} onToggle={() => setShow((v) => !v)} />}
          inputProps={{
            value: password,
            onChange: (event) => setPassword(event.target.value),
            onBlur: () => blur("password"),
            type: show ? "text" : "password",
            autoComplete: "new-password",
          }}
        />

        <AuthField
          label={t("shell.register.repeat")}
          error={errorFor("repeat")}
          icon={<LockIcon />}
          testId="register-repeat"
          inputProps={{
            value: repeat,
            onChange: (event) => setRepeat(event.target.value),
            onBlur: () => blur("repeat"),
            type: show ? "text" : "password",
            autoComplete: "new-password",
          }}
        />

        <div className="reg-checks">
          <Check checked={rules} onChange={setRules} testId="register-rules">
            {t("shell.register.rules")}
          </Check>
          <Check checked={mail} onChange={setMail} testId="register-mail">
            {t("shell.register.mail")}
          </Check>
        </div>
      </form>

      {/* Закреплённая внизу панель: подсказка и кнопка всегда на виду, в том числе над клавиатурой. */}
      <div className="reg-footer">
        <p data-testid="register-problem" className="reg-hint" role="status">
          {missingKey ? t(missingKey) : ""}
        </p>
        <AuthButton type="submit" form="register-form" disabled={!canSubmit} className="auth-submit" data-testid="register-submit">
          {sending ? t("shell.register.sending") : t("shell.register.submit")}
        </AuthButton>
      </div>
    </AuthScreen>
  );
}

/** Чекбокс с крупной областью касания. Нативный ввод остаётся для клавиатуры и экранных читалок. */
function Check({
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
    <label className="reg-check">
      <input
        type="checkbox"
        className="reg-check-input"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        data-testid={testId}
      />
      <span className="reg-check-box" aria-hidden="true">
        {checked ? (
          <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="m3 8.5 3 3 7-7" />
          </svg>
        ) : null}
      </span>
      <span className="reg-check-text">{children}</span>
    </label>
  );
}
