// Оболочка экрана «Двор» по утверждённой раскладке (прототип: /layout-prototype.html).
// Верх: профиль и ресурсы. Справа: переключатель Актив/Ивент и действия.
// Слева: квесты и свёрнутый чат (по нажатию — выдвижная панель). Снизу: нижнее меню.
// Всё, что ещё не реализовано, — заглушка: показывает сообщение «в разработке».
// Исключение: «Строительство» открывает существующую панель строительства.
// Иконки ресурсов и действий — временные (иконки проекта), подписи на экране только у переключателя.
import { useEffect, useState } from "react";
import type { Locale, WorldViewBase } from "@tdl/protocol";
import { ConceptIcon } from "./ConceptIcon.js";

type Mode = "actions" | "events";

const RESOURCES: { id: string; icon: string; name: string }[] = [
  { id: "meat", icon: "/icons/meat.png", name: "Мясо" },
  { id: "wood", icon: "/icons/wood.png", name: "Дерево" },
  { id: "stone", icon: "/icons/stone.png", name: "Камень" },
  { id: "metal", icon: "/icons/metal.png", name: "Металл" },
  { id: "mushrooms", icon: "/icons/mushroom.png", name: "Грибы" },
];
const GOLD = { id: "gold", icon: "/icons/gold.png", name: "Золото" };

// Действия: key — что делает кнопка. "build" — существующая панель строительства, остальные — заглушки.
const ACTIONS: { key: string; icon: string; title: string }[] = [
  { key: "march", icon: "/icons/i-swords.png", title: "Марш" },
  { key: "build", icon: "/icons/i-hammer.png", title: "Строительство" },
  { key: "research", icon: "/icons/i-flask.png", title: "Исследование" },
  { key: "heal", icon: "/icons/i-shield.png", title: "Лечение" },
];
const EVENTS: { key: string; icon: string; title: string }[] = [
  { key: "attack", icon: "/icons/i-helmet.png", title: "Нападение" },
  { key: "event-build", icon: "/icons/i-hammer.png", title: "Строительство" },
  { key: "event-research", icon: "/icons/i-flask.png", title: "Исследование" },
  { key: "clan-event", icon: "/icons/i-banner.png", title: "Клан" },
];

const QUESTS = ["Постройте жилой дом", "Соберите 100 мяса", "Отправьте разведку"];
const CHAT_TABS = ["Мир", "Королевство", "Клан", "Личные"];
const CHAT_LINES = [
  { who: "Соседний лорд", text: "тестовая строка" },
  { who: "Клан", text: "тестовая строка" },
  { who: "Система", text: "тестовая строка" },
];

export type CourtChromeProps = {
  view: WorldViewBase;
  lang: Locale;
  route: string;
  onRouteChange: (route: "court" | "map" | "reports" | "chronicle" | "sheet") => void;
  onBuild: () => void;
  onOpenProfile: () => void;
  // Страница раздела: в ней показываем только шапку и нижнее меню.
  pageMode?: boolean;
};

