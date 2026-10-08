// ПРОТОТИП раскладки главного экрана «Двор» (пример для оценки заказчиком; после выбора удаляется).
// Не подключён к игре: своя страница, без входа, сервера и store. Все значения — заглушки.
//
// Принцип: размеры элементов фиксированы в пикселях и одинаковы в портрете и ландшафте.
// Положение задаётся якорями от краёв экрана. Ориентация меняет только размер экрана,
// поэтому при повороте элементы не перепрыгивают, а расстояния между ними меняются.
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./layout.css";

type Orient = "portrait" | "landscape";
type Screen = "court" | "map";

const SIZES: Record<Orient, { w: number; h: number }> = {
  portrait: { w: 390, h: 844 },
  landscape: { w: 844, h: 390 },
};

const RESOURCES = ["Мясо", "Дерево", "Камень", "Металл", "Грибы"];
// Левая колонка: основные линии. «Скоро» — заглушка для будущей линии.
const LEFT = ["Марш", "Тренировка", "Исследование", "Лечение"];
// Правая колонка: предложение, в ТЗ заказчика не перечислено (вопрос открыт).
const RIGHT = ["Стройка", "Герои"];
// Нижнее меню: Отчёты и Клан/Лавка. Двор/Карта — центральная кнопка.
const NAV_LEFT = ["Отчёты"];
const NAV_RIGHT = ["Клан", "Лавка"];

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
        <span className="hd-portrait" aria-hidden="true" />
        <span className="hd-copy">
          <b>Имя лорда</b>
          <small>Ур. — · Сила —</small>
        </span>
      </div>
      <button type="button" className="hd-menu">Меню</button>
      <div className="hd-res" aria-label="Ресурсы">
        <div className="res-group">
          {RESOURCES.map((name) => (
            <div key={name} className="res">
              <small>{name}</small>
              <b>—</b>
            </div>
          ))}
        </div>
        <div className="res res--gold" title="Премиум-валюта, отдельно от ресурсов стройки">
          <small>Золото</small>
          <b>—</b>
        </div>
      </div>
    </>
  );
}

function Btn({ label, disabled = false }: { label: string; disabled?: boolean }) {
  return (
    <button type="button" className="btn" disabled={disabled}>
      <span className="btn__mark" aria-hidden="true">{label.slice(0, 1)}</span>
      <span className="btn__label">{label}</span>
    </button>
  );
}

function NavBtn({ label }: { label: string }) {
  return <button type="button" className="nav-btn">{label}</button>;
}

function MapButton({ screen }: { screen: Screen }) {
  const label = screen === "court" ? "Карта" : "Двор";
  return (
    <button type="button" className="map-btn" aria-label={label}>
      {label}
    </button>
  );
}

function ChatCell({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="nav-btn nav-btn--chat" onClick={onToggle} aria-expanded={open}>
      Чат <i className="badge">3</i>
    </button>
  );
}

function ChatPanel({ onClose }: { onClose: () => void }) {
  return (
    <section className="chat-panel" aria-label="Чат">
      <header>
        <b>Чат</b>
        <button type="button" onClick={onClose} aria-label="Закрыть чат">×</button>
      </header>
      <ul>
        <li><b>Соседний лорд:</b> тестовая строка</li>
        <li><b>Система:</b> тестовая строка</li>
        <li><b>Клан:</b> тестовая строка</li>
      </ul>
    </section>
  );
}

function Device({ orient, screen }: { orient: Orient; screen: Screen }) {
  const { w, h } = SIZES[orient];
  const [chat, setChat] = useState(false);
  const toggleChat = () => setChat((value) => !value);

  return (
    <div className="dev" style={{ width: w, height: h }}>
      <div className="scene" data-screen={screen}>
        <span className="scene__label">{screen === "court" ? "сцена двора (заглушка)" : "карта мира (заглушка)"}</span>
      </div>
      <Header />

      <div className="side side--left">
        {LEFT.map((label) => <Btn key={label} label={label} />)}
        <Btn label="Скоро" disabled />
      </div>
      <div className="side side--right">
        {RIGHT.map((label) => <Btn key={label} label={label} />)}
      </div>

      <nav className="bottom" aria-label="Нижнее меню">
        <div className="bottom__group bottom__group--left">
          <ChatCell open={chat} onToggle={toggleChat} />
          {NAV_LEFT.map((label) => <NavBtn key={label} label={label} />)}
        </div>
        <MapButton screen={screen} />
        <div className="bottom__group bottom__group--right">
          {NAV_RIGHT.map((label) => <NavBtn key={label} label={label} />)}
        </div>
      </nav>

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
