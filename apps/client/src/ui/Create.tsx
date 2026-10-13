/**
 * Создание лорда: мастер из четырёх шагов — имя, портрет, знамя, тип.
 * Сверху всегда видна строка лорда (портрет, имя, знамя, тип). Каждый шаг помещается без прокрутки.
 * Отправка — только с последнего шага; логика createLord и слот `creation.steps` сохранены.
 */

import { useEffect, useState } from "react";
import type { Locale, SlotId, WorldViewBase } from "@tdl/protocol";
import { createLord } from "../net.js";
import { translator } from "../i18n/index.js";
import { useStore } from "../useStore.js";
import { Slot, hasSlot } from "../slots.js";
import { friendlyError } from "../shell/errors.js";
import { Button, Screen, Top } from "./kit/Auth.js";
import { Notice, useNotice } from "./kit/Notice.js";

const PORTRAITS = Array.from({ length: 10 }, (_, index) => `portrait-${index + 1}`);
const SIGNS = ["skull", "bell", "tooth", "hand", "tower", "mushroom"] as const;
const COLORS = ["bone", "moss", "ash", "blood", "iron", "wheat", "night", "rust"] as const;
const TYPES = ["flesh", "bone", "spore"] as const;
const NAME_MIN = 2;
const NAME_MAX = 18;
const STEPS = 4;
const STEP_TITLE = ["shell.create.name", "shell.create.portrait", "shell.create.banner", "shell.create.type"] as const;