function formatAmount(value: number, lang: Locale): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(lang === "ru" ? "ru-RU" : "en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function CourtChrome({ view, lang, route, onRouteChange, onBuild, onOpenProfile, pageMode = false }: CourtChromeProps) {
  const [mode, setMode] = useState<Mode>("actions");
  const [chatOpen, setChatOpen] = useState(false);
  const [stub, setStub] = useState<string | null>(null);
  const stock = (view.stock ?? {}) as Record<string, number>;
  const court = (view.modules.court ?? {}) as { townhallLevel?: number };
  const level = Number(court.townhallLevel ?? 1);
  const name = view.me?.name ?? (lang === "ru" ? "Владыка" : "Lord");
  const onCourt = route === "court";

  useEffect(() => {
    if (!stub) return;
    const timer = window.setTimeout(() => setStub(null), 2200);
    return () => window.clearTimeout(timer);
  }, [stub]);

  const runAction = (key: string, title: string): void => {
    if (key === "build") {
      onBuild();
      return;
    }
    setStub(title);
  };

  const list = mode === "actions" ? ACTIONS : EVENTS;
  const mapToggle = onCourt ? "map" : "court";
  const mapLabel = onCourt ? "Карта" : "Двор";

  return (
    <div className="ch-root">
      <header className="ch-top">
        <button type="button" className="ch-profile" onClick={onOpenProfile} aria-label={`${name}, ${level}`}>
          <span className="ch-profile__avatar"><ConceptIcon name="lord" /></span>
          <span className="ch-profile__copy">
            <b>{name}</b>
            <small>{lang === "ru" ? "Ратуша" : "Hall"} · {level}</small>
          </span>
        </button>
        <div className="ch-res" aria-label={lang === "ru" ? "Ресурсы" : "Resources"}>
          {RESOURCES.map((r) => (
            <div key={r.id} className="ch-res__cell" title={r.name}>
              <img src={r.icon} alt="" />
              <b>{formatAmount(Number(stock[r.id] ?? 0), lang)}</b>
            </div>
          ))}
          <div className="ch-res__cell ch-res__cell--gold" title={GOLD.name}>
            <img src={GOLD.icon} alt="" />
            <b>{formatAmount(Number(stock[GOLD.id] ?? 0), lang)}</b>
          </div>
        </div>
      </header>

      {onCourt && !pageMode ? (
        <>
          <div className="ch-side">
            <div className="ch-switch" role="tablist">
              <button type="button" role="tab" aria-selected={mode === "actions"} className={mode === "actions" ? "is-on" : ""} onClick={() => setMode("actions")}>Актив</button>
              <button type="button" role="tab" aria-selected={mode === "events"} className={mode === "events" ? "is-on" : ""} onClick={() => setMode("events")}>Ивент</button>
            </div>
            {list.map((item) => (
              <button key={item.key} type="button" className="ch-action" title={item.title} aria-label={item.title} onClick={() => runAction(item.key, item.title)}>
                <img src={item.icon} alt="" />
              </button>
            ))}
          </div>

          <ul className="ch-quests" aria-label={lang === "ru" ? "Задания" : "Quests"}>
            {QUESTS.map((q, i) => (
              <li key={q} className={i === 0 ? "is-active" : ""}>
                <button type="button" onClick={() => setStub(q)}>{q}</button>
              </li>
            ))}
          </ul>

          <button type="button" className="ch-chat-strip" onClick={() => setChatOpen(true)} aria-label={lang === "ru" ? "Открыть чат" : "Open chat"}>
            <b>{CHAT_LINES[0]?.who}:</b> {CHAT_LINES[0]?.text}
          </button>
        </>
      ) : null}

      <nav className="ch-bottom" aria-label={lang === "ru" ? "Нижнее меню" : "Bottom menu"}>
        <div className="ch-bottom__group ch-bottom__group--left">
          <button type="button" className="ch-nav" onClick={() => setStub("Почта")}>Почта</button>
          <button type="button" className="ch-nav" onClick={() => setStub("Клан")}>Клан</button>
        </div>
        <button type="button" className="ch-map" onClick={() => onRouteChange(mapToggle)}>{mapLabel}</button>
        <div className="ch-bottom__group ch-bottom__group--right">
          <button type="button" className="ch-nav" onClick={() => setStub("Лавка")}>Лавка</button>
          <button type="button" className="ch-nav" onClick={() => setStub("Меню")}>Меню</button>
        </div>
      </nav>

      {chatOpen && onCourt && !pageMode ? (
        <section className="ch-chat" aria-label={lang === "ru" ? "Чат" : "Chat"}>
          <header>
            <div className="ch-chat__tabs">
              {CHAT_TABS.map((t, i) => (
                <button key={t} type="button" className={i === 0 ? "is-on" : ""} onClick={() => setStub(t)}>{t}</button>
              ))}
            </div>
            <button type="button" className="ch-chat__close" onClick={() => setChatOpen(false)} aria-label={lang === "ru" ? "Свернуть чат" : "Collapse chat"}>×</button>
          </header>
          <ul>
            {CHAT_LINES.map((m, i) => (
              <li key={i}><b>{m.who}:</b> {m.text}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {stub ? (
        <div className="ch-stub" role="status">
          {stub}: {lang === "ru" ? "заглушка, ещё не реализовано" : "placeholder, not implemented yet"}
        </div>
      ) : null}
    </div>
  );
}
