/**
 * Каркас окна входа, регистрации и создания: высота видимой области (dvh), без прокрутки.
 * Сетка «шапка / тело / низ»: тело сжимается, низ с основной кнопкой всегда на месте.
 * Полоса объявлений — вверху по центру (решено 14.10).
 */

import type { ReactNode } from "react";
import type { Locale } from "@tdl/protocol";
import { LangSwitch } from "./controls.js";
import { Notice } from "./Notice.js";

export function EntryFrame({
  lang,
  start,
  notice,
  children,
  footer,
}: {
  lang: Locale;
  /** Слева в шапке: «назад» или пусто. */
  start?: ReactNode;
  notice: { message: string | null; tone: "info" | "error"; id: number };
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main
      data-testid="entry-frame"
      data-lang={lang}
      className="entry-frame relative mx-auto grid h-dvh w-full max-w-[420px] grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-stone-950 px-5 pt-[calc(env(safe-area-inset-top,0px)+10px)] pb-[calc(env(safe-area-inset-bottom,0px)+14px)] text-stone-200 [@media(max-height:599px)]:px-4 [@media(max-height:699px)]:pt-[calc(env(safe-area-inset-top,0px)+6px)]"
    >
      <Notice message={notice.message} tone={notice.tone} id={notice.id} />
      <header className="flex h-9 items-center justify-between gap-2 [@media(max-height:699px)]:h-8">
        <div className="min-w-0">{start}</div>
        <LangSwitch lang={lang} />
      </header>
      <div data-testid="entry-body" className="flex min-h-0 flex-col justify-center gap-4 py-2 [@media(max-height:699px)]:gap-2.5 [@media(max-height:599px)]:py-0">{children}</div>
      <footer className="flex flex-col gap-2.5 pt-1 [@media(max-height:699px)]:gap-2">{footer}</footer>
    </main>
  );
}

/** Заголовок окна: название экрана и, на высоком экране, короткое пояснение. */
export function ScreenTitle({ title, sub, align = "left" }: { title: string; sub?: string; align?: "left" | "center" }) {
  return (
    <div className={`flex flex-col gap-1.5 ${align === "center" ? "items-center text-center" : ""}`}>
      <h1 className="font-['Unbounded',system-ui,sans-serif] text-[20px] leading-tight font-semibold tracking-tight text-stone-100 [@media(max-height:599px)]:text-[18px]">
        {title}
      </h1>
      {sub ? <p className="max-w-[340px] text-[13px] leading-snug text-stone-400 [@media(max-height:699px)]:hidden">{sub}</p> : null}
    </div>
  );
}
