/// <reference types="vite/client" />
import { useState } from "react";
import type { Locale } from "@tdl/protocol";

const PROTOTYPE_PATH = "/layout-prototype.html";

const COPY: Record<Locale, { open: string; close: string; title: string }> = {
  ru: { open: "Прототип раскладки", close: "Закрыть прототип", title: "Прототип раскладки двора" },
  en: { open: "Layout prototype", close: "Close prototype", title: "Court layout prototype" },
};

/** Служебная кнопка только в dev-сборке: открывает изолированный прототип раскладки во встроенном окне. */
export function PrototypeButton({ lang }: { lang: Locale }) {
  const [open, setOpen] = useState(false);
  const copy = COPY[lang];
  return (
    <>
      <button type="button" className="proto-entry" onClick={() => setOpen(true)}>
        {copy.open}
      </button>
      {open ? (
        <div className="proto-overlay" role="dialog" aria-modal="true" aria-label={copy.title}>
          <button type="button" className="proto-overlay__close" onClick={() => setOpen(false)}>
            {copy.close}
          </button>
          <iframe src={PROTOTYPE_PATH} title={copy.title} />
        </div>
      ) : null}
    </>
  );
}
