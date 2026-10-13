/**
 * Вход: логин или почта и пароль. Регистрация — отдельная явная кнопка: аккаунт и персонаж заводятся врозь.
 * Google ID и Яндекс ID — кнопки; до ключей заказчика показывают объявление, а не переход.
 */

import { useEffect, useState } from "react";
import type { Locale } from "@tdl/protocol";
import { login } from "../net.js";
import { friendlyError, useFreshError } from "../shell/errors.js";
import { translator } from "../i18n/index.js";
import {
  AuthButton,
  AuthField,
  AuthScreen,
  Divider,
  GoogleMark,
  LangSwitch,
  LockIcon,
  PasswordToggle,
  ProviderButton,
  UserIcon,
  YandexMark,
} from "./kit/Auth.js";
import { Notice, useNotice } from "./kit/Notice.js";

export function Boot({
  lang,
  statusKey: status,
  onRegister,
}: {
  lang: Locale;
  statusKey: string;
  /** Перейти к окну регистрации аккаунта. */
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

  // Отказ ядра при входе (неверный логин или пароль, связи нет) — переводится, игровые фразы не выводятся.
  const failure = useFreshError();
  useEffect(() => {
    if (failure) notice.say(friendlyError(lang, failure.key), "error");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failure?.at]);

  return (
    <AuthScreen lang={lang}>
      <Notice message={notice.message} tone={notice.tone} id={notice.id} />

      <header className="auth-top">
        <img className="auth-logo" src="logo.png" alt="" />
        <LangSwitch lang={lang} />
      </header>

      <div className="auth-intro">
        <h1 className="auth-title">{t("shell.app.title")}</h1>
        <p className="auth-sub">{t("shell.boot.subtitle")}</p>
      </div>

      <form
        className="auth-card"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSubmit) return;
          login(loginName.trim(), password);
        }}
      >
        <AuthField
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
        <AuthField
          label={t("shell.boot.password")}
          icon={<LockIcon />}
          testId="boot-password"
          trailing={<PasswordToggle lang={lang} shown={show} onToggle={() => setShow((v) => !v)} />}
          inputProps={{
            value: password,
            onChange: (event) => setPassword(event.target.value),
            type: show ? "text" : "password",
            autoComplete: "current-password",
          }}
        />

        <AuthButton type="submit" variant="primary" disabled={!canSubmit} className="auth-submit" data-testid="boot-enter">
          {t("shell.boot.enter")}
        </AuthButton>
      </form>

      <Divider text={t("shell.auth.or")} />

      <div className="auth-providers">
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

      <p className="auth-foot">
        {t("shell.boot.noacc")}{" "}
        <button type="button" onClick={onRegister} data-testid="boot-to-register" className="auth-link">
          {t("shell.boot.register")}
        </button>
      </p>
    </AuthScreen>
  );
}
