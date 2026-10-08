// ПРОТОТИП раскладки главного экрана «Двор» (этап 0 ТЗ docs/game/30-hud-court-spec.md).
// Не подключён к игре: своя страница, без входа, сервера и store. Все значения — заглушки.
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "./layout.css";

type ChatVariant = "a" | "b" | "c";
type Screen = "court" | "map";
type Orientation = "land" | "port";

const RESOURCES = ["Мясо", "Дерево", "Камень", "Металл", "Грибы"];
const QUEUES = ["Строить", "Тренировка", "Исследование"];
const RIGHT = ["Командиры", "Клан", "Предметы", "Лавка", "Почта"];

function Chat({ variant }: { variant: "a" | "b" }) {
  const [open, setOpen] = useState(variant === "b");
  return (
    <section className={`proto-chat proto-chat-${variant} ${open ? "is-open" : "is-folded"}`}>
      <button type="button" className="proto-chat-head" onClick={() => setOpen(!open)}>
        Чат <span className="proto-badge">3</span>
        <span className="proto-hint">{open ? "свернуть" : "раскрыть"}</span>
      </button>
      {open ? (
        <ul className="proto-chat-body">
          <li><b>Соседний лорд:</b> тестовая строка</li>
          <li><b>Система:</b> тестовая строка</li>
          <li><b>Клан:</b> тестовая строка</li>
        </ul>
      ) : null}
    </section>
  );
}

function Dock({ screen, onToggle, chat }: { screen: Screen; onToggle: () => void; chat: ChatVariant }) {
  const centerLabel = screen === "court" ? "Карта" : "Двор";
  return (
    <nav className={`proto-dock ${chat === "c" ? "has-chat-cell" : ""}`} aria-label="Нижняя навигация">
      <button type="button" className="proto-cell">Отчёты</button>
      <button type="button" className="proto-cell">Хроника</button>
      <button type="button" className="proto-cell proto-center" onClick={onToggle}>
        {centerLabel}
        <span className="proto-center-sub">{screen === "court" ? "на карту" : "в свой двор"}</span>
      </button>
      {chat === "c" ? <button type="button" className="proto-cell">Чат</button> : null}
      <button type="button" className="proto-cell">Меню</button>
    </nav>
  );
}

function Frame({ screen, orientation, chat, onToggleScreen }: {
  screen: Screen; orientation: Orientation; chat: ChatVariant; onToggleScreen: () => void;
}) {
  return (
    <div className={`proto-frame proto-${orientation}`}>
      <div className="proto-scene" data-screen={screen}>
        <span className="proto-scene-label">
          {screen === "court" ? "сцена двора (Pixi, заглушка)" : "карта мира (заглушка)"}
        </span>
      </div>

      {/* Верх-лево: лорд (заглушка) */}
      <div className="proto-lord">
        <div className="proto-portrait" />
        <div>
          <div className="proto-strong">Имя лорда</div>
          <div className="proto-muted">Ур. — · Сила —</div>
        </div>
      </div>

      {/* Верх-право: ресурсы стройки + отдельная премиум-ячейка */}
      <div className="proto-resources">
        {RESOURCES.map((name) => (
          <div key={name} className="proto-res"><span>{name}</span><b>—</b></div>
        ))}
        <div className="proto-res proto-premium" title="Премиум-валюта, не ресурс стройки">
          <span>Золото · премиум</span><b>—</b>
        </div>
      </div>

      {/* Лево: главная линия (заглушка) и очереди */}
      <aside className="proto-left">
        <div className="proto-card proto-soon">Главная линия<span>скоро</span></div>
        {QUEUES.map((q) => (
          <button key={q} type="button" className="proto-icon-btn">{q}</button>
        ))}
      </aside>

      {/* Право: панели (заглушки) */}
      <aside className="proto-right">
        {RIGHT.map((r) => (
          <button key={r} type="button" className="proto-icon-btn">{r}</button>
        ))}
      </aside>

      {chat === "a" ? <Chat variant="a" /> : null}
      {chat === "b" ? <Chat variant="b" /> : null}
      <Dock screen={screen} onToggle={onToggleScreen} chat={chat} />
    </div>
  );
}

function Controls(props: {
  chat: ChatVariant; setChat: (v: ChatVariant) => void;
  screen: Screen; setScreen: (v: Screen) => void;
  orientation: Orientation; setOrientation: (v: Orientation) => void;
}) {
  const btn = (active: boolean, label: string, onClick: () => void) => (
    <button type="button" className={active ? "is-on" : ""} onClick={onClick}>{label}</button>
  );
  return (
    <div className="proto-controls">
      <span className="proto-tag">ПРОТОТИП · без данных</span>
      <div>Чат:
        {btn(props.chat === "a", "а) полоса слева", () => props.setChat("a"))}
        {btn(props.chat === "b", "б) правая колонка", () => props.setChat("b"))}
        {btn(props.chat === "c", "в) ячейка дока", () => props.setChat("c"))}
      </div>
      <div>Экран:
        {btn(props.screen === "court", "Двор", () => props.setScreen("court"))}
        {btn(props.screen === "map", "Карта", () => props.setScreen("map"))}
      </div>
      <div>Ориентация:
        {btn(props.orientation === "land", "ландшафт", () => props.setOrientation("land"))}
        {btn(props.orientation === "port", "портрет", () => props.setOrientation("port"))}
      </div>
    </div>
  );
}

function App() {
  const [chat, setChat] = useState<ChatVariant>("a");
  const [screen, setScreen] = useState<Screen>("court");
  const [orientation, setOrientation] = useState<Orientation>("land");
  return (
    <>
      <Controls chat={chat} setChat={setChat} screen={screen} setScreen={setScreen}
        orientation={orientation} setOrientation={setOrientation} />
      <Frame screen={screen} orientation={orientation} chat={chat}
        onToggleScreen={() => setScreen(screen === "court" ? "map" : "court")} />
    </>
  );
}

createRoot(document.getElementById("proto-root") as HTMLElement).render(
  <StrictMode><App /></StrictMode>,
);
