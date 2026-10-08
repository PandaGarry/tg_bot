// ПРОТОТИП раскладки главного экрана «Двор» (пример для оценки заказчиком; после выбора удаляется).
// Не подключён к игре: своя страница, без входа, сервера и store. Все значения — заглушки.
//
// Принцип: размеры элементов фиксированы в пикселях и одинаковы в портрете и ландшафте.
// Положение задаётся от краёв экрана (якоря). Ориентация меняет только размер экрана,
// без отдельных правил раскладки — поэтому при повороте ничего не «перепрыгивает».
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./layout.css";

type Variant = "A" | "B";
type Orient = "portrait" | "landscape";
type Screen = "court" | "map";

const SIZES: Record<Orient, { w: number; h: number }> = {
  portrait: { w: 390, h: 844 },
  landscape: { w: 844, h: 390 },
};

const RESOURCES = ["Мясо", "Дерево", "Камень", "Металл", "Грибы"];
const QUEUES = ["Стройка", "Войско", "Наука"];
const ACTIONS = ["Герои", "Клан", "Вещи"];

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

function Header() {
  return (
    <>
      <div className="hd-profile">
        <span className="hd-portrait" />
        <span className="hd-copy">
          <b>Имя лорда</b>
          <small>Ур. — · Сила —</small>
        </span>
      </div>
      <div className="hd-res" aria-label="Ресурсы">
        {RESOURCES.map((name) => (
          <div key={name} className="res">
            <small>{name}</small>
            <b>—</b>
          </div>
        ))}
        <div className="res res--gold" title="Премиум-валюта, не ресурс стройки">
          <small>Золото</small>
          <b>—</b>
        </div>
      </div>
    </>
  );
}

function Btn({ label, className = "" }: { label: string; className?: string }) {
  return (
    <button type="button" className={`btn ${className}`}>
      <span className="btn__mark" aria-hidden="true">{label.slice(0, 1)}</span>
      <span className="btn__label">{label}</span>
    </button>
  );
}

function MapButton({ screen }: { screen: Screen }) {
  const label = screen === "court" ? "Карта" : "Двор";
  return (
    <button type="button" className="map-btn" aria-label={label}>
      <span className="map-btn__label">{label}</span>
      <small>{screen === "court" ? "на карту" : "в свой двор"}</small>
    </button>
  );
}

function ChatCell({ open, onToggle, className }: { open: boolean; onToggle: () => void; className: string }) {
  return (
    <button type="button" className={`chat-cell ${className}`} onClick={onToggle} aria-expanded={open}>
      <span className="chat-cell__head">Чат <i className="badge">3</i></span>
      <span className="chat-cell__last">последняя строка…</span>
    </button>
  );
}

function ChatPanel({ onClose }: { onClose: () => void }) {
  return (
    <section className="chat-panel" aria-label="Чат">
      <header>
        <b>Чат</b>
        <button type="button" onClick={onClose}>×</button>
      </header>
      <ul>
        <li><b>Соседний лорд:</b> тестовая строка</li>
        <li><b>Система:</b> тестовая строка</li>
        <li><b>Клан:</b> тестовая строка</li>
      </ul>
    </section>
  );
}

function Device({ variant, orient, screen }: { variant: Variant; orient: Orient; screen: Screen }) {
  const { w, h } = SIZES[orient];
  const [chat, setChat] = useState(false);
  const toggleChat = () => setChat((value) => !value);

  return (
    <div className={`dev dev--${variant}`} style={{ width: w, height: h }}>
      <div className="scene" data-screen={screen}>
        <span className="scene__label">{screen === "court" ? "сцена двора (заглушка)" : "карта мира (заглушка)"}</span>
      </div>
      <Header />

      {variant === "A" ? (
        <>
          <div className="a-left">
            {QUEUES.map((q) => <Btn key={q} label={q} />)}
          </div>
          <div className="a-right">
            {ACTIONS.map((a) => <Btn key={a} label={a} />)}
          </div>
          <ChatCell open={chat} onToggle={toggleChat} className="a-chat" />
          <MapButton screen={screen} />
          <nav className="a-menu" aria-label="Меню">
            <Btn label="Отчёты" className="btn--nav" />
            <Btn label="Меню" className="btn--nav" />
          </nav>
        </>
      ) : (
        <>
          <div className="b-row b-row--left">
            {QUEUES.map((q) => <Btn key={q} label={q} />)}
          </div>
          <div className="b-row b-row--right">
            {ACTIONS.map((a) => <Btn key={a} label={a} />)}
          </div>
          <div className="b-plate">
            <ChatCell open={chat} onToggle={toggleChat} className="b-chat" />
            <nav className="b-menu" aria-label="Меню">
              <Btn label="Отчёты" className="btn--nav" />
              <Btn label="Меню" className="btn--nav" />
            </nav>
          </div>
          <MapButton screen={screen} />
        </>
      )}

      {chat ? <ChatPanel onClose={toggleChat} /> : null}
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
  const [variant, setVariant] = useState<Variant>("A");
  const [orient, setOrient] = useState<Orient>("portrait");
  const [screen, setScreen] = useState<Screen>("court");
  const { w, h } = SIZES[orient];
  const scale = useFitScale(w, h);

  return (
    <div className="proto">
      <div className="controls">
        <span className="tag">ПРОТОТИП · без данных</span>
        <Segment<Variant>
          value={variant}
          onChange={setVariant}
          options={[
            { id: "A", label: "1 · Полоса" },
            { id: "B", label: "2 · Плита" },
          ]}
        />
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
            <Device variant={variant} orient={orient} screen={screen} />
          </div>
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("proto-root") as HTMLElement).render(
  <StrictMode><App /></StrictMode>,
);
