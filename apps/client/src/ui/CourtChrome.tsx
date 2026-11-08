// Оболочка двора. В шапке и панелях показываются только реальные серверные данные;
// неподключённые системы обозначаются честным пустым состоянием.
import { useEffect, useState } from "react";
import type { Locale, WorldViewBase } from "@tdl/protocol";
import { ConceptIcon } from "./ConceptIcon.js";

type Mode = "actions" | "events";
type Channel = "kingdom" | "world" | "clan" | "private";

// В шапке показываем только подтверждённые остатки со снимка сервера.
const RESOURCES: { id: string; icon: string; name: string }[] = [
  { id: "meat", icon: "/icons/meat.png", name: "Мясо" },
  { id: "wood", icon: "/icons/wood.png", name: "Дерево" },
  { id: "stone", icon: "/icons/stone.png", name: "Камень" },
  { id: "metal", icon: "/icons/metal.png", name: "Металл" },
  { id: "mushrooms", icon: "/icons/mushroom.png", name: "Грибы" },
];
const GOLD = { id: "gold", icon: "/icons/gold.png", name: "Золото" };

const ACTIONS: { key: string; icon: string; title: string }[] = [
  { key: "march", icon: "/icons/i-swords.png", title: "Марш" },
  { key: "build", icon: "/icons/i-hammer.png", title: "Строительство" },
  { key: "research", icon: "/icons/i-flask.png", title: "Исследование" },
  { key: "heal", icon: "/icons/i-shield.png", title: "Лечение" },
];
const EVENTS: { key: string; icon: string; title: string }[] = [];

// Каналы в порядке вкладок: Кор-во, Мир, Клан, ЛС. Шестерёнка-настройки — отдельно (заглушка).
const CHANNELS: { id: Channel; short: string; full: string }[] = [
  { id: "kingdom", short: "Кор-во", full: "Королевство" },
  { id: "world", short: "Мир", full: "Мир" },
  { id: "clan", short: "Клан", full: "Клан" },
  { id: "private", short: "ЛС", full: "Приват" },
];

// Позиция выбранной вкладки сохраняется локально; сообщения и счётчики пока не подключены.
const CHANNEL_KEY = "tdl.chat.channel";
function loadChannel(): Channel {
  try {
    const saved = window.localStorage.getItem(CHANNEL_KEY);
    if (CHANNELS.some((c) => c.id === saved)) return saved as Channel;
  } catch {
    // нет доступа к хранилищу — используем вкладку по умолчанию
  }
  return "world";
}

export type CourtChromeProps = {
  view: WorldViewBase;
  lang: Locale;
  route: string;
  onRouteChange: (route: "court" | "map" | "reports" | "chronicle" | "sheet") => void;
  onBuild: () => void;
  onOpenProfile: () => void;
  // Страница раздела: показываем только шапку и нижнее меню.
  pageMode?: boolean;
};

function formatAmount(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(Math.round(value));
}

