import { useEffect, useState } from "react";
import type { Locale } from "@tdl/protocol";
import { applyUiMockup, readUiMockup, type UiMockupId } from "./mockups.js";

const MOCKUPS: {
  id: UiMockupId;
  number: string;
  title: Record<Locale, string>;
  detail: Record<Locale, string>;
}[] = [
  {
    id: "bonewood",
    number: "05",
    title: { ru: "Bone-Wood", en: "Bone-Wood" },
    detail: { ru: "Текущий · дерево и кость", en: "Current · wood and bone" },
  },
  {
    id: "chronicle",
    number: "01",
    title: { ru: "Хроника двора", en: "Court Chronicle" },
    detail: { ru: "Бумага · тушь · латунь", en: "Paper · ink · brass" },
  },
  {
    id: "ash",
    number: "02",
    title: { ru: "Сажа и кость", en: "Ash and Bone" },
    detail: { ru: "Уголь · кость · сталь", en: "Charcoal · bone · steel" },
  },
  {
    id: "snow",
    number: "04",
    title: { ru: "Снег на камне", en: "Snow on Stone" },
    detail: { ru: "Иней · сланец · охра", en: "Frost · slate · ochre" },
  },
  {
    id: "ledger",
    number: "08",
    title: { ru: "Гарнизонная ведомость", en: "Garrison Ledger" },
    detail: { ru: "Олива · известь · латунь", en: "Olive · lime · brass" },
  },
];

const COPY = {
  ru: {
    toggle: "Открыть временное меню макетов",
    eyebrow: "ВРЕМЕННЫЙ ПРОСМОТР · 5",
    title: "Макеты интерфейса",
    note: "Временный просмотр. Меняется только оформление — игровой прогресс и команды не затрагиваются.",
    close: "Закрыть меню макетов",
    current: "Сейчас выбран",
  },
  en: {
    toggle: "Open temporary mockup menu",
    eyebrow: "TEMPORARY PREVIEW · 5",
    title: "UI mockups",
    note: "Temporary preview. Only appearance changes; game progress and commands are untouched.",
    close: "Close mockup menu",
    current: "Selected",
  },
} as const;

export function MockupSwitcher({ lang }: { lang: Locale }) {
  const [selected, setSelected] = useState<UiMockupId>(() => readUiMockup());
  const [open, setOpen] = useState(false);
  const copy = COPY[lang];

  useEffect(() => {
    applyUiMockup(selected);
  }, [selected]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="mockup-switcher">
      <button
        type="button"
        className="mockup-switcher__toggle"
        aria-label={copy.toggle}
        aria-expanded={open}
        aria-controls="mockup-switcher-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="mockup-switcher__burger" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="mockup-switcher__tag">UI</span>
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="mockup-switcher__scrim"
            aria-label={copy.close}
            onClick={() => setOpen(false)}
          />
          <section
            id="mockup-switcher-panel"
            className="mockup-switcher__panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mockup-switcher-title"
          >
            <header className="mockup-switcher__header">
              <div>
                <p className="mockup-switcher__eyebrow">{copy.eyebrow}</p>
                <h2 id="mockup-switcher-title">{copy.title}</h2>
              </div>
              <button
                type="button"
                className="mockup-switcher__close"
                aria-label={copy.close}
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </header>
            <p className="mockup-switcher__note">{copy.note}</p>
            <div className="mockup-switcher__list" role="group" aria-label={copy.title}>
              {MOCKUPS.map((mockup) => {
                const active = selected === mockup.id;
                return (
                  <button
                    key={mockup.id}
                    type="button"
                    className={`mockup-choice${active ? " is-active" : ""}`}
                    aria-pressed={active}
                    data-mockup-choice={mockup.id}
                    onClick={() => {
                      setSelected(mockup.id);
                      setOpen(false);
                    }}
                  >
                    <span className={`mockup-choice__swatch mockup-choice__swatch--${mockup.id}`} aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                    <span className="mockup-choice__copy">
                      <span className="mockup-choice__title">
                        <small>{mockup.number}</small>
                        <b>{mockup.title[lang]}</b>
                      </span>
                      <span className="mockup-choice__detail">{mockup.detail[lang]}</span>
                    </span>
                    <span className="mockup-choice__mark" aria-hidden="true">{active ? "✓" : ""}</span>
                  </button>
                );
              })}
            </div>
            <footer className="mockup-switcher__footer">{copy.current}: {MOCKUPS.find((item) => item.id === selected)?.title[lang]}</footer>
          </section>
        </>
      ) : null}
    </div>
  );
}
