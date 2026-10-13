/**
 * Каркас окна входа, регистрации и создания: высота видимой области (dvh), без прокрутки.
 * Телефон — колонка «шапка / тело / низ». От 1024 px — слева герой, справа форма.
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
  hero,
  children,
  footer,
}: {
  lang: Locale;
  /** Слева в шапке: «назад» или пусто. */
  start?: ReactNode;
  notice: { message: string | null; tone: "info" | "error"; id: number };
  /** Блок-герой для широкого экрана (только от 1024 px). */
  hero?: ReactNode;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main
      data-testid="entry-frame"
      data-lang={lang}
      className="relative mx-auto grid h-dvh w-full max-w-[1040px] grid-cols-[minmax(0,1fr)] items-stretch overflow-hidden bg-ink px-5 pt-[calc(env(safe-area-inset-top,0px)+8px)] pb-[calc(env(safe-area-inset-bottom,0px)+12px)] font-['Manrope',system-ui,sans-serif] text-parch [@media(max-height:599px)]:px-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)] lg:gap-x-14 lg:px-10"
    >
      <Notice message={notice.message} tone={notice.tone} id={notice.id} />

      {hero ? <aside className="hidden min-h-0 flex-col justify-center lg:flex">{hero}</aside> : null}

      <section className="grid min-h-0 grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)_auto]">
        <header className="flex h-9 items-center justify-between gap-2 [@media(max-height:699px)]:h-8">
          <div className="min-w-0">{start}</div>
          <LangSwitch lang={lang} />
        </header>
        <div data-testid="entry-body" className="flex min-h-0 flex-col justify-center gap-3.5 py-2 [@media(max-height:699px)]:gap-2.5 [@media(max-height:640px)]:py-1 [@media(max-height:599px)]:py-0.5">
          {children}
        </div>
        <footer className="flex flex-col gap-2 pt-1 [@media(max-height:640px)]:gap-1.5">{footer}</footer>
      </section>
    </main>
  );
}

/** Заголовок окна. Подзаголовок скрывается ниже 700 px (текст сохранён). */
export function ScreenTitle({ title, sub, align = "left" }: { title: string; sub?: string; align?: "left" | "center" }) {
  return (
    <div className={`flex flex-col gap-1 ${align === "center" ? "items-center text-center" : ""}`}>
      <h1 className="font-['Unbounded',system-ui,sans-serif] text-[20px] leading-tight font-semibold text-parch [@media(max-height:599px)]:text-[18px]">{title}</h1>
      {sub ? (
        <p className="max-w-[340px] font-['Cormorant_Garamond',serif] text-[16px] leading-snug text-mute italic [@media(max-height:699px)]:hidden">{sub}</p>
      ) : null}
    </div>
  );
}
