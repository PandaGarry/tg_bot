/**
 * Создание лорда — один экран, без мастера из шагов (решено 14.10, вариант A «Forge»).
 * Сверху — компактная карточка лорда; ниже имя, портрет (10 в сетке 5 × 2), знамя (знак и цвет), тип.
 * Кнопка «Занять двор» внизу. Отправка — через createLord; протокол не меняется.
 */

import { useEffect, useState } from "react";
import type { Locale, WorldViewBase } from "@tdl/protocol";
import { createLord } from "../../net.js";
import { translator } from "../../i18n/index.js";
import { friendlyError, useFreshError } from "../../shell/errors.js";
import { EntryFrame, ScreenTitle } from "./Frame.js";
import { PrimaryButton } from "./controls.js";
import { useNotice } from "./Notice.js";
import { COLORS, NAME_MAX, NAME_MIN, PORTRAITS, SIGNS, TYPES, portraitSrc, swatch, type LordType } from "./lord.js";

export function CreateScreen({ lang, view, serverNow }: { lang: Locale; view: WorldViewBase | null; serverNow: number }) {
  const t = translator(lang);
  const [name, setName] = useState("");
  const [portrait, setPortrait] = useState<string>(PORTRAITS[0] as string);
  const [sign, setSign] = useState<string>(SIGNS[0]);
  const [color, setColor] = useState<string>(COLORS[0]);
  const [type, setType] = useState<LordType>("flesh");
  const [sending, setSending] = useState(false);
  const [touched, setTouched] = useState(false);
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

  // Ошибка имени — после ухода с поля; подсказка до этого.
  const nameError = touched && trimmed.length > 0 && !nameOk ? t("shell.create.name.hint") : undefined;
  const nameHint = !nameError ? t("shell.create.name.hint") : undefined;

  const submit = () => {
    setTouched(true);
    if (!nameOk || sending) return;
    setSending(true);
    createLord({ name: trimmed, portrait, bannerSign: sign, bannerColor: color, type });
  };

  return (
    <EntryFrame
      lang={lang}
      notice={notice}
      footer={
        <>
          <p role="status" className="min-h-4 text-center text-[12px] leading-4 text-mute">
            {!trimmed ? t("shell.create.empty") : ""}
          </p>
          <PrimaryButton type="button" onClick={submit} disabled={!nameOk || sending} data-testid="create-take">
            {sending ? "…" : t("shell.create.take")}
          </PrimaryButton>
        </>
      }
    >
      <div className="flex flex-col gap-3 [@media(max-height:640px)]:gap-2 [@media(max-height:599px)]:!gap-1.5">
        <ScreenTitle title={t("shell.create.title")} />

        {/* Карточка лорда: видна всегда, обновляется по мере ввода. */}
        <aside aria-label={t("shell.create.summary")} className="flex items-center gap-3 rounded-lg border border-line bg-ink-2 p-2 [@media(max-height:640px)]:p-1.5 [@media(max-height:599px)]:!p-1">
          <img src={portraitSrc(portrait)} alt="" className="size-10 shrink-0 [@media(max-height:599px)]:size-9 rounded-md object-cover object-top" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-[15px] font-semibold text-parch">{trimmed || "—"}</span>
            <span className="flex items-center gap-2 text-[12px] text-mute">
              <span className="h-3 w-3 rounded-sm" style={{ background: swatch(color) }} aria-hidden="true" />
              <span className="truncate">{t(`shell.sign.${sign}`)}</span>
              <span className="truncate">· {t(`shell.type.${type}`)}</span>
            </span>
          </div>
        </aside>

        <div className="flex flex-col">
          <label htmlFor="create-name" className="mb-1 text-[12px] leading-4 text-mute">
            {t("shell.create.name")}
          </label>
          <input
            id="create-name"
            data-testid="create-name"
            aria-label={t("shell.create.name")}
            aria-invalid={Boolean(nameError) || undefined}
            className={`h-11 w-full rounded-lg border bg-ink-2 px-3 text-[16px] text-parch outline-none placeholder:text-mute/60 focus:border-parch/80 [@media(max-height:640px)]:h-10 [@media(max-height:599px)]:h-9 ${
              nameError ? "border-rose-300/70" : "border-line"
            }`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => setTouched(true)}
            maxLength={NAME_MAX + 4}
            autoComplete="off"
          />
          <span className={`mt-1 min-h-4 text-[11.5px] leading-4 ${nameError ? "text-rose-200" : "text-mute [@media(max-height:639px)]:hidden"}`}>
            {nameError ?? nameHint}
          </span>
        </div>

        <div className="flex flex-col gap-1.5 [@media(max-height:640px)]:gap-1">
          <span className="text-[12px] leading-4 text-mute">{t("shell.create.portrait")}</span>
          <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label={t("shell.create.portrait")}>
            {PORTRAITS.map((item, index) => (
              <button
                key={item}
                type="button"
                role="radio"
                aria-checked={portrait === item}
                aria-label={`${index + 1}`}
                onClick={() => setPortrait(item)}
                className={`aspect-square [@media(max-height:640px)]:aspect-auto [@media(max-height:640px)]:h-10 [@media(max-height:599px)]:h-9 overflow-hidden rounded-md border-2 transition-colors ${
                  portrait === item ? "border-rust" : "border-transparent hover:border-line"
                }`}
              >
                <img src={portraitSrc(item)} alt="" className="size-full object-cover object-top" />
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5 [@media(max-height:640px)]:gap-1">
          <span className="text-[12px] leading-4 text-mute">{t("shell.create.banner")}</span>
          <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label={t("shell.create.sign.label")}>
            {SIGNS.map((item) => (
              <button
                key={item}
                type="button"
                role="radio"
                aria-checked={sign === item}
                onClick={() => setSign(item)}
                className={`!min-h-0 h-8 [@media(max-height:599px)]:h-7 rounded-md border px-2.5 !text-[12.5px] transition-colors ${
                  sign === item ? "border-rust bg-rust/20 text-parch" : "border-line bg-ink-2 text-mute hover:text-parch"
                }`}
              >
                {t(`shell.sign.${item}`)}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("shell.create.color.label")}>
            {COLORS.map((item) => (
              <button
                key={item}
                type="button"
                role="radio"
                aria-checked={color === item}
                aria-label={t(`shell.color.${item}`)}
                title={t(`shell.color.${item}`)}
                onClick={() => setColor(item)}
                className={`!min-h-0 size-8 [@media(max-height:599px)]:size-7 rounded-md border-2 transition-colors ${color === item ? "border-parch" : "border-transparent"}`}
                style={{ background: swatch(item) }}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5 [@media(max-height:640px)]:gap-1">
          <span className="text-[12px] leading-4 text-mute">{t("shell.create.type")}</span>
          <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label={t("shell.create.type")}>
            {TYPES.map((item) => (
              <button
                key={item}
                type="button"
                role="radio"
                aria-checked={type === item}
                onClick={() => setType(item)}
                className={`!min-h-0 h-8 rounded-md border !text-[13px] font-medium transition-colors ${
                  type === item ? "border-rust bg-rust/20 text-parch" : "border-line bg-ink-2 text-mute hover:text-parch"
                }`}
              >
                {t(`shell.type.${item}`)}
              </button>
            ))}
          </div>
          <p className="min-h-4 text-[12px] leading-4 text-mute [@media(max-height:639px)]:hidden">{t(`shell.type.${type}.bonus`)}</p>
        </div>
      </div>
    </EntryFrame>
  );
}
