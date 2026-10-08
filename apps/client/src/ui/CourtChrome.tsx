// Оболочка экрана «Двор» по утверждённой раскладке (прототип: /layout-prototype.html).
// Верх: профиль (портрет, уровень, сила, VIP) и ресурсы. Справа: переключатель Актив/Ивент и действия.
// Слева: квесты (сворачиваются) и чат (свёрнутая строка с пометкой канала и точкой непрочитанного).
// Снизу: нижнее меню. Всё, что ещё не реализовано, — заглушка.
// Исключение: «Строительство» открывает существующую панель строительства.
// Иконки ресурсов и действий — временные (иконки проекта).
import { useEffect, useState } from "react";
import type { Locale, WorldViewBase } from "@tdl/protocol";
import { ConceptIcon } from "./ConceptIcon.js";

type Mode = "actions" | "events";
type Channel = "world" | "kingdom" | "clan" | "private";

// ЗАГЛУШКИ: доходы в час, сила и VIP — временные значения, чтобы видеть вёрстку. Не реальные данные.
const RESOURCES: { id: string; icon: string; name: string; income: number }[] = [
  { id: "meat", icon: "/icons/meat.png", name: "Мясо", income: 15 },
  { id: "wood", icon: "/icons/wood.png", name: "Дерево", income: 12 },
  { id: "stone", icon: "/icons/stone.png", name: "Камень", income: 8 },
  { id: "metal", icon: "/icons/metal.png", name: "Металл", income: 5 },
  { id: "mushrooms", icon: "/icons/mushroom.png", name: "Грибы", income: 10 },
];
const GOLD = { id: "gold", icon: "/icons/gold.png", name: "Золото", income: 3 };
const STUB_POWER = 2514942;
const STUB_VIP = 3;

// Действия: build — существующая панель строительства, остальные — заглушки.
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

// Квесты: первый — сюжетный (заглушка).
const QUESTS = [
  { text: "Постройте жилой дом", story: true },
  { text: "Соберите 100 мяса", story: false },
  { text: "Отправьте разведку", story: false },
];

// Каналы чата. Непрочитанное — заглушка.
const CHANNELS: { id: Channel; short: string; full: string }[] = [
  { id: "world", short: "Мир", full: "Мир" },
  { id: "kingdom", short: "Кор-во", full: "Королевство" },
  { id: "clan", short: "Клан", full: "Клан" },
  { id: "private", short: "ЛС", full: "Приват" },
];
const CHAT_LINES: { channel: Channel; who: string; text: string }[] = [
  { channel: "world", who: "Соседний лорд", text: "тестовая строка" },
  { channel: "clan", who: "Клан", text: "тестовая строка" },
  { channel: "private", who: "Система", text: "тестовая строка" },
];

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

function formatFull(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value).replace(/\u00a0/g, " ");
}

function formatAmount(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(Math.round(value));
}

