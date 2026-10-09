// Оболочка экрана «Двор» по утверждённой раскладке (прототип: /layout-prototype.html).
// Верх: профиль и ресурсы, под ним — бегущая строка объявлений.
// Справа: переключатель Актив/Ивент и действия. Слева: квесты (сворачиваются) и чат.
// Снизу: нижнее меню. Всё, что ещё не реализовано, — заглушка (сообщения в чате локальные, без сервера).
// Исключение: «Строительство» открывает существующую панель строительства.
import { useEffect, useState } from "react";
import type { Locale, WorldViewBase } from "@tdl/protocol";
import { ConceptIcon } from "./ConceptIcon.js";
import { Badge } from "./Badge.js";

type Mode = "actions" | "events";
type Channel = "kingdom" | "world" | "clan" | "private";

// ЗАГЛУШКИ: доходы в час, сила, VIP, уровень, объявления, сообщения — временные значения для показа вёрстки.
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
const STUB_LEVEL = 12;
const STUB_MAIL_UNREAD = 2;
// Номер мира для тега сообщений — заглушка (в протоколе пока нет номера мира).
const STUB_WORLD_NO = 3;

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

// Квесты: прогресс — заглушка (cur пока 0).
const QUESTS: { text: string; story: boolean; cur: number; max: number }[] = [
  { text: "Постройте жилой дом", story: true, cur: 0, max: 1 },
  { text: "Соберите дерево", story: false, cur: 0, max: 100 },
  { text: "Убейте 20 монстров", story: false, cur: 0, max: 20 },
];

// Бегущая строка объявлений — заглушка.
const ANNOUNCEMENTS = [
  "Мировой босс «Пожиратель» появился у Северных врат",
  "Ивент «Осенний урожай» стартует в 20:00 UTC",
  "Клан «Волки» открыл набор бойцов",
];

// Каналы в порядке вкладок: Кор-во, Мир, Клан, ЛС. Шестерёнка-настройки — отдельно (заглушка).
const CHANNELS: { id: Channel; short: string; full: string }[] = [
  { id: "kingdom", short: "Кор-во", full: "Королевство" },
  { id: "world", short: "Мир", full: "Мир" },
  { id: "clan", short: "Клан", full: "Клан" },
  { id: "private", short: "ЛС", full: "Приват" },
];

// world — номер мира отправителя (только для «Кор-во», межмировой чат).
type Msg = { id: number; channel: Channel; world?: number; who: string; text: string; own?: boolean };

// Позиция в чате: последняя открытая вкладка сохраняется между сессиями.
const CHANNEL_KEY = "tdl.chat.channel";
const STRIP_LINES = 4;
function loadChannel(): Channel {
  try {
    const saved = window.localStorage.getItem(CHANNEL_KEY);
    if (CHANNELS.some((c) => c.id === saved)) return saved as Channel;
  } catch {
    // нет доступа к хранилищу — используем вкладку по умолчанию
  }
  return "world";
}

// Тег источника. «Кор-во» — межмировой чат: тег только номер мира (№3).
// «Мир» — чат внутри королевства: тег «Мир» без номера. Клан и ЛС — подпись канала.
function sourceTag(m: Msg): string {
  if (m.channel === "kingdom") return `№${m.world ?? STUB_WORLD_NO}`;
  if (m.channel === "world") return "Мир";
  return CHANNELS.find((c) => c.id === m.channel)?.short ?? "";
}
// Сообщения — заглушки, по несколько на канал, чтобы видеть вёрстку.
const SEED_MESSAGES: Msg[] = [
  { id: 1, channel: "kingdom", world: 3, who: "Королевский писарь", text: "Новый приказ: укрепите стены" },
  { id: 2, channel: "kingdom", world: 7, who: "Лорд Варн", text: "Кто идёт в поход на север?" },
  { id: 3, channel: "kingdom", world: 12, who: "Лорд Варн", text: "Нужны лучники, 10 мест" },
  { id: 11, channel: "kingdom", world: 7, who: "Соседний лорд", text: "Мировой босс у Северных врат!" },
  { id: 12, channel: "kingdom", world: 5, who: "Рыцарь Эйр", text: "Кто на босса?" },
  { id: 4, channel: "world", who: "Соседний лорд", text: "тестовая строка" },
  { id: 5, channel: "world", who: "Рыцарь Эйр", text: "Продаю грибы, пишите в ЛС" },
  { id: 6, channel: "world", who: "Система", text: "Мировой босс появится через 30 минут" },
  { id: 7, channel: "world", who: "Торговец", text: "Лавка обновлена" },
  { id: 8, channel: "clan", who: "Вождь клана", text: "Сбор в 21:00" },
  { id: 9, channel: "clan", who: "Волк", text: "Не забываем про лазарет" },
  { id: 10, channel: "private", who: "Гамлет", text: "привет, поможешь с деревом?" },
];
const INITIAL_UNREAD: Record<Channel, number> = { kingdom: 2, world: 4, clan: 1, private: 1 };