export function Create({
  lang,
  view,
  serverNow,
}: {
  lang: Locale;
  view: WorldViewBase | null;
  serverNow: number;
}) {
  const t = translator(lang);
  const state = useStore();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [portrait, setPortrait] = useState<string>(PORTRAITS[0] as string);
  const [sign, setSign] = useState<string>(SIGNS[0]);
  const [color, setColor] = useState<string>(COLORS[0]);
  const [type, setType] = useState<(typeof TYPES)[number]>("flesh");
  const [sending, setSending] = useState(false);
  const notice = useNotice();
  const trimmed = name.trim();
  const nameOk = trimmed.length >= NAME_MIN && trimmed.length <= NAME_MAX;

  // Отказ ядра (имя занято, имя не подходит) — спокойной фразой и снимает ожидание.
  const failureKey = state.errors[0]?.key;
  useEffect(() => {
    if (failureKey) {
      setSending(false);
      notice.say(friendlyError(lang, failureKey), "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failureKey]);

  const worldView: WorldViewBase = view ?? {
    world: { id: "world-1", name: "", size: 0, zones: 0, zonePit: 0, zoneCapital: 0, now: serverNow, downtimeMs: 0 },
    me: null,
    stock: {},
    modules: {},
  };

  const last = step === STEPS - 1;
  const canNext = step === 0 ? nameOk : true;

  const next = () => {
    if (!canNext) return;
    if (!last) {
      setStep((current) => current + 1);
      return;
    }
    if (!nameOk || sending) return;
    setSending(true);
    createLord({ name: trimmed, portrait, bannerSign: sign, bannerColor: color, type });
  };

  return (
    <Screen lang={lang}>
      <Notice message={notice.message} tone={notice.tone} id={notice.id} />

      <Top lang={lang} back={step > 0 ? t("shell.create.back") : undefined} onBack={() => setStep((current) => current - 1)} />

      <Slot
        slot={"creation.steps" as SlotId}
        view={worldView}
        lang={lang}
        serverNow={serverNow}
        empty={hasSlot("creation.steps" as SlotId) ? null : undefined}
      />

      <LordRow lang={lang} name={trimmed} portrait={portrait} sign={sign} color={color} type={type} />

      <div className="cr-stage" data-step={step + 1}>
        <div className="ui-head">
          <p className="cr-count">{t("shell.create.step", { index: step + 1, total: STEPS })}</p>
          <h1 className="ui-title">{t(STEP_TITLE[step] as string)}</h1>
        </div>

        {step === 0 ? (
          <div className={`cr-name ${name && !nameOk ? "cr-name-bad" : ""}`}>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") next();
              }}
              maxLength={NAME_MAX}
              className="cr-name-input"
              aria-label={t("shell.create.name")}
              placeholder={t("shell.create.name")}
              autoComplete="off"
              autoCorrect="off"
            />
            <span className="cr-count-num" aria-hidden="true">
              {trimmed.length}/{NAME_MAX}
            </span>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="cr-portraits" role="radiogroup" aria-label={t("shell.create.portrait")}>
            {PORTRAITS.map((item, index) => (
              <button
                key={item}
                type="button"
                role="radio"
                aria-checked={portrait === item}
                aria-label={`${index + 1}`}
                onClick={() => setPortrait(item)}
                className={`cr-portrait ${portrait === item ? "cr-on" : ""}`}
              >
                <img src={`/portraits/${item}.jpg`} alt="" decoding="async" />
              </button>
            ))}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="cr-banner-step">
            <div className="cr-field-label">{t("shell.create.sign.label")}</div>
            <div className="cr-signs" role="radiogroup" aria-label={t("shell.create.sign.label")}>
              {SIGNS.map((item) => (
                <button
                  key={item}
                  type="button"
                  role="radio"
                  aria-checked={sign === item}
                  onClick={() => setSign(item)}
                  className={`cr-sign ${sign === item ? "cr-on" : ""}`}
                >
                  {t(`shell.sign.${item}`)}
                </button>
              ))}
            </div>
            <div className="cr-field-label">{t("shell.create.color.label")}</div>
            <div className="cr-swatches" role="radiogroup" aria-label={t("shell.create.color.label")}>
              {COLORS.map((item) => (
                <button
                  key={item}
                  type="button"
                  role="radio"
                  aria-checked={color === item}
                  aria-label={t(`shell.color.${item}`)}
                  title={t(`shell.color.${item}`)}
                  onClick={() => setColor(item)}
                  className={`cr-swatch ${color === item ? "cr-on" : ""}`}
                  style={{ background: swatch(item) }}
                />
              ))}
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="cr-types" role="radiogroup" aria-label={t("shell.create.type")}>
            {TYPES.map((item) => (
              <button
                key={item}
                type="button"
                role="radio"
                aria-checked={type === item}
                onClick={() => setType(item)}
                className={`cr-type ${type === item ? "cr-on" : ""}`}
              >
                <span className="cr-type-name">{t(`shell.type.${item}`)}</span>
                <span className="cr-type-card">{t(`shell.type.${item}.card`)}</span>
                <span className="cr-type-bonus">{t(`shell.type.${item}.bonus`)}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="ui-push" />
      <p className="ui-helper ui-helper-center" role="status">
        {step === 0 && !name ? t("shell.create.empty") : step === 0 && !nameOk ? t("shell.create.name.hint") : ""}
      </p>
      <Button type="button" onClick={next} disabled={!canNext || sending} data-testid="create-next">
        {last ? (sending ? "…" : t("shell.create.take")) : t("shell.create.next")}
      </Button>
    </Screen>
  );
}

/** Строка лорда: портрет, имя, знамя и тип. Видна на каждом шаге. */
function LordRow({
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
    <aside className="cr-lord" aria-label={t("shell.create.summary")}>
      <img className="cr-lord-portrait" src={`/portraits/${portrait}.jpg`} alt="" />
      <div className="cr-lord-body">
        <span className="cr-lord-name">{name || "—"}</span>
        <span className="cr-lord-meta">
          <span className="cr-banner" style={{ background: swatch(color) }}>
            {t(`shell.sign.${sign}`)}
          </span>
          <span>{t(`shell.type.${type}`)}</span>
        </span>
      </div>
    </aside>
  );
}

/** Цвет знамени для превью и для игры (Hud). */
export function swatch(name: string): string {
  const table: Record<string, string> = {
    bone: "#d8d2c4",
    moss: "#6b7a4a",
    ash: "#7d7a74",
    blood: "#7a2b28",
    iron: "#4a4f55",
    wheat: "#b08b4f",
    night: "#2b2f3a",
    rust: "#8a4b2a",
  };
  return table[name] ?? "#7d7a74";
}
