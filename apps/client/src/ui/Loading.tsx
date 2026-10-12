/**
 * Экран загрузки: оверлей поверх уже нарисованного входа или двора.
 * Без картинок: заголовок, сегментированный прогресс и подсказка, которая сменяется плавно.
 * По LOADING_MS плавно уходит (LEAVE_MS) и отдаёт экран. Анимации — CSS, тени нет.
 */

import { useEffect, useRef, useState } from "react";
import type { Locale } from "@tdl/protocol";
import { translator } from "../i18n/index.js";

/** Сколько длится загрузка до ухода. */
export const LOADING_MS = 2500;
/** Длительность затухания при уходе. */
export const LEAVE_MS = 350;
/** Смена подсказки. */
export const HINT_MS = 1250;
const HINTS = ["shell.loading.hint.1", "shell.loading.hint.2", "shell.loading.hint.3"] as const;
const SEGMENTS = 5;

export function Loading({ lang, onDone }: { lang: Locale; onDone: () => void }) {
  const t = translator(lang);
  const [hint, setHint] = useState(0);
  const [leaving, setLeaving] = useState(false);

  // Актуальный обработчик: родитель перерисовывается, таймер не должен сбрасываться.
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const hintTimer = setInterval(() => setHint((current) => (current + 1) % HINTS.length), HINT_MS);
    const leaveTimer = setTimeout(() => setLeaving(true), LOADING_MS);
    const doneTimer = setTimeout(() => doneRef.current(), LOADING_MS + LEAVE_MS);
    return () => {
      clearInterval(hintTimer);
      clearTimeout(leaveTimer);
      clearTimeout(doneTimer);
    };
  }, []);

  return (
    <main className={`load-screen ${leaving ? "load-leave" : ""}`} data-lang={lang} aria-busy={!leaving}>
      <div className="load-glow" aria-hidden="true" />

      <div className="load-body">
        <h1 className="load-title">{t("shell.loading.title")}</h1>

        <div className="load-segments" role="progressbar" aria-label={t("shell.loading.title")} aria-valuemin={0} aria-valuemax={100}>
          {Array.from({ length: SEGMENTS }, (_, index) => (
            <span
              key={index}
              className="load-seg"
              style={{
                ["--seg-delay" as string]: `${(index * LOADING_MS) / SEGMENTS}ms`,
                ["--seg-duration" as string]: `${LOADING_MS / SEGMENTS}ms`,
              }}
            />
          ))}
        </div>

        <p key={hint} data-testid="loading-hint" className="load-hint">
          {t(HINTS[hint] as string)}
        </p>
      </div>
    </main>
  );
}
