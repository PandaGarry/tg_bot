/**
 * Вход: язык, логин или почта, пароль. Регистрация — отдельное окно:
 * аккаунт и персонаж заводятся врозь, логин не равен никнейму.
 */

import { useState } from "react";
import type { Locale } from "@tdl/protocol";
import { login } from "../net.js";
import { store } from "../store.js";
import { translator } from "../i18n/index.js";

const MailIcon = () => (
  <svg className="gate-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="3" y="5" width="18" height="14" rx="3" />
    <path d="m4 7 8 6 8-6" />
  </svg>
);

const LockIcon = () => (
  <svg className="gate-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="5" y="10" width="14" height="10" rx="3" />
    <path d="M8 10V7a4 4 0 1 1 8 0v3" />
  </svg>
);

const EyeIcon = ({ off }: { off?: boolean }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18">
    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
    <circle cx="12" cy="12" r="2.6" />
    {off ? <path d="m4 4 16 16" /> : null}
  </svg>
);

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
  const canSubmit = loginName.trim().length >= 3 && password.length >= 8;

  return (
    <main className="gate relative flex min-h-[100dvh] flex-col items-center justify-center gap-5 p-5">
      {/* язык — маленькие пилюли в правом верхнем углу (круг 17) */}
      <div className="gate-lang-wrap">
        {(["ru", "en"] as Locale[]).map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => store.setLang(code)}
            className={`gate-lang ${lang === code ? "gate-lang-on" : ""}`}
          >
            {code === "ru" ? "РУС" : "ENG"}
          </button>
        ))}
      </div>

      {/* авторская эмблема и титул */}
      <img className="gate-brand" src="emblem.jpg" alt="" />
      <h1 className="gate-title text-center text-2xl tracking-wide">{t("shell.app.title")}</h1>
      <p className="gate-sub -mt-3 text-center text-sm">{t("shell.boot.subtitle")}</p>

      <form
        className="gate-card flex w-full max-w-sm flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSubmit) return;
          login(loginName.trim(), password);
        }}
      >
        <label className="gate-field">
          <span className="gate-label">{t("shell.boot.login")}</span>
          <span className="gate-box">
            <MailIcon />
            <input
              value={loginName}
              onChange={(event) => setLoginName(event.target.value)}
              autoComplete="username"
              className="gate-input"
            />
          </span>
        </label>
        <label className="gate-field">
          <span className="gate-label">{t("shell.boot.password")}</span>
          <span className="gate-box">
            <LockIcon />
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type={show ? "text" : "password"}
              autoComplete="current-password"
              className="gate-input gate-input-pin"
            />
            <button type="button" className="gate-eye" onClick={() => setShow((v) => !v)} aria-label="показать пароль">
              <EyeIcon off={show} />
            </button>
          </span>
        </label>
        <button
          type="submit"
          disabled={!canSubmit}
          className="gate-primary min-h-[44px] rounded disabled:opacity-40"
        >
          {t("shell.boot.enter")}
        </button>
        <button
          type="button"
          onClick={onRegister}
          data-testid="boot-to-register"
          className="gate-secondary min-h-[44px] rounded"
        >
          {t("shell.boot.register")}
        </button>
      </form>

      <p className="gate-foot text-sm">
        {t("shell.boot.noacc")}{" "}
        <button type="button" onClick={onRegister} className="gate-link font-semibold">
          {t("shell.boot.register")}
        </button>
      </p>

      <p className="gate-note text-xs">{t(status)}</p>
    </main>
  );
}
