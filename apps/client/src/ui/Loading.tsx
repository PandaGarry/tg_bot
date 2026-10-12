/**
 * Экран загрузки: показывается после превью и при повторном входе на устройство.
 * Анимации — CSS-keyframes из styles.css. Подсказки сменяются сами; переход дальше — по таймеру.
 */

import { useEffect, useRef, useState } from "react";
import type { Locale } from "@tdl/protocol";
import { translator } from "../i18n/index.js";

/** Сколько длится загрузка до входа. */
export const LOADING_MS = 2500;
/** Смена подсказки. */
export const HINT_MS = 1250;
const HINTS = ["shell.loading.hint.1", "shell.loading.hint.2", "shell.loading.hint.3"] as const;

export function Loading({ lang, onDone }: { lang: Locale; onDone: () => void }) {
  const t = translator(lang);
  const [hint, setHint] = useState(0);

  // Актуальный обработчик: родитель перерисовывается при обновлении состояния, таймер не должен сбрасываться.
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const hintTimer = setInterval(() => setHint((current) => (current + 1) % HINTS.length), HINT_MS);
    const doneTimer = setTimeout(() => doneRef.current(), LOADING_MS);
    return () => {
      clearInterval(hintTimer);
      clearTimeout(doneTimer);
    };
  }, []);

  return (
    <main className="gate relative flex min-h-[100dvh] flex-col items-center justify-center gap-8 bg-[#0c0a09] p-6">
      <div className="loader-ring relative h-24 w-24" aria-hidden="true">
        <span className="loader-ring-arc absolute inset-0 rounded-full border-2 border-transparent border-t-bone" />
        <span className="loader-ring-arc loader-ring-arc-slow absolute inset-3 rounded-full border-2 border-transparent border-b-stone-500" />
        <span className="loader-pulse absolute inset-[38%] rounded-full bg-bone" />
      </div>

      <h1 className="preview-serif text-2xl text-bone">{t("shell.loading.title")}</h1>

      <div className="h-1 w-full max-w-xs overflow-hidden rounded bg-stone-800" role="progressbar" aria-label={t("shell.loading.title")}>
        <div className="loader-bar h-full bg-bone" style={{ animationDuration: `${LOADING_MS}ms` }} />
      </div>

      <p key={hint} data-testid="loading-hint" className="loader-hint preview-serif min-h-[3.5rem] max-w-md text-center text-lg text-stone-400">
        {t(HINTS[hint] as string)}
      </p>
    </main>
  );
}
