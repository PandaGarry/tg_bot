/**
 * Регистрация аккаунта: логин, почта, пароль, повтор и два согласия.
 * Ошибка показывается под полем после ухода с поля, а не на пустой форме.
 * Окно неподвижное: всё помещается в 360 × 640; подзаголовок скрывается только на коротких экранах.
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
import { Button, Check, Field, LockIcon, MailIcon, PasswordToggle, Screen, Top, UserIcon } from "./kit/Auth.js";
import { Notice, useNotice } from "./kit/Notice.js";

type FieldName = "login" | "email" | "password" | "repeat";

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
  // Ошибки показываем только для полей, в которых игрок побывал и ушёл.
  const [touched, setTouched] = useState<Record<FieldName, boolean>>({ login: false, email: false, password: false, repeat: false });
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

  const errorFor = (field: FieldName): string | undefined => {
    if (!touched[field]) return undefined;
    if (field === "login" && !loginOk) return t("shell.register.need.login");
    if (field === "email" && !emailOk) return t("shell.register.need.email");
    if (field === "password" && !passwordOk) return t("shell.register.need.password");
    if (field === "repeat" && !repeatOk) return t("shell.register.need.repeat");
    return undefined;
  };
  const blur = (field: FieldName) => setTouched((prev) => ({ ...prev, [field]: true }));

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
    <Screen lang={lang}>
      <Notice message={notice.message} tone={notice.tone} id={notice.id} />

      <Top lang={lang} back={t("shell.register.back")} onBack={onLogin} />

      <div className="ui-head">
        <h1 className="ui-title">{t("shell.register.title")}</h1>
        <p className="ui-sub ui-sub-optional">{t("shell.register.note")}</p>
      </div>

      <form
        id="register-form"
        className="ui-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSubmit) return;
          setSending(true);
          register(login.trim(), password, email.trim(), { rules: true, mail });
        }}
      >
        <Field
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

        <Field
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

        <Field
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

        <Field
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

        <div className="ui-checks">
          <Check checked={rules} onChange={setRules} testId="register-rules">
            {t("shell.register.rules")}
          </Check>
          <Check checked={mail} onChange={setMail} testId="register-mail">
            {t("shell.register.mail")}
          </Check>
        </div>
      </form>

      <div className="ui-push" />

      <p data-testid="register-problem" className="ui-helper ui-helper-center" role="status">
        {missingKey ? t(missingKey) : ""}
      </p>
      <Button type="submit" form="register-form" disabled={!canSubmit} data-testid="register-submit">
        {sending ? t("shell.register.sending") : t("shell.register.submit")}
      </Button>
    </Screen>
  );
}
