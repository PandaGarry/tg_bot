/**
 * Вступление: восемь кадров, крупный короткий текст, игровых кнопок нет.
 * Кадры — своя простая графика на палитре двора; лист вида утверждается
 * отдельно, менять придётся только картинки, не текст и не порядок.
 * Слайды крутятся один раз на устройстве, пропуск есть со второго кадра.
 */

import { useState } from "react";
import type { Locale } from "@tdl/protocol";
import { translator } from "../i18n/index.js";
import { store } from "../store.js";
import { INTRO_KEYS, writeIntro } from "../shell/chronicle.js";
import { markIntroSeen } from "../shell/firstRun.js";

const SCENES = [
  "villages",
  "stone",
  "mycelium",
  "spores",
  "torches",
  "eyes",
  "hunt",
  "court",
] as const;

export type SceneId = (typeof SCENES)[number];

export function Slides({ lang, onDone }: { lang: Locale; onDone: () => void }) {
  const t = translator(lang);
  const [index, setIndex] = useState(0);
  const last = index === INTRO_KEYS.length - 1;

  const finish = () => {
    writeIntro();
    markIntroSeen();
    onDone();
  };

  return (
    <main className="mx-auto flex h-[100dvh] w-full max-w-3xl flex-col">
      <header className="flex items-center justify-between px-3 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
        <div className="flex gap-1">
          {(["ru", "en"] as Locale[]).map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => store.setLang(code)}
              className={`rounded border px-2 py-1 text-xs ${
                lang === code ? "border-bone text-bone" : "border-stone-700 text-stone-500"
              }`}
            >
              {code.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-stone-500">
            {t("shell.slides.of", { index: index + 1, total: INTRO_KEYS.length })}
          </span>
          {/* Пропуск есть со второго слайда: первый кадр не пропускается. */}
          {index >= 1 ? (
            <button type="button" onClick={finish} className="px-2 py-1 text-xs text-stone-400">
              {t("shell.slides.skip")}
            </button>
          ) : null}
        </div>
      </header>

      <section className="min-h-0 flex-1 px-3 py-2">
        <Scene id={SCENES[index] as SceneId} />
      </section>

      <footer className="flex flex-col gap-3 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <p data-testid="slide-text" className="text-xl leading-snug text-bone sm:text-2xl">
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
          <button
            type="button"
            onClick={() => (last ? finish() : setIndex(index + 1))}
            className="min-h-[44px] rounded border border-stone-600 bg-stone-800 px-6 text-bone"
          >
            {last ? t("shell.slides.begin") : t("shell.slides.next")}
          </button>
        </div>
      </footer>
    </main>
  );
}

const BONE = "#d8d2c4";
const MOSS = "#6b7a4a";
const ASH = "#7d7a74";
const IRON = "#4a4f55";
const WHEAT = "#b08b4f";
const NIGHT = "#2b2f3a";
const RUST = "#8a4b2a";

function Scene({ id }: { id: SceneId }) {
  return (
    <svg viewBox="0 0 320 180" role="img" aria-hidden="true" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
      <rect width="320" height="180" fill="#0c0a09" />
      {scenes[id]}
    </svg>
  );
}

/** Восемь кадров вступления: простая графика, узнаваемая по одной строке текста. */
const scenes: Record<SceneId, React.ReactNode> = {
  villages: (
    <>
      <rect y="120" width="320" height="60" fill={NIGHT} />
      <rect y="128" width="320" height="3" fill={MOSS} opacity="0.5" />
      <rect y="136" width="320" height="3" fill={MOSS} opacity="0.35" />
      <rect y="144" width="320" height="3" fill={MOSS} opacity="0.25" />
      {[40, 104, 210].map((x) => (
        <g key={x}>
          <rect x={x} y="96" width="40" height="24" fill={IRON} />
          <path d={`M${x - 4} 96 L${x + 20} 78 L${x + 44} 96 Z`} fill={RUST} />
        </g>
      ))}
      <rect y="118" width="320" height="4" fill={WHEAT} opacity="0.4" />
    </>
  ),
  stone: (
    <>
      <rect y="118" width="320" height="62" fill={IRON} />
      <rect y="100" width="320" height="18" fill={ASH} opacity="0.25" />
      <rect y="86" width="320" height="14" fill={ASH} opacity="0.18" />
      <ellipse cx="160" cy="120" rx="44" ry="20" fill="#0b0b0d" />
      <ellipse cx="160" cy="114" rx="30" ry="10" fill={NIGHT} />
      <rect y="140" width="320" height="2" fill={ASH} opacity="0.3" />
    </>
  ),
  mycelium: (
    <>
      <rect y="40" width="320" height="40" fill={IRON} opacity="0.6" />
      <rect y="80" width="320" height="100" fill="#1a1512" />
      <path d="M20 120 C70 100 110 150 160 128 C210 108 260 150 300 124" stroke={BONE} strokeWidth="1.5" fill="none" opacity="0.7" />
      <path d="M40 150 C90 130 130 170 180 148 C230 126 270 160 300 146" stroke={BONE} strokeWidth="1" fill="none" opacity="0.5" />
      {[
        [64, 96],
        [120, 86],
        [188, 92],
        [246, 84],
        [286, 100],
        [96, 60],
        [160, 52],
        [228, 58],
      ].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.6" fill={BONE} opacity="0.55" />
      ))}
    </>
  ),
  spores: (
    <>
      <rect y="130" width="320" height="50" fill={NIGHT} />
      {[30, 70, 110, 150, 190, 230, 270].map((x) => (
        <g key={x}>
          <circle cx={x} cy="104" r="6" fill={BONE} opacity="0.85" />
          <rect x={x - 4} y="110" width="8" height="20" fill={BONE} opacity="0.7" />
        </g>
      ))}
      {[
        [50, 60],
        [100, 44],
        [150, 66],
        [200, 50],
        [250, 62],
      ].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.5" fill={MOSS} opacity="0.6" />
      ))}
    </>
  ),
  torches: (
    <>
      <rect width="320" height="180" fill="#080809" />
      <ellipse cx="160" cy="150" rx="120" ry="16" fill="#151013" />
      {([
        [120, 60],
        [160, 84],
        [200, 66],
      ] as const).map(([x, y], i) => (
        <g key={`${x}-${y}`}>
          <rect x={x - 1} y={y} width="2" height="26" fill={ASH} />
          <circle cx={x} cy={y - 4} r="4" fill={WHEAT} opacity={0.85 - i * 0.15} />
        </g>
      ))}
      <path d="M40 150 Q160 120 280 150" stroke={ASH} strokeWidth="2" fill="none" opacity="0.4" />
    </>
  ),
  eyes: (
    <>
      <rect y="140" width="320" height="40" fill={NIGHT} />
      <g>
        <circle cx="120" cy="98" r="8" fill={BONE} opacity="0.9" />
        <rect x="114" y="106" width="12" height="34" fill={BONE} opacity="0.75" />
        <circle cx="200" cy="98" r="8" fill={BONE} opacity="0.9" />
        <rect x="194" y="106" width="12" height="34" fill={BONE} opacity="0.75" />
      </g>
      <path d="M128 98 L192 98" stroke={BONE} strokeWidth="0.5" opacity="0.35" strokeDasharray="2 4" />
    </>
  ),
  hunt: (
    <>
      <rect y="128" width="320" height="52" fill={NIGHT} />
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x={12 + i * 25} y="96" width="4" height="34" fill={RUST} opacity="0.8" />
      ))}
      <rect y="88" width="320" height="8" fill={IRON} />
      <g>
        <path d="M150 46 L162 30 L174 46 Z" fill={WHEAT} opacity="0.8" />
        <rect x="158" y="46" width="4" height="10" fill={ASH} />
      </g>
      {[40, 240, 280].map((x) => (
        <g key={x}>
          <circle cx={x} cy="80" r="5" fill={BONE} opacity="0.8" />
          <rect x={x - 3} y="86" width="6" height="20" fill={BONE} opacity="0.65" />
        </g>
      ))}
    </>
  ),
  court: (
    <>
      <rect y="132" width="320" height="48" fill="#151114" />
      <rect x="24" y="86" width="272" height="46" fill={IRON} opacity="0.55" />
      <rect x="24" y="86" width="272" height="6" fill={ASH} opacity="0.45" />
      <path d="M24 86 L40 74 L56 86 L72 74 L88 86 L104 74 L120 86 L136 74 L152 86 L168 74 L184 86 L200 74 L216 86 L232 74 L248 86 L264 74 L280 86 L296 74" stroke={RUST} strokeWidth="2" fill="none" opacity="0.7" />
      <rect x="156" y="52" width="2" height="34" fill={ASH} />
      <rect x="96" y="108" width="30" height="24" fill={NIGHT} />
      <rect x="200" y="102" width="36" height="30" fill={NIGHT} />
    </>
  ),
};
