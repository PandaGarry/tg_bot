/**
 * Регистрация аккаунта: логин, почта, пароль, повтор и два согласия.
 * Ошибка поля показывается после ухода с поля, а не на пустой форме.
 * Персонаж заводится отдельно, после входа: логин и имя лорда — разные вещи.
 */

import { useEffect, useState, type FormEvent } from "react";
import type { Locale } from "@tdl/protocol";
import { LIMITS } from "@tdl/protocol";
import { register } from "../../net.js";
import { translator } from "../../i18n/index.js";
import { goodEmail, goodLogin, goodPassword, samePassword } from "../../shell/form.js";
import { friendlyError, useFreshError } from "../../shell/errors.js";
import { EntryFrame, ScreenTitle } from "./Frame.js";
import { Check, Field, LockIcon, MailIcon, PasswordToggle, PrimaryButton, TextButton, UserIcon } from "./controls.js";
import { useNotice } from "./Notice.js";

type FieldName = "login" | "email" | "password" | "repeat";

export function RegisterScreen({
  lang,
  onLogin,
}: {
  lang: Locale;
  /** Вернуться ко входу. */
  onLogin: () => void;
}) {
  const t = translator(lang);
  const [loginName, setLoginName] = useState("");
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

  // Отказ ядра снимает ожидание и говорит причину спокойной фразой; старый отказ не всплывает.
  const failure = useFreshError();
  useEffect(() => {
    if (failure) {
      setSending(false);
      notice.say(friendlyError(lang, failure.key), "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failure?.at]);

  const loginOk = goodLogin(loginName);
  const emailOk = goodEmail(email);
  const passwordOk = goodPassword(password);
  const repeatOk = samePassword(password, repeat);
  const formOk = loginOk && emailOk && passwordOk && repeatOk;
  const canSubmit = formOk && rules && !sending;

  const errorFor = (field: FieldName): string | undefined => {
    if (!touched[field]) return undefined;
    if (field === "login" && !loginOk) return t("shell.register.need.login");
    if (field === "email" && !emailOk) return t("shell.register.need.email");
    if (field === "password" && !passwordOk) return t("shell.register.need.password");
    if (field === "repeat" && !repeatOk) return t("shell.register.need.repeat");
    return undefined;
  };
  const leave = (field: FieldName) => setTouched((prev) => ({ ...prev, [field]: true }));

  /** Подсказка над кнопкой: чего не хватает, только когда игрок уже что-то ввёл. */
  const started = Boolean(loginName || email || password || repeat);
  const missingKey = !started ? null : !rules ? "shell.register.need.rules" : !formOk ? "shell.register.need.fields" : null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSending(true);
    register(loginName.trim(), password, email.trim(), { rules: true, mail });
  };

  return (
    <EntryFrame
      lang={lang}
      notice={notice}
      start={<TextButton onClick={onLogin} data-testid="register-back">← {t("shell.register.back")}</TextButton>}
      footer={
        <>
          <p data-testid="register-problem" role="status" className="min-h-4 text-center text-[12px] leading-4 text-stone-400">
            {missingKey ? t(missingKey) : ""}
          </p>
          <PrimaryButton type="submit" form="register-form" disabled={!canSubmit} data-testid="register-submit">
            {sending ? t("shell.register.sending") : t("shell.register.submit")}
          </PrimaryButton>
        </>
      }
    >
      <ScreenTitle title={t("shell.register.title")} sub={t("shell.register.note")} />

      <form id="register-form" className="flex flex-col gap-2.5 [@media(max-height:699px)]:gap-2" onSubmit={submit}>
        <Field
          label={t("shell.register.login")}
          hint={t("shell.register.login.hint")}
          error={errorFor("login")}
          icon={<UserIcon />}
          testId="register-login"
          inputProps={{
            value: loginName,
            onChange: (event) => setLoginName(event.target.value),
            onBlur: () => leave("login"),
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
            onBlur: () => leave("email"),
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
          trailing={
            <PasswordToggle
              shown={show}
              onToggle={() => setShow((value) => !value)}
              labels={{ show: t("shell.auth.password.show"), hide: t("shell.auth.password.hide") }}
            />
          }
          inputProps={{
            value: password,
            onChange: (event) => setPassword(event.target.value),
            onBlur: () => leave("password"),
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
            onBlur: () => leave("repeat"),
            type: show ? "text" : "password",
            autoComplete: "new-password",
          }}
        />

        <div className="mt-1 flex flex-col gap-2 [@media(max-height:699px)]:mt-0">
          <Check checked={rules} onChange={setRules} testId="register-rules">
            {t("shell.register.rules")}
          </Check>
          <Check checked={mail} onChange={setMail} testId="register-mail">
            {t("shell.register.mail")}
          </Check>
        </div>
      </form>
    </EntryFrame>
  );
}
