/**
 * Превью первого запуска: 10 кадров, озвучка по языку интерфейса.
 * Переход к следующему кадру — через 2 секунды после окончания озвучки.
 * «Далее» ускоряет, «Пропустить» — со второго кадра. Крутится один раз на устройстве.
 * Если звук не запускается (политика браузера или нет файла), кадр держится
 * фиксированное время — текст всё равно успевает прочитаться.
 */

import { useEffect, useRef, useState } from "react";
import type { Locale } from "@tdl/protocol";
import { translator } from "../i18n/index.js";
import { store } from "../store.js";
import { INTRO_KEYS, writeIntro } from "../shell/chronicle.js";
import { markIntroSeen } from "../shell/firstRun.js";

/** Пауза после окончания озвучки до перехода (решено 12.10). */
export const PAUSE_AFTER_VOICE_MS = 2000;
/** Время кадра без звука: если озвучка не запустилась. */
export const SILENT_HOLD_MS = 6000;

const LAST = INTRO_KEYS.length - 1;

function pad(index: number): string {
  return String(index + 1).padStart(2, "0");
}

export function previewAudioSrc(lang: Locale, index: number): string {
  return `/audio/preview/${lang}/frame-${pad(index)}.mp3`;
}

export function previewSceneSrc(index: number): string {
  return `/preview/scenes/scene-${pad(index)}.jpg`;
}

export function Preview({ lang, onDone }: { lang: Locale; onDone: () => void }) {
  const t = translator(lang);
  const [index, setIndex] = useState(0);
  // Кадр, для которого картинка не загрузилась: тогда показываем тёмный фон.
  const [brokenScene, setBrokenScene] = useState<number | null>(null);
  const last = index === LAST;

  // Актуальный обработчик завершения: effect не должен пересоздаваться из-за родителя.
  const finishRef = useRef(onDone);
  finishRef.current = onDone;

  const finish = () => {
    writeIntro();
    markIntroSeen();
    finishRef.current();
  };

  const goNext = () => {
    if (index === LAST) finish();
    else setIndex((current) => current + 1);
  };

  // Озвучка текущего кадра и таймер перехода. При смене кадра или языка всё сбрасывается.
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const moveOn = () => {
      if (!active) return;
      if (index === LAST) {
        writeIntro();
        markIntroSeen();
        finishRef.current();
      } else {
        setIndex((current) => current + 1);
      }
    };
    const holdSilently = () => {
      if (!active) return;
      timer = setTimeout(moveOn, SILENT_HOLD_MS);
    };

    const audio = new Audio(previewAudioSrc(lang, index));
    audio.addEventListener("ended", () => {
      if (!active) return;
      timer = setTimeout(moveOn, PAUSE_AFTER_VOICE_MS);
    });
    audio.addEventListener("error", holdSilently);
    const started = audio.play();
    if (started && typeof started.catch === "function") started.catch(holdSilently);

    return () => {
      active = false;
      if (timer !== undefined) clearTimeout(timer);
      audio.pause();
    };
  }, [index, lang]);

  return (
    <main className="gate relative mx-auto flex h-[100dvh] w-full max-w-3xl flex-col overflow-hidden bg-[#0c0a09]">
      <header className="relative z-10 flex items-center justify-end gap-2 px-3 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
        {/* язык — маленькие пилюли справа, как в окнах входа (круг 17) */}
        <div className="gate-lang-wrap" data-static>
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
        <span className="gate-note text-xs">{t("shell.slides.of", { index: index + 1, total: INTRO_KEYS.length })}</span>
        {/* Пропуск есть со второго кадра: первый кадр не пропускается. */}
        {index >= 1 ? (
          <button type="button" onClick={finish} className="gate-link px-1 text-xs">
            {t("shell.slides.skip")}
          </button>
        ) : null}
      </header>

      <section className="relative min-h-0 flex-1">
        {brokenScene === index ? null : (
          <img
            key={index}
            src={previewSceneSrc(index)}
            alt=""
            aria-hidden="true"
            className="preview-scene absolute inset-0 h-full w-full object-cover"
            onError={() => setBrokenScene(index)}
          />
        )}
        {/* Затемнение снизу под текст: градиент, без теней. */}
        <div className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-[#0c0a09] via-[#0c0a09]/80 to-transparent" />
      </section>

      <footer className="relative z-10 flex flex-col gap-4 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <p data-testid="preview-text" className="preview-serif text-2xl leading-snug text-bone sm:text-3xl">
          {t(INTRO_KEYS[index] as string)}
        </p>
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1">
            {INTRO_KEYS.map((key, dot) => (
              <span
                key={key}
                className={`h-1 w-4 rounded ${dot === index ? "bg-bone" : "bg-stone-800"}`}
                aria-hidden="true"
              />
            ))}
          </div>
          <button type="button" onClick={goNext} className="gate-primary min-h-[44px] rounded px-6">
            {last ? t("shell.preview.begin") : t("shell.slides.next")}
          </button>
        </div>
      </footer>
    </main>
  );
}
