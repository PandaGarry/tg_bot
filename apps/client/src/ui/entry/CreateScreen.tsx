/**
 * Создание лорда: мастер из четырёх шагов — имя, портрет, знамя, тип.
 * Сверху всегда видна карточка лорда (портрет, имя, знамя, тип). Каждый шаг помещается без прокрутки.
 * Отправка — только с последнего шага через createLord; слот `creation.steps` сохранён.
 */

import { useEffect, useState } from "react";
import type { Locale, SlotId, WorldViewBase } from "@tdl/protocol";
import { createLord } from "../../net.js";
import { translator } from "../../i18n/index.js";
import { Slot, hasSlot } from "../../slots.js";
import { friendlyError, useFreshError } from "../../shell/errors.js";
import { EntryFrame, ScreenTitle } from "./Frame.js";
import { PrimaryButton, TextButton } from "./controls.js";
import { useNotice } from "./Notice.js";
import { COLORS, NAME_MAX, NAME_MIN, PORTRAITS, SIGNS, TYPES, portraitSrc, swatch, type LordType } from "./lord.js";

const STEPS = 4;
const STEP_TITLE = ["shell.create.name", "shell.create.portrait", "shell.create.banner", "shell.create.type"] as const;

export function CreateScreen({
  lang,
  view,
  serverNow,
}: {
  lang: Locale;
  view: WorldViewBase | null;
  serverNow: number;
}) {
  const t = translator(lang);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [portrait, setPortrait] = useState<string>(PORTRAITS[0] as string);
  const [sign, setSign] = useState<string>(SIGNS[0]);
  const [color, setColor] = useState<string>(COLORS[0]);
  const [type, setType] = useState<LordType>("flesh");
  const [sending, setSending] = useState(false);
  const notice = useNotice();
  const trimmed = name.trim();
  const nameOk = trimmed.length >= NAME_MIN && trimmed.length <= NAME_MAX;

  // Отказ ядра (имя занято, имя не подходит) — спокойной фразой; старый отказ не всплывает.
  const failure = useFreshError();
  useEffect(() => {
    if (failure) {
      setSending(false);
      notice.say(friendlyError(lang, failure.key), "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failure?.at]);

  const worldView: WorldViewBase = view ?? {
    world: { id: "world-1", name: "", size: 0, zones: 0, zonePit: 0, zoneCapital: 0, now: serverNow, downtimeMs: 0 },
    me: null,
    stock: {},
    modules: {},
  };

  const last = step === STEPS - 1;
  const canNext = step === 0 ? nameOk : true;

  const next = () => {
    if (!canNext || sending) return;
    if (!last) {
      setStep((current) => current + 1);
      return;
    }
    if (!nameOk) return;
    setSending(true);
    createLord({ name: trimmed, portrait, bannerSign: sign, bannerColor: color, type });
  };

  const hint = step === 0 && !name ? t("shell.create.empty") : step === 0 && !nameOk ? t("shell.create.name.hint") : "";

  return (
    <EntryFrame
      lang={lang}
      notice={notice}
      start={
        step > 0 ? <TextButton onClick={() => setStep((current) => current - 1)}>← {t("shell.create.back")}</TextButton> : null
      }
      footer={
        <>
          <p role="status" className="min-h-4 text-center text-[12px] leading-4 text-stone-400">
            {hint}
          </p>
          <PrimaryButton type="button" onClick={next} disabled={!canNext || sending} data-testid="create-next">
            {last ? (sending ? "…" : t("shell.create.take")) : t("shell.create.next")}
          </PrimaryButton>
        </>
      }
    >
      <Slot
        slot={"creation.steps" as SlotId}
        view={worldView}
        lang={lang}
        serverNow={serverNow}
        empty={hasSlot("creation.steps" as SlotId) ? null : undefined}
      />

      <LordCard lang={lang} name={trimmed} portrait={portrait} sign={sign} color={color} type={type} />

      <section className="flex flex-col gap-3" data-step={step + 1}>
        <div className="flex flex-col gap-2">
          <div className="flex gap-1.5" aria-hidden="true">
            {Array.from({ length: STEPS }, (_, index) => (
              <span key={index} className={`h-1 flex-1 rounded-full ${index <= step ? "bg-stone-200" : "bg-stone-800"}`} />
            ))}
          </div>
          <p className="text-[12px] leading-4 text-stone-500">{t("shell.create.step", { index: step + 1, total: STEPS })}</p>
          <ScreenTitle title={t(STEP_TITLE[step] as string)} />
        </div>

        {step === 0 ? (
          <div className="relative">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") next();
              }}
              maxLength={NAME_MAX}
              aria-label={t("shell.create.name")}
              placeholder={t("shell.create.name")}
              autoComplete="off"
              autoCorrect="off"
              data-testid="create-name"
              className={`h-11 w-full rounded-xl border bg-stone-900/70 pr-14 pl-3 text-[16px] text-stone-100 outline-none placeholder:text-stone-600 focus:border-stone-300 [@media(max-height:599px)]:h-10 ${
                name && !nameOk ? "border-rose-300/60" : "border-stone-700"
              }`}
            />
            <span
              className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[12px] text-stone-500 tabular-nums"
              aria-hidden="true"
            >
              {trimmed.length}/{NAME_MAX}
            </span>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label={t("shell.create.portrait")}>
            {PORTRAITS.map((item, index) => (
              <button
                key={item}
                type="button"
                role="radio"
                aria-checked={portrait === item}
                aria-label={`${index + 1}`}
                onClick={() => setPortrait(item)}
                className={`aspect-square overflow-hidden rounded-xl border-2 transition-colors ${
                  portrait === item ? "border-bone" : "border-transparent hover:border-stone-600"
                }`}
              >
                <img src={portraitSrc(item)} alt="" decoding="async" className="size-full object-cover object-top" />
              </button>
            ))}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-[12px] text-stone-400">{t("shell.create.sign.label")}</span>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t("shell.create.sign.label")}>
                {SIGNS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    role="radio"
                    aria-checked={sign === item}
                    onClick={() => setSign(item)}
                    className={`h-9 rounded-xl border text-[13px] transition-colors ${
                      sign === item
                        ? "border-bone bg-stone-800 text-stone-100"
                        : "border-stone-700 bg-stone-900/60 text-stone-300 hover:border-stone-500"
                    }`}
                  >
                    {t(`shell.sign.${item}`)}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[12px] text-stone-400">{t("shell.create.color.label")}</span>
              <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label={t("shell.create.color.label")}>
                {COLORS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    role="radio"
                    aria-checked={color === item}
                    aria-label={t(`shell.color.${item}`)}
                    title={t(`shell.color.${item}`)}
                    onClick={() => setColor(item)}
                    className={`h-9 rounded-xl border-2 transition-colors ${
                      color === item ? "border-bone" : "border-transparent hover:border-stone-600"
                    }`}
                    style={{ background: swatch(item) }}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="flex flex-col gap-2" role="radiogroup" aria-label={t("shell.create.type")}>
            {TYPES.map((item) => (
              <button
                key={item}
                type="button"
                role="radio"
                aria-checked={type === item}
                onClick={() => setType(item)}
                className={`flex flex-col gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                  type === item ? "border-bone bg-stone-800/70" : "border-stone-700 bg-stone-900/60 hover:border-stone-500"
                }`}
              >
                <span className="flex items-baseline gap-2">
                  <span className="text-[14px] font-semibold text-stone-100">{t(`shell.type.${item}`)}</span>
                  <span className="text-[12px] text-stone-400">{t(`shell.type.${item}.card`)}</span>
                </span>
                <span className="text-[12px] leading-snug text-stone-400">{t(`shell.type.${item}.bonus`)}</span>
              </button>
            ))}
          </div>
        ) : null}
      </section>
    </EntryFrame>
  );
}

/** Карточка лорда сверху: портрет, имя, знамя и тип. Видна на каждом шаге. */
function LordCard({
  lang,
  name,
  portrait,
  sign,
  color,
  type,
}: {
  lang: Locale;
  name: string;
  portrait: string;
  sign: string;
  color: string;
  type: string;
}) {
  const t = translator(lang);
  return (
    <aside aria-label={t("shell.create.summary")} className="flex items-center gap-3 rounded-2xl border border-stone-800 bg-stone-900/60 p-2">
      <img src={portraitSrc(portrait)} alt="" className="size-12 shrink-0 rounded-xl object-cover object-top" />
      <div className="flex min-w-0 flex-col gap-1">
        <span className="truncate text-[15px] font-semibold text-stone-100">{name || "—"}</span>
        <span className="flex items-center gap-2 text-[12px] text-stone-400">
          <span className="rounded-md px-1.5 py-0.5 text-[11px] text-stone-950" style={{ background: swatch(color) }}>
            {t(`shell.sign.${sign}`)}
          </span>
          <span className="truncate">{t(`shell.type.${type}`)}</span>
        </span>
      </div>
    </aside>
  );
}
