import { useEffect, useState } from "react";
import type { Locale } from "@tdl/protocol";
import type { UiMockupId } from "./mockups.js";

const MOCKUPS: {
  id: UiMockupId;
  number: string;
  title: Record<Locale, string>;
  detail: Record<Locale, string>;
}[] = [
  {
    id: "citadel",
    number: "01",
    title: { ru: "Чертог совета", en: "Council Citadel" },
    detail: { ru: "Герб · лента ресурсов · нижняя навигация", en: "Crest · resource ribbon · lower dock" },
  },
  {
    id: "atlas",
    number: "02",
    title: { ru: "Полевой атлас", en: "Field Atlas" },
    detail: { ru: "Книжная карта · боковой журнал", en: "Map folio · side register" },
  },
  {
    id: "forge",
    number: "03",
    title: { ru: "Кузня приказов", en: "War Forge" },
    detail: { ru: "Пульт операций · горячие команды", en: "Operations console · quick orders" },
  },
  {
    id: "frost",
    number: "04",
    title: { ru: "Северный дозор", en: "Northern Watch" },
    detail: { ru: "Компас · воздушные карточки · стекло", en: "Compass · floating cards · glass" },
  },
  {
    id: "ledger",
    number: "05",
    title: { ru: "Книга гарнизона", en: "Garrison Codex" },
    detail: { ru: "Ведомость · вкладки · боковая лента", en: "Ledger · tabs · side ribbon" },
  },
];

const COPY = {
  ru: {
    toggle: "Сравнить макеты интерфейса",
    tag: "МАКЕТЫ",
    eyebrow: "ПЯТЬ РАЗНЫХ КОМПОЗИЦИЙ",
    title: "Выберите направление",
    note: "Это новые концепции расположения и оформления, а не перекраска старых ячеек. Выбор сохраняется только в этом браузере.",
    close: "Закрыть выбор макета",
    current: "Сейчас открыт",
  },
  en: {
    toggle: "Compare interface mockups",
    tag: "MOCKUPS",
    eyebrow: "FIVE DISTINCT LAYOUTS",
    title: "Choose a direction",
    note: "New layout and visual concepts, not recolors of the old cells. Your choice stays in this browser only.",
    close: "Close mockup selector",
    current: "Now viewing",
  },
} as const;

export function MockupSwitcher({
  lang,
  selected,
  onSelect,
}: {
  lang: Locale;
  selected: UiMockupId;
  onSelect: (id: UiMockupId) => void;
}) {
  const [open, setOpen] = useState(false);
  const copy = COPY[lang];

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
        <span className="mockup-switcher__glyph" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="mockup-switcher__tag">{copy.tag}</span>
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
                      onSelect(mockup.id);
                      setOpen(false);
                    }}
                  >
                    <span className={`mockup-thumb mockup-thumb--${mockup.id}`} aria-hidden="true">
                      <i className="mockup-thumb__scene" />
                      <i className="mockup-thumb__profile" />
                      <i className="mockup-thumb__resources" />
                      <i className="mockup-thumb__rail" />
                      <i className="mockup-thumb__nav" />
                      <i className="mockup-thumb__highlight" />
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
            <footer className="mockup-switcher__footer">
              {copy.current}: {MOCKUPS.find((item) => item.id === selected)?.title[lang]}
            </footer>
          </section>
        </>
      ) : null}
    </div>
  );
}
