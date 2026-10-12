/**
 * Вход: логин или почта и пароль; Google ID и Яндекс ID — кнопки (подключаются после ключей заказчика).
 * Регистрация — отдельное окно: аккаунт и персонаж заводятся врозь.
 */

import { useState } from "react";
import type { Locale } from "@tdl/protocol";
import { login } from "../net.js";
import { translator } from "../i18n/index.js";
import {
  AuthButton,
  AuthField,
  AuthScreen,
  Divider,
  GoogleMark,
  LangSwitch,
  LockIcon,
  MailIcon,
  PasswordToggle,
  ProviderButton,
  YandexMark,
  useProviderNote,
} from "./kit/Auth.js";

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
  const providers = useProviderNote(lang);
  const canSubmit = loginName.trim().length >= 3 && password.length >= 8;

  return (
    <AuthScreen lang={lang}>
      <div className="auth-top">
        <LangSwitch lang={lang} />
      </div>

      <header className="auth-head">
        <img className="auth-emblem" src="emblem.jpg" alt="" />
        <h1 className="auth-title">{t("shell.app.title")}</h1>
        <p className="auth-sub">{t("shell.boot.subtitle")}</p>
      </header>

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
          icon={<MailIcon />}
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

        <AuthButton type="submit" disabled={!canSubmit} className="auth-submit">
          {t("shell.boot.enter")}
        </AuthButton>
      </form>

      <Divider text={t("shell.auth.or")} />

      <div className="auth-providers">
        <ProviderButton
          label={t("shell.auth.provider.google")}
          mark={<GoogleMark />}
          testId="boot-google"
          onClick={() => providers.ask("Google ID")}
        />
        <ProviderButton
          label={t("shell.auth.provider.yandex")}
          mark={<YandexMark />}
          testId="boot-yandex"
          onClick={() => providers.ask("Яндекс ID")}
        />
      </div>

      {providers.note ? (
        <p className="auth-note" role="status" data-testid="boot-provider-note">
          {providers.note}
        </p>
      ) : null}

      <p className="auth-foot">
        {t("shell.boot.noacc")}{" "}
        <button type="button" onClick={onRegister} data-testid="boot-to-register" className="auth-link">
          {t("shell.boot.register")}
        </button>
      </p>

      <p className="auth-note" role="status">
        {t(status)}
      </p>
    </AuthScreen>
  );
}
