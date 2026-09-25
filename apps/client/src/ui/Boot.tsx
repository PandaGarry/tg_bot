/** Вход: язык, имя входа, пароль. Регистрация выключается флагом ворот. */

import { useState } from "react";
import type { Locale } from "@tdl/protocol";
import { login, register } from "../net.js";
import { store } from "../store.js";
import { translator } from "../i18n/index.js";

export function Boot({ lang, statusKey: status }: { lang: Locale; statusKey: string }) {
  const t = translator(lang);
  const [loginName, setLoginName] = useState("");
  const [password, setPassword] = useState("");
  const canSubmit = loginName.trim().length >= 3 && password.length >= 8;

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-center text-2xl tracking-wide text-bone">{t("shell.app.title")}</h1>

      <div className="flex gap-2">
        {(["ru", "en"] as Locale[]).map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => store.setLang(code)}
            className={`min-h-[44px] rounded border px-4 text-sm ${
              lang === code ? "border-bone text-bone" : "border-stone-700 text-stone-400"
            }`}
          >
            {code === "ru" ? "Русский" : "English"}
          </button>
        ))}
      </div>

      <form
        className="flex w-full max-w-sm flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSubmit) return;
          login(loginName.trim(), password);
        }}
      >
        <label className="flex flex-col gap-1 text-sm text-stone-400">
          {t("shell.boot.login")}
          <input
            value={loginName}
            onChange={(event) => setLoginName(event.target.value)}
            autoComplete="username"
            className="min-h-[44px] rounded border border-stone-700 bg-stone-900 px-3 text-bone outline-none focus:border-stone-500"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-stone-400">
          {t("shell.boot.password")}
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete="current-password"
            className="min-h-[44px] rounded border border-stone-700 bg-stone-900 px-3 text-bone outline-none focus:border-stone-500"
          />
        </label>
        <button
          type="submit"
          disabled={!canSubmit}
          className="min-h-[44px] rounded border border-stone-600 bg-stone-800 text-bone disabled:opacity-40"
        >
          {t("shell.boot.enter")}
        </button>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => register(loginName.trim(), password)}
          className="min-h-[44px] rounded border border-stone-700 text-stone-300 disabled:opacity-40"
        >
          {t("shell.boot.register")}
        </button>
      </form>

      <p className="text-xs text-stone-500">{t(status)}</p>
    </main>
  );
}