// Эмодзи: категории и сетка. Заглушечный набор для проверки вёрстки.
const EMOJI: { label: string; items: string[] }[] = [
  { label: "Смайлы", items: ["😀", "😂", "😍", "😎", "🥹", "😭", "😡", "🤔", "😴", "🙃", "😅", "🥳", "😇", "🤩", "😱", "🙏"] },
  { label: "Бой", items: ["⚔️", "🛡️", "🏹", "💀", "🔥", "🩸", "🐺", "🐗", "🐉", "🗡️", "🎯", "🪓", "🏰", "🚩"] },
  { label: "Двор", items: ["🍖", "🪵", "🪨", "⛏️", "🍄", "💰", "🌾", "🔨", "🧪", "📜", "🏠", "🛒"] },
  { label: "Радость", items: ["🎉", "👑", "🏆", "⭐", "💎", "🎁", "🍻", "👍", "👏", "❤️", "💪", "🙌"] },
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

// Бегущая строка: одно объявление за раз, по окончании прокрутки скрывается, затем появляется следующее.
function AnnouncementBar() {
  const [index, setIndex] = useState(0);
  const [running, setRunning] = useState(true);

  useEffect(() => {
    if (running) return;
    const timer = window.setTimeout(() => {
      setIndex((i) => (i + 1) % ANNOUNCEMENTS.length);
      setRunning(true);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [running]);

  if (!running) return null;
  return (
    <div className="ch-ticker" aria-live="polite">
      <span key={index} className="ch-ticker__text" onAnimationEnd={() => setRunning(false)}>
        {ANNOUNCEMENTS[index]}
      </span>
    </div>
  );
}

export function CourtChrome({ view, lang, route, onRouteChange, onBuild, onOpenProfile, pageMode = false }: CourtChromeProps) {
  const [mode, setMode] = useState<Mode>("actions");
  const [questsOpen, setQuestsOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [channel, setChannel] = useState<Channel>(loadChannel);
  const [unread, setUnread] = useState<Record<Channel, number>>(INITIAL_UNREAD);
  const [messages, setMessages] = useState<Msg[]>(SEED_MESSAGES);
  const [draft, setDraft] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiGroup, setEmojiGroup] = useState(0);
  const [stub, setStub] = useState<string | null>(null);
  const stock = (view.stock ?? {}) as Record<string, number>;
  const name = view.me?.name ?? (lang === "ru" ? "Владыка" : "Lord");
  const onCourt = route === "court";
  const totalUnread = Object.values(unread).reduce((sum, n) => sum + n, 0);
  const channelLabel = CHANNELS.find((c) => c.id === channel)?.full ?? "";

  // Свёрнутый чат показывает последние сообщения вкладки, на которой остановился игрок.
  const stripMessages = messages.filter((m) => m.channel === channel).slice(-STRIP_LINES);

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
    setUnread((u) => ({ ...u, [id]: 0 }));
  };

  const send = (): void => {
    const text = draft.trim();
    if (!text) return;
    setMessages((list) => [...list, { id: Date.now(), channel, world: STUB_WORLD_NO, who: name, text, own: true }]);
    setDraft("");
    setEmojiOpen(false);
  };

  const list = mode === "actions" ? ACTIONS : EVENTS;
  const mapToggle = onCourt ? "map" : "court";
  const mapLabel = onCourt ? "Карта" : "Двор";
  const channelMessages = messages.filter((m) => m.channel === channel).slice(-40);

  return (
    <div className="ch-root">
      <header className="ch-top">
        <button type="button" className="ch-profile" onClick={onOpenProfile} aria-label={name}>
          <span className="ch-profile__portrait">
            <ConceptIcon name="lord" />
            <b className="ch-profile__level ch-stub-value" aria-label="Уровень персонажа (заглушка)">{STUB_LEVEL}</b>
          </span>
          <span className="ch-profile__info">
            <b>{name}</b>
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

      {onCourt && !pageMode ? <AnnouncementBar /> : null}

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

          {/* Квесты: свёрнуто — значок и текущий квест с прогрессом; развёрнуто — список. */}
          <div className={`ch-quests${questsOpen ? " is-open" : ""}`}>
            <button type="button" className="ch-quests__head" onClick={() => setQuestsOpen((v) => !v)} aria-expanded={questsOpen} aria-label={lang === "ru" ? "Задания" : "Quests"}>
              <img src="/icons/i-scroll.png" alt="" />
              {questsOpen ? (
                <b>{lang === "ru" ? "Задания" : "Quests"}</b>
              ) : (
                <>
                  <i className="ch-tag">{lang === "ru" ? "Сюжет" : "Story"}</i>
                  <span className="ch-quests__now">{QUESTS[0]?.text}</span>
                  <span className="ch-quests__prog">{QUESTS[0]?.cur}/{QUESTS[0]?.max}</span>
                </>
              )}
              <span className="ch-quests__chev" aria-hidden="true">{questsOpen ? "‹" : "›"}</span>
            </button>
            {questsOpen ? (
              <ul>
                {QUESTS.map((q, i) => (
                  <li key={q.text} className={i === 0 ? "is-active" : ""}>
                    <button type="button" onClick={() => setStub(q.text)}>
                      <span className="ch-quests__line">
                        {q.story ? <i className="ch-tag">{lang === "ru" ? "Сюжет" : "Story"}</i> : null}
                        <span className="ch-quests__text">{q.text}</span>
                      </span>
                      <span className="ch-quests__prog">{q.cur}/{q.max}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {/* Свёрнутый чат: скрывается, когда чат раскрыт. */}
          {!chatOpen ? (
            <button type="button" className="ch-chat-strip" onClick={() => setChatOpen(true)} aria-label={lang === "ru" ? "Открыть чат" : "Open chat"}>
              {stripMessages.map((m) => (
                <span key={m.id} className="ch-chat-strip__line">
                  {sourceTag(m) && <i className="ch-tag">{sourceTag(m)}</i>}
                  <span className="ch-chat-strip__text"><b>{m.who}:</b> {m.text}</span>
                </span>
              ))}
              <Badge count={totalUnread} />
            </button>
          ) : null}
        </>
      ) : null}

      <nav className="ch-bottom" aria-label={lang === "ru" ? "Нижнее меню" : "Bottom menu"}>
        <div className="ch-bottom__group ch-bottom__group--left">
          <button type="button" className="ch-nav" onClick={() => setStub("Почта")}>
            Почта
            <span className="ch-nav__badge"><Badge count={STUB_MAIL_UNREAD} /></span>
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
                    <span className="ch-chat__badge"><Badge count={unread[c.id]} /></span>
                  </button>
                ))}
                <button type="button" className="ch-chat__settings" onClick={() => setStub("Настройки чата")} aria-label="Настройки чата" title="Настройки чата">⋯</button>
              </div>
              <button type="button" className="ch-chat__close" onClick={() => setChatOpen(false)} aria-label={lang === "ru" ? "Свернуть чат" : "Collapse chat"}>×</button>
            </header>

            <ul className="ch-chat__list">
              {channelMessages.map((m) => (
                <li key={m.id} className={m.own ? "is-own" : ""}>
                  {channel === "kingdom" && <i className="ch-msg-tag">{sourceTag(m)}</i>}
                  <b>{m.who}:</b> {m.text}
                </li>
              ))}
            </ul>

            <div className="ch-chat__input">
              <button type="button" className={`ch-chat__emoji${emojiOpen ? " is-on" : ""}`} onClick={() => setEmojiOpen((v) => !v)} aria-label="Эмодзи" aria-expanded={emojiOpen}>☺</button>
              <input
                className="ch-chat__field"
                value={draft}
                maxLength={120}
                placeholder={`Написать в «${channelLabel}»…`}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") send();
                }}
              />
              <button type="button" className="ch-chat__send" onClick={send} disabled={!draft.trim()}>Отправить</button>
            </div>

            {emojiOpen ? (
              <div className="ch-emoji" role="group" aria-label="Эмодзи">
                <div className="ch-emoji__groups">
                  {EMOJI.map((g, i) => (
                    <button key={g.label} type="button" className={i === emojiGroup ? "is-on" : ""} onClick={() => setEmojiGroup(i)}>{g.label}</button>
                  ))}
                </div>
                <div className="ch-emoji__grid">
                  {EMOJI[emojiGroup]?.items.map((e) => (
                    <button key={e} type="button" onClick={() => setDraft((d) => (d + e).slice(0, 120))} aria-label={e}>{e}</button>
                  ))}
                </div>
              </div>
            ) : null}
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
