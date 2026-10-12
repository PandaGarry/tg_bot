/**
 * Экран загрузки: знак в кольце прогресса, заголовок и одна подсказка, которая сменяется плавно.
 * Переход дальше — по таймеру LOADING_MS. Анимации — CSS (styles.css), тени нет.
 */

import { useEffect, useRef, useState } from "react";
import type { Locale } from "@tdl/protocol";
import { translator } from "../i18n/index.js";

/** Сколько длится загрузка до входа. */
export const LOADING_MS = 2500;
/** Смена подсказки. */
export const HINT_MS = 1250;
const HINTS = ["shell.loading.hint.1", "shell.loading.hint.2", "shell.loading.hint.3"] as const;

/** Длина окружности кольца в единицах viewBox (r = 46). */
const RING = 2 * Math.PI * 46;

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
    <main className="load-screen" data-lang={lang}>
      <div className="load-mark">
        <svg className="load-ring" viewBox="0 0 100 100" aria-hidden="true">
          <circle className="load-ring-track" cx="50" cy="50" r="46" />
          <circle
            className="load-ring-fill"
            cx="50"
            cy="50"
            r="46"
            strokeDasharray={RING}
            style={{ animationDuration: `${LOADING_MS}ms` }}
          />
        </svg>
        <img className="load-logo" src="emblem.jpg" alt="" />
      </div>

      <h1 className="load-title">{t("shell.loading.title")}</h1>

      <p key={hint} data-testid="loading-hint" className="load-hint">
        {t(HINTS[hint] as string)}
      </p>

    </main>
  );
}
