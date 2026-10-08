// ПРОТОТИП раскладки главного экрана «Двор» (пример для оценки заказчиком; после выбора удаляется).
// Не подключён к игре: своя страница, без входа, сервера и store. Все значения — заглушки.
//
// Принцип: один макет для портрета и ландшафта. Размеры элементов фиксированы в пикселях,
// положение задано якорями от краёв. Ориентация меняет только размер экрана.
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./layout.css";

type Orient = "portrait" | "landscape";
type Screen = "court" | "map";
type Mode = "actions" | "events";

const SIZES: Record<Orient, { w: number; h: number }> = {
  portrait: { w: 390, h: 844 },
  landscape: { w: 844, h: 390 },
};

// Ресурсы: иконка сверху крупно, количество под ней. Золото — отдельный чип.
const RESOURCES: { key: string; name: string; icon: string }[] = [
  { key: "meat", name: "Мясо", icon: "/icons/meat.png" },
  { key: "wood", name: "Дерево", icon: "/icons/wood.png" },
  { key: "stone", name: "Камень", icon: "/icons/stone.png" },
  { key: "metal", name: "Металл", icon: "/icons/metal.png" },
  { key: "mushroom", name: "Грибы", icon: "/icons/mushroom.png" },
];
const GOLD = { key: "gold", name: "Золото", icon: "/icons/gold.png" };

// Действия и события: только иконки (квадратные, временно — иконки проекта).
// Названия нужны только для подсказки и доступности, на экране не выводятся.
const ACTIONS = [
  { icon: "/icons/i-swords.png", title: "Марш" },
  { icon: "/icons/i-hammer.png", title: "Строительство" },
  { icon: "/icons/i-flask.png", title: "Исследование" },
  { icon: "/icons/i-shield.png", title: "Лечение" },
];
const EVENTS = [
  { icon: "/icons/i-helmet.png", title: "Нападение" },
  { icon: "/icons/i-hammer.png", title: "Строительство" },
  { icon: "/icons/i-flask.png", title: "Исследование" },
  { icon: "/icons/i-banner.png", title: "Клан" },
];
// Переключатель: иконки, подписи — в title.
const MODES: { id: Mode; label: string; title: string }[] = [
  { id: "actions", label: "Актив", title: "Действия" },
  { id: "events", label: "Ивент", title: "События" },
];

// Квесты: активный сверху, до трёх строк. Заглушки.
const QUESTS = ["Постройте жилой дом", "Соберите 100 мяса", "Отправьте разведку"];

const CHAT_TABS = ["Мир", "Королевство", "Клан", "Личные"];
const CHAT_LATEST = { who: "Соседний лорд", text: "тестовая строка" };
const CHAT_LINES = [
  { who: "Соседний лорд", text: "тестовая строка" },
  { who: "Клан", text: "тестовая строка" },
  { who: "Система", text: "тестовая строка" },
];

function useFitScale(w: number, h: number): number {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => setScale(Math.min(1, (window.innerWidth - 24) / w, (window.innerHeight - 110) / h));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [w, h]);
  return scale;
}

function TopBar() {
  return (
    <header className="top">
      <div className="profile">
        <span className="profile__avatar" aria-hidden="true" />
        <span className="profile__copy">
          <b>Имя лорда</b>
          <small>Ратуша · 1</small>
        </span>
      </div>
      <div className="res-row" aria-label="Ресурсы">
        {RESOURCES.map((r) => (
          <div key={r.key} className="res" title={r.name}>
            <img src={r.icon} alt="" />
            <b>—</b>
          </div>
        ))}
        <div className="res res--gold" title="Премиум-валюта, отдельно от ресурсов стройки">
          <img src={GOLD.icon} alt="" />
          <b>—</b>
        </div>
      </div>
    </header>
  );
}

