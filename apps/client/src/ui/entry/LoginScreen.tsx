/**
 * Вход: логин или почта и пароль. Регистрация — текстовая ссылка внизу.
 * Google ID и Яндекс ID — кнопки; до ключей заказчика показывают объявление, а не переход.
 * Поля монтируются только после загрузки (main.tsx): браузер не показывает автозаполнение раньше времени.
 */

import { useEffect, useState, type FormEvent } from "react";
import type { Locale } from "@tdl/protocol";
import { login } from "../../net.js";
import { translator } from "../../i18n/index.js";
import { friendlyError, useFreshError } from "../../shell/errors.js";
import { EntryFrame, ScreenTitle } from "./Frame.js";
import { Divider, Field, GoogleMark, LockIcon, PasswordToggle, PrimaryButton, ProviderButton, TextButton, UserIcon, YandexMark } from "./controls.js";
import { useNotice } from "./Notice.js";

export function LoginScreen({
  lang,
  statusKey: status,
  onRegister,
}: {
  lang: Locale;
  /** Ключ статуса связи из `statusKey()`; «Связи нет» показывается объявлением. */
  statusKey: string;
  /** Открыть окно регистрации аккаунта. */
  onRegister: () => void;
}) {
  const t = translator(lang);
  const [loginName, setLoginName] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const notice = useNotice();
  const canSubmit = loginName.trim().length >= 3 && password.length >= 8;

  // Статус ядра (например, связи нет) — объявлением, а не строкой под формой.
  useEffect(() => {
    if (status && status !== "shell.boot.subtitle") notice.say(t(status), "error");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Отказ ядра при входе — переводится; свежий отказ, а не старый из прошлой попытки.
  const failure = useFreshError();
  useEffect(() => {
    if (failure) notice.say(friendlyError(lang, failure.key), "error");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failure?.at]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    login(loginName.trim(), password);
  };

  return (
    <EntryFrame
      lang={lang}
      notice={notice}
      footer={
        <>
          <PrimaryButton type="submit" form="login-form" disabled={!canSubmit} data-testid="boot-enter">
            {t("shell.boot.enter")}
          </PrimaryButton>
          <p className="text-center text-[13px] text-stone-400">
            {t("shell.boot.noacc")}{" "}
            <TextButton onClick={onRegister} data-testid="boot-to-register" className="text-stone-100 underline">
              {t("shell.boot.register")}
            </TextButton>
          </p>
        </>
      }
    >
      <div className="flex items-center gap-3">
        <img className="size-12 shrink-0 rounded-xl" src="logo.png" alt="" />
        <ScreenTitle title={t("shell.app.title")} sub={t("shell.boot.subtitle")} />
      </div>

      <form id="login-form" className="flex flex-col gap-3" onSubmit={submit}>
        <Field
          label={t("shell.boot.login")}
          icon={<UserIcon />}
          testId="boot-login"
          inputProps={{
            value: loginName,
            onChange: (event) => setLoginName(event.target.value),
            autoComplete: "username",
            autoCapitalize: "none",
            autoCorrect: "off",
            spellCheck: false,
          }}
        />
        <Field
          label={t("shell.boot.password")}
          icon={<LockIcon />}
          testId="boot-password"
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
            type: show ? "text" : "password",
            autoComplete: "current-password",
          }}
        />
      </form>

      <Divider text={t("shell.auth.or")} />

      <div className="flex flex-col gap-2">
        <ProviderButton
          label={t("shell.auth.provider.google")}
          mark={<GoogleMark />}
          testId="boot-google"
          onClick={() => notice.say(t("shell.auth.provider.pending", { provider: "Google ID" }))}
        />
        <ProviderButton
          label={t("shell.auth.provider.yandex")}
          mark={<YandexMark />}
          testId="boot-yandex"
          onClick={() => notice.say(t("shell.auth.provider.pending", { provider: "Яндекс ID" }))}
        />
      </div>
    </EntryFrame>
  );
}