export function CourtChrome({ view, lang, route, onRouteChange, onBuild, onOpenProfile, pageMode = false }: CourtChromeProps) {
  const [mode, setMode] = useState<Mode>("actions");
  const [chatOpen, setChatOpen] = useState(false);
  const [channel, setChannel] = useState<Channel>(loadChannel);
  const [stub, setStub] = useState<string | null>(null);
  const stock = (view.stock ?? {}) as Record<string, number>;
  const court = (view.modules.court ?? {}) as { townhallLevel?: number };
  const townhallLevel = Number.isInteger(court.townhallLevel) ? Number(court.townhallLevel) : null;
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

  const openChannel = (id: Channel): void => {
    setChannel(id);
    try {
      window.localStorage.setItem(CHANNEL_KEY, id);
    } catch {
      // приватный режим или запрет хранилища — позиция просто не сохранится
    }
  };

  const list = mode === "actions" ? ACTIONS : EVENTS;
  const mapToggle = onCourt ? "map" : "court";
  const mapLabel = onCourt ? "Карта" : "Двор";
  return (
    <div className="ch-root">
      <header className="ch-top">
        <button type="button" className="ch-profile" onClick={onOpenProfile} aria-label={name}>
          <span className="ch-profile__portrait">
            <ConceptIcon name="lord" />
            {townhallLevel !== null ? <b className="ch-profile__level" aria-label={lang === "ru" ? "Уровень Цитадели" : "Citadel level"}>{townhallLevel}</b> : null}
          </span>
          <span className="ch-profile__info">
            <b>{name}</b>
          </span>
        </button>
        <div className="ch-res" aria-label={lang === "ru" ? "Ресурсы" : "Resources"}>
          {RESOURCES.map((r) => (
            <div key={r.id} className="ch-res__item" title={r.name}>
              <span className="ch-res__icon"><img src={r.icon} alt="" /></span>
              <b>{formatAmount(Number(stock[r.id] ?? 0))}</b>
            </div>
          ))}
          <div className="ch-res__item ch-res__item--gold" title={GOLD.name}>
            <span className="ch-res__icon"><img src={GOLD.icon} alt="" /></span>
            <b>{formatAmount(Number(stock[GOLD.id] ?? 0))}</b>
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
            {list.length > 0 ? list.map((item) => (
              <button key={item.key} type="button" className="ch-action" title={item.title} aria-label={item.title} onClick={() => runAction(item.key, item.title)}>
                <img src={item.icon} alt="" />
              </button>
            )) : <div className="ch-empty" role="status">{lang === "ru" ? "События ещё не подключены" : "Events are not connected yet"}</div>}
          </div>

          <div className="ch-quests ch-quests--empty" role="status">
            <img src="/icons/i-scroll.png" alt="" />
            <span>{lang === "ru" ? "Задания появятся после подключения системы" : "Quests will appear when the system is connected"}</span>
          </div>

          {/* Свёрнутый чат: скрывается, когда чат раскрыт. */}
          {!chatOpen ? (
            <button type="button" className="ch-chat-strip" onClick={() => setChatOpen(true)} aria-label={lang === "ru" ? "Открыть чат" : "Open chat"}>
              <span className="ch-chat-strip__text">{lang === "ru" ? "Чат ещё не подключён" : "Chat is not connected yet"}</span>
            </button>
          ) : null}
        </>
      ) : null}

      <nav className="ch-bottom" aria-label={lang === "ru" ? "Нижнее меню" : "Bottom menu"}>
        <div className="ch-bottom__group ch-bottom__group--left">
          <button type="button" className="ch-nav" onClick={() => setStub("Почта")}>
            Почта
          </button>
          <button type="button" className="ch-nav" onClick={() => setStub("Клан")}>Клан</button>
        </div>
        <button type="button" className="ch-map" onClick={() => onRouteChange(mapToggle)}>{mapLabel}</button>
        <div className="ch-bottom__group ch-bottom__group--right">
          <button type="button" className="ch-nav" onClick={() => setStub("Лавка")}>Лавка</button>
          <button type="button" className="ch-nav" onClick={() => setStub("Меню")}>Меню</button>
        </div>
      </nav>

      {chatOpen && onCourt && !pageMode ? (
        <>
          {/* Тап за пределами панели закрывает чат. */}
          <div className="ch-chat-backdrop" onClick={() => setChatOpen(false)} aria-hidden="true" />
          <section className="ch-chat" aria-label={lang === "ru" ? "Чат" : "Chat"}>
            <header className="ch-chat__head">
              <div className="ch-chat__tabs" role="tablist">
                {CHANNELS.map((c) => (
                  <button key={c.id} type="button" role="tab" aria-selected={c.id === channel} className={c.id === channel ? "is-on" : ""} onClick={() => openChannel(c.id)} title={c.full}>
                    {c.short}
                  </button>
                ))}
                <button type="button" className="ch-chat__settings" onClick={() => setStub("Настройки чата")} aria-label="Настройки чата" title="Настройки чата">⋯</button>
              </div>
              <button type="button" className="ch-chat__close" onClick={() => setChatOpen(false)} aria-label={lang === "ru" ? "Свернуть чат" : "Collapse chat"}>×</button>
            </header>

            <p className="ch-chat__empty" role="status">
              {lang === "ru" ? "Сообщения появятся после подключения серверного чата." : "Messages will appear when server chat is connected."}
            </p>

          </section>
        </>
      ) : null}

      {stub ? (
        <div className="ch-stub" role="status">
          {stub}: {lang === "ru" ? "заглушка, ещё не реализовано" : "placeholder, not implemented yet"}
        </div>
      ) : null}
    </div>
  );
}