function ActionColumn() {
  const [mode, setMode] = useState<Mode>("actions");
  const list = mode === "actions" ? ACTIONS : EVENTS;
  return (
    <div className="actions">
      <div className="switch" role="tablist">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            title={m.title}
            aria-label={m.title}
            aria-selected={mode === m.id}
            className={mode === m.id ? "is-on" : ""}
            onClick={() => setMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>
      {list.map((item) => (
        <button key={item.icon} type="button" className="action" title={item.title} aria-label={item.title}>
          <img src={item.icon} alt="" />
        </button>
      ))}
    </div>
  );
}

// Квесты — отдельный блок под верхней панелью слева.
function Quests() {
  return (
    <ul className="quests" aria-label="Задания">
      {QUESTS.map((q, i) => (
        <li key={q} className={i === 0 ? "is-active" : ""}>{q}</li>
      ))}
    </ul>
  );
}

// Чат — свёрнутая строка у нижнего меню слева. Нажатие открывает выдвижную панель.
function ChatStrip({ onChat }: { onChat: () => void }) {
  return (
    <button type="button" className="chat-strip" onClick={onChat} aria-label="Открыть чат">
      <b>{CHAT_LATEST.who}:</b> {CHAT_LATEST.text}
    </button>
  );
}

// Выдвижная панель чата слева, примерно 55% интерфейса. Вкладки по типу каналов.
function ChatDrawer({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState(0);
  return (
    <section className="chat-drawer" aria-label="Чат">
      <header>
        <div className="chat-tabs">
          {CHAT_TABS.map((t, i) => (
            <button key={t} type="button" className={i === tab ? "is-on" : ""} onClick={() => setTab(i)}>{t}</button>
          ))}
        </div>
        <button type="button" className="chat-drawer__close" onClick={onClose} aria-label="Свернуть чат">×</button>
      </header>
      <ul>
        {CHAT_LINES.map((m, i) => (
          <li key={i}><b>{m.who}:</b> {m.text}</li>
        ))}
      </ul>
    </section>
  );
}

function Device({ orient, screen }: { orient: Orient; screen: Screen }) {
  const { w, h } = SIZES[orient];
  const [chatOpen, setChatOpen] = useState(false);
  const mapLabel = screen === "court" ? "Карта" : "Двор";

  return (
    <div className="dev" style={{ width: w, height: h }}>
      <div className="scene" data-screen={screen}>
        <span className="scene__label">{screen === "court" ? "сцена двора (заглушка)" : "карта мира (заглушка)"}</span>
      </div>
      <TopBar />
      <ActionColumn />
      <Quests />
      <ChatStrip onChat={() => setChatOpen(true)} />

      <nav className="bottom" aria-label="Нижнее меню">
        <div className="bottom__group bottom__group--left">
          <button type="button" className="nav-btn">Почта</button>
          <button type="button" className="nav-btn">Клан</button>
        </div>
        <button type="button" className="map-btn" aria-label={mapLabel}>{mapLabel}</button>
        <div className="bottom__group bottom__group--right">
          <button type="button" className="nav-btn">Лавка</button>
          <button type="button" className="nav-btn">Меню</button>
        </div>
      </nav>

      {chatOpen ? <ChatDrawer onClose={() => setChatOpen(false)} /> : null}
    </div>
  );
}

function Segment<T extends string>({ value, options, onChange }: {
  value: T; options: { id: T; label: string }[]; onChange: (id: T) => void;
}) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={value === o.id} className={value === o.id ? "is-on" : ""} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function App() {
  const [orient, setOrient] = useState<Orient>("portrait");
  const [screen, setScreen] = useState<Screen>("court");
  const { w, h } = SIZES[orient];
  const scale = useFitScale(w, h);

  return (
    <div className="proto">
      <div className="controls">
        <span className="tag">ПРОТОТИП · без данных</span>
        <Segment<Orient>
          value={orient}
          onChange={setOrient}
          options={[
            { id: "portrait", label: "Портрет" },
            { id: "landscape", label: "Ландшафт" },
          ]}
        />
        <Segment<Screen>
          value={screen}
          onChange={setScreen}
          options={[
            { id: "court", label: "Двор" },
            { id: "map", label: "Карта" },
          ]}
        />
      </div>
      <div className="stage">
        <div style={{ width: w * scale, height: h * scale }}>
          <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: w, height: h }}>
            <Device orient={orient} screen={screen} />
          </div>
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("proto-root") as HTMLElement).render(
  <StrictMode><App /></StrictMode>,
);
