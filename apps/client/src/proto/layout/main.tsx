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
// Нижнее меню — сбоку (справа, над чатом). Карта/Двор — центральная кнопка внизу.
const NAV_RIGHT = ["Отчёты", "Клан", "Лавка"];

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
      <span className="top__avatar" aria-hidden="true" title="Имя лорда" />
      <div className="res-row" aria-label="Ресурсы">
        {RESOURCES.map((name) => (
          <div key={name} className="res">
            <small>{name}</small>
            <b>—</b>
          </div>
        ))}
        <div className="res res--gold" title="Премиум-валюта, отдельно от ресурсов стройки">
          <small>Золото</small>
          <b>—</b>
        </div>
      </div>
    </header>
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
  return <button type="button" className="btn btn--nav">{label}</button>;
}

function MapButton({ screen }: { screen: Screen }) {
  const label = screen === "court" ? "Карта" : "Двор";
  return (
    <button type="button" className="map-btn" aria-label={label}>
      {label}
    </button>
  );
}

// Чат — живая лента, видна всегда (не кнопка). Строки — заглушки.
function ChatFeed() {
  return (
    <section className="chat" aria-label="Чат">
      <p><b>Соседний лорд:</b> тестовая строка</p>
      <p><b>Клан:</b> тестовая строка</p>
    </section>
  );
}

function Device({ orient, screen }: { orient: Orient; screen: Screen }) {
  const { w, h } = SIZES[orient];
  return (
    <div className="dev" style={{ width: w, height: h }}>
      <div className="scene" data-screen={screen}>
        <span className="scene__label">{screen === "court" ? "сцена двора (заглушка)" : "карта мира (заглушка)"}</span>
      </div>
      <TopBar />

      <div className="side side--left">
        {LEFT.map((label) => <Btn key={label} label={label} />)}
        <Btn label="Скоро" disabled />
      </div>

      <div className="side side--right">
        {RIGHT.map((label) => <Btn key={label} label={label} />)}
      </div>
      <nav className="side-nav" aria-label="Нижнее меню">
        {NAV_RIGHT.map((label) => <NavBtn key={label} label={label} />)}
      </nav>

      <div className="bottom">
        <ChatFeed />
        <MapButton screen={screen} />
      </div>
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