export function CourtChrome({ view, lang, route, onRouteChange, onBuild, onOpenProfile, pageMode = false }: CourtChromeProps) {
  const [mode, setMode] = useState<Mode>("actions");
  const [questsOpen, setQuestsOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [channel, setChannel] = useState<Channel>("world");
  const [unread, setUnread] = useState<Record<Channel, boolean>>({ world: true, kingdom: false, clan: true, private: false });
  const [stub, setStub] = useState<string | null>(null);
  const stock = (view.stock ?? {}) as Record<string, number>;
  const name = view.me?.name ?? (lang === "ru" ? "Владыка" : "Lord");
  const onCourt = route === "court";
  const hasUnread = Object.values(unread).some(Boolean);
  const lastUnreadChannel = CHANNELS.find((c) => unread[c.id])?.id ?? "world";
  const stripLine = CHAT_LINES.find((m) => m.channel === lastUnreadChannel) ?? CHAT_LINES[0];

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
    setUnread((u) => ({ ...u, [id]: false }));
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
            {/* Уровень персонажа — заглушка: в протоколе пока нет данных. */}
            <b className="ch-profile__level" aria-label="Уровень персонажа">—</b>
          </span>
          <span className="ch-profile__info">
            <b>{name}</b>
            {/* Сила и VIP — заглушки: в протоколе пока нет данных. */}
            <small className="ch-profile__power ch-stub-value" title="Общая сила (заглушка)">Сила {formatFull(STUB_POWER)}</small>
            <i className="ch-profile__vip ch-stub-value" title="VIP (заглушка)">VIP {STUB_VIP}</i>
          </span>
        </button>
        <div className="ch-res" aria-label={lang === "ru" ? "Ресурсы" : "Resources"}>
          {RESOURCES.map((r) => (
            <div key={r.id} className="ch-res__item" title={r.name}>
              <span className="ch-res__icon"><img src={r.icon} alt="" /></span>
              <b>{formatAmount(Number(stock[r.id] ?? 0))}</b>
              <em className="ch-res__income" title="Доход в час (заглушка)">+{r.income}</em>
            </div>
          ))}
          <div className="ch-res__item ch-res__item--gold" title={GOLD.name}>
            <span className="ch-res__icon"><img src={GOLD.icon} alt="" /></span>
            <b>{formatAmount(Number(stock[GOLD.id] ?? 0))}</b>
            <em className="ch-res__income" title="Доход в час (заглушка)">+{GOLD.income}</em>
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

          {/* Квесты: свёрнуто — значок и текущий квест; развёрнуто — список. */}
          <div className={`ch-quests${questsOpen ? " is-open" : ""}`}>
            <button type="button" className="ch-quests__head" onClick={() => setQuestsOpen((v) => !v)} aria-expanded={questsOpen} aria-label={lang === "ru" ? "Задания" : "Quests"}>
              <img src="/icons/i-scroll.png" alt="" />
              {questsOpen ? (
                <b>{lang === "ru" ? "Задания" : "Quests"}</b>
              ) : (
                <>
                  <i className="ch-tag">{lang === "ru" ? "Сюжет" : "Story"}</i>
                  <span className="ch-quests__now">{QUESTS[0]?.text}</span>
                </>
              )}
              <span className="ch-quests__chev" aria-hidden="true">{questsOpen ? "‹" : "›"}</span>
            </button>
            {questsOpen ? (
              <ul>
                {QUESTS.map((q, i) => (
                  <li key={q.text} className={i === 0 ? "is-active" : ""}>
                    <button type="button" onClick={() => setStub(q.text)}>
                      {q.story ? <i className="ch-tag">{lang === "ru" ? "Сюжет" : "Story"}</i> : null}
                      {q.text}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {/* Чат: свёрнутая строка с каналом и точкой непрочитанного. */}
          <button type="button" className="ch-chat-strip" onClick={() => setChatOpen(true)} aria-label={lang === "ru" ? "Открыть чат" : "Open chat"}>
            <i className="ch-tag">{CHANNELS.find((c) => c.id === lastUnreadChannel)?.short}</i>
            <span className="ch-chat-strip__text"><b>{stripLine?.who}:</b> {stripLine?.text}</span>
            {hasUnread ? <span className="ch-dot" aria-label="Есть непрочитанные" /> : null}
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
              {CHANNELS.map((c) => (
                <button key={c.id} type="button" className={c.id === channel ? "is-on" : ""} onClick={() => openChannel(c.id)} title={c.full}>
                  {c.short}
                  {unread[c.id] ? <span className="ch-dot" aria-label="Непрочитанные" /> : null}
                </button>
              ))}
            </div>
            <button type="button" className="ch-chat__close" onClick={() => setChatOpen(false)} aria-label={lang === "ru" ? "Свернуть чат" : "Collapse chat"}>×</button>
          </header>
          <ul>
            {CHAT_LINES.filter((m) => m.channel === channel).map((m, i) => (
              <li key={i}><b>{m.who}:</b> {m.text}</li>
            ))}
            {CHAT_LINES.some((m) => m.channel === channel) ? null : <li className="ch-chat__empty">—</li>}
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
