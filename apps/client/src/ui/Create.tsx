/**
 * Создание лорда: имя, портрет, знамя (знак и цвет), тип. Не конструктор лица.
 * Телефон — одна колонка, карточка лорда сверху, кнопка закреплена внизу.
 * Компьютер (от 1024 px) — две колонки: шаги слева, карточка лорда справа.
 */

import { useEffect, useState } from "react";
import type { JsonValue, Locale, SlotId, WorldViewBase } from "@tdl/protocol";
import { createLord } from "../net.js";
import { translator } from "../i18n/index.js";
import { Slot, hasSlot } from "../slots.js";
import { friendlyError, useFreshError } from "../shell/errors.js";
import { LangSwitch } from "./kit/Auth.js";
import { Notice, useNotice } from "./kit/Notice.js";

const PORTRAITS = Array.from({ length: 10 }, (_, index) => `portrait-${index + 1}`);
const SIGNS = ["skull", "bell", "tooth", "hand", "tower", "mushroom"] as const;
const COLORS = ["bone", "moss", "ash", "blood", "iron", "wheat", "night", "rust"] as const;
const TYPES = ["flesh", "bone", "spore"] as const;
const NAME_MIN = 2;
const NAME_MAX = 18;

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

  const submit = () => {
    if (!nameOk || sending) return;
    setSending(true);
    createLord({ name: trimmed, portrait, bannerSign: sign, bannerColor: color, type });
  };

  return (
    <main className="cr-screen" data-lang={lang}>
      <Notice message={notice.message} tone={notice.tone} id={notice.id} />

      <header className="cr-top">
        <div>
          <h1 className="cr-title">{t("shell.create.title")}</h1>
          <p className="cr-sub">{t("shell.create.sub")}</p>
        </div>
        <LangSwitch lang={lang} />
      </header>

      <Slot
        slot={"creation.steps" as SlotId}
        view={worldView}
        lang={lang}
        serverNow={serverNow}
        empty={hasSlot("creation.steps" as SlotId) ? null : undefined}
      />

      <div className="cr-layout">
        <div className="cr-steps">
          {/* 1. Имя */}
          <Step index={1} title={t("shell.create.name")} total={4} hint={t("shell.create.name.hint")}>
            <div className={`cr-input-wrap ${name && !nameOk ? "cr-input-bad" : ""}`}>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={NAME_MAX}
                className="cr-input"
                aria-label={t("shell.create.name")}
                placeholder={t("shell.create.name")}
                autoComplete="off"
              />
              <span className="cr-count" aria-hidden="true">
                {trimmed.length}/{NAME_MAX}
              </span>
            </div>
          </Step>

          {/* 2. Портрет */}
          <Step index={2} title={t("shell.create.portrait")} total={4}>
            <div className="cr-portraits" role="radiogroup" aria-label={t("shell.create.portrait")}>
              {PORTRAITS.map((item, index) => (
                <button
                  key={item}
                  type="button"
                  role="radio"
                  aria-checked={portrait === item}
                  aria-label={`${index + 1}`}
                  onClick={() => setPortrait(item)}
                  className={`cr-portrait ${portrait === item ? "cr-portrait-on" : ""}`}
                >
                  <img src={`/portraits/${item}.jpg`} alt="" decoding="async" />
                </button>
              ))}
            </div>
          </Step>

          {/* 3. Знамя */}
          <Step index={3} title={t("shell.create.banner")} total={4}>
            <div className="cr-field-label">{t("shell.create.sign.label")}</div>
            <div className="cr-chips" role="radiogroup" aria-label={t("shell.create.sign.label")}>
              {SIGNS.map((item) => (
                <button
                  key={item}
                  type="button"
                  role="radio"
                  aria-checked={sign === item}
                  onClick={() => setSign(item)}
                  className={`cr-chip ${sign === item ? "cr-chip-on" : ""}`}
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
                  className={`cr-swatch ${color === item ? "cr-swatch-on" : ""}`}
                  style={{ background: swatch(item) }}
                />
              ))}
            </div>
          </Step>

          {/* 4. Тип */}
          <Step index={4} title={t("shell.create.type")} total={4}>
            <div className="cr-types" role="radiogroup" aria-label={t("shell.create.type")}>
              {TYPES.map((item) => (
                <button
                  key={item}
                  type="button"
                  role="radio"
                  aria-checked={type === item}
                  onClick={() => setType(item)}
                  className={`cr-type ${type === item ? "cr-type-on" : ""}`}
                >
                  <span className="cr-type-name">{t(`shell.type.${item}`)}</span>
                  <span className="cr-type-card">{t(`shell.type.${item}.card`)}</span>
                  <span className="cr-type-bonus">{t(`shell.type.${item}.bonus`)}</span>
                </button>
              ))}
            </div>
          </Step>
        </div>

        {/* Карточка лорда: на телефоне — сверху компактно, на компьютере — справа и закреплена. */}
        <aside className="cr-summary" aria-label={t("shell.create.summary")}>
          <div className="cr-summary-card">
            <img className="cr-summary-portrait" src={`/portraits/${portrait}.jpg`} alt="" />
            <div className="cr-summary-body">
              <span className="cr-summary-kicker">{t("shell.create.summary")}</span>
              <span className="cr-summary-name">{trimmed || "—"}</span>
              <Banner sign={sign} color={color} label={t(`shell.sign.${sign}`)} />
              <span className="cr-summary-type">{t(`shell.type.${type}`)}</span>
            </div>
          </div>
        </aside>
      </div>

      {/* Закреплённая панель: подсказка и главная кнопка всегда на виду. */}
      <div className="cr-footer">
        <p className="cr-hint" role="status">
          {nameOk || !name ? "" : t("shell.create.name.hint")}
          {!name ? t("shell.create.empty") : ""}
        </p>
        <button type="button" disabled={!nameOk || sending} onClick={submit} className="auth-btn auth-btn-primary cr-submit">
          {sending ? "…" : t("shell.create.take")}
        </button>
      </div>
    </main>
  );
}

function Step({
  index,
  title,
  total,
  hint,
  children,
}: {
  index: number;
  title: string;
  total: number;
  hint?: string;
  children: JsonValue | React.ReactNode;
}) {
  return (
    <section className="cr-step" aria-label={`${title} ${index}/${total}`}>
      <header className="cr-step-head">
        <span className="cr-step-num">{String(index).padStart(2, "0")}</span>
        <h2 className="cr-step-title">{title}</h2>
      </header>
      {children as React.ReactNode}
      {hint ? <p className="cr-step-hint">{hint}</p> : null}
    </section>
  );
}

/** Предпросмотр знамени: цвет и подпись знака. */
function Banner({ sign, color, label }: { sign: string; color: string; label: string }) {
  return (
    <span className="cr-banner" style={{ background: swatch(color) }} data-sign={sign}>
      <span className="cr-banner-label">{label}</span>
    </span>
  );
}

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
