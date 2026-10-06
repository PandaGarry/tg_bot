/**
 * HUD-хром темы Mitchell — ландшафтная композиция (скандинавский SLG-стиль).
 * Композиция:
 *  - Верхняя тонкая полоса (аватар + ресурсы + часы/настройки)
 *  - Слева: квесты, очереди, вертикальные кнопки действий → золотой компас в углу
 *  - Чат правее компаса
 *  - Справа: марши, быстрые кнопки → щитовая навигация в углу
 *  - Пузыри действий на сцене
 *
 * Пропсы и колбэки сохранены от старого Hud, чтобы не ломать модуль строительства.
 */

import { useState } from "react";
import type { Locale, WorldViewBase } from "@tdl/protocol";
import { translator } from "../i18n/index.js";
import { swatch } from "./Create.js";
import { BuildPanel } from "./BuildPanel.js";
import { ICON_SRC } from "./iconSrc.js";

type PanelKind = "build" | "train" | "sci" | "commanders" | "clan" | "items" | "shop" | "mail" | "map" | null;

const fmt = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(n % 1e9 ? 1 : 0)}B` :
  n >= 1e6 ? `${(n / 1e6).toFixed(n % 1e6 ? 1 : 0)}M` :
  n >= 1e3 ? `${(n / 1e3).toFixed(n % 1e3 ? 1 : 0)}K` :
  String(n);

export function Hud({
  view,
  lang,
  placingName,
  pending,
  roadTool,
  onConfirm,
  onRemove,
  onCancel,
  onPlaceStart,
  onRoadTool,
  onUpgrade,
}: {
  view: WorldViewBase;
  lang: Locale;
  placingName: string | null;
  pending: { name: string; move: boolean; removable: boolean } | null;
  roadTool: boolean;
  onConfirm: () => void;
  onRemove: () => void;
  onCancel: () => void;
  onPlaceStart: (type: string) => void;
  onRoadTool: () => void;
  onUpgrade: () => void;
}) {
  const t = translator(lang);
  const [panel, setPanel] = useState<PanelKind>(null);
  const me = view.me;
  const court = (view.modules.court ?? {}) as { level?: number; power?: number };
  const level = Number(court.level ?? 1);
  const power = Number(court.power ?? 51921);
  const stock = view.stock ?? {};

  // UTC-часы
  const now = new Date();
  const utc = `UTC ${now.getUTCFullYear()}/${(now.getUTCMonth() + 1).toString().padStart(2, "0")}/${now.getUTCDate().toString().padStart(2, "0")} ${now.getUTCHours().toString().padStart(2, "0")}:${now.getUTCMinutes().toString().padStart(2, "0")}`;

  const resRow: [string, number, string][] = [
    ["meat", stock.meat ?? 1500000, "🍖"],
    ["wood", stock.wood ?? 1300000, "🪵"],
    ["stone", stock.stone ?? 305600, "🪨"],
    ["gold", stock.gold ?? 1100000, "💰"],
    ["gems", stock.mushrooms ?? 746, "💎"],
  ];

  const panelTitle = panel ? (panel === "build" ? t("shell.hud.build") : panel === "map" ? t("shell.nav.map") : t("shell.hud.soon")) : "";
  const panelText = panel === "build" ? t("shell.hud.soon.build") : t("shell.hud.soon");

  return (
    <>
      {/* Верхняя полоса */}
      <header className="topbar">
        {/* Аватар */}
        {me ? (
          <div className="lord">
            <span className="avatar" style={{ background: swatch(me.bannerColor) }}>
              <img src="icons/i-lord.png" alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </span>
            <span className="lord-info">
              <span className="lord-name">
                <b>{me.name}</b>
                <small className="lord-tag">[Клан]</small>
              </span>
              <span className="lord-power">
                <span className="ic-power">⚔</span>
                <b>{fmt(power)}</b>
              </span>
            </span>
            <span className="lord-badges">
              <span className="badge-lvl">{level}</span>
              <span className="badge-buff" title="Активный бафф">↑</span>
            </span>
          </div>
        ) : null}

        {/* Ресурсы */}
        <div className="resources">
          <span className="res" title="Работники/армия">
            <span className="res-ic">👷</span>
            <b>0/13</b>
          </span>
          {resRow.map(([id, amount, icon]) => (
            <span className={`res${id === "gems" ? " res--gem" : ""}`} key={id}>
              <span className="res-ic">{icon}</span>
              <b>{fmt(amount)}</b>
            </span>
          ))}
          <button type="button" className="res-plus" title="Пополнить">+</button>
        </div>

        {/* Часы и настройки */}
        <div className="top-right">
          <span className="clock">{utc}</span>
          <div className="top-settings">
            <button type="button" className="icon-btn" title="Звук">🔊</button>
            <button type="button" className="icon-btn" title="Настройки">⚙</button>
          </div>
        </div>
      </header>

      {/* Ивентовый баннер */}
      <div className="event-banner">
        <span className="eb-new">New</span>
        <span className="eb-icon">⚔</span>
        <div className="eb-title">Might Rush</div>
        <div className="eb-timer">3д 01:59:20</div>
      </div>

      {/* Квестовая панель */}
      <aside className="quest-panel">
        <span className="qp-scroll">📜</span>
        <div className="qp-head">
          <span>Глава 16</span>
          <span>
            <button type="button" className="qp-nav" disabled>‹</button>
            <button type="button" className="qp-nav">›</button>
          </span>
        </div>
        <ul className="qp-list">
          <li><span className="qp-prog">(6/7)</span> <span className="qp-todo">Улучшить Гадальную хижину</span></li>
          <li><span className="qp-prog">(0/1)</span> <span className="qp-todo">Занять Загадочный предел</span></li>
          <li><span className="qp-prog">(1/2)</span> <span className="qp-todo">Уничтожить второй Жертвенный камень</span></li>
          <li><span className="qp-done">✓ (8/8)</span> <span className="qp-done-text">Улучшить Чертог вождя</span></li>
        </ul>
      </aside>

      {/* Очереди */}
      <div className="queues">
        <div className="queue">
          <span className="q-ic">🔨</span>
          <div className="q-name">Стройка: Чертог</div>
          <div className="q-bar"><i style={{ width: "35%" }} /></div>
          <div className="q-time">00:02:15</div>
        </div>
        <div className="queue">
          <span className="q-ic" style={{ background: "linear-gradient(180deg,#8a2828,#5a1818)" }}>⚔</span>
          <div className="q-name">Тренировка: Пехота</div>
          <div className="q-bar"><i style={{ width: "62%", background: "var(--red)" }} /></div>
          <div className="q-time">00:08:42</div>
        </div>
        <div className="queue">
          <span className="q-ic" style={{ background: "linear-gradient(180deg,#2f6fb5,#1e4a7a)" }}>📖</span>
          <div className="q-name">Исследование: Стройка II</div>
          <div className="q-bar"><i style={{ width: "18%", background: "var(--blue)" }} /></div>
          <div className="q-time">01:12:05</div>
        </div>
      </div>

      {/* Левая колонка кнопок */}
      <nav className="left-actions">
        <button
          type="button"
          className="sq-btn"
          title="Строительство"
          onClick={() => setPanel(panel === "build" ? null : "build")}
        >
          <span>🔨</span>
          <span className="badge">7</span>
        </button>
        <button type="button" className="sq-btn" title="Задания"><span>📋</span></button>
        <button type="button" className="sq-btn" title="Рабочие"><span>👷</span></button>
      </nav>

      {/* Компас */}
      <button
        type="button"
        className="compass-btn"
        title="Карта мира"
        onClick={() => setPanel(panel === "map" ? null : "map")}
      >
        <span className="compass-rose">
          <span className="cn">N</span>
          <span className="cs">S</span>
          <span className="cw">W</span>
          <span className="ce">E</span>
          <span className="c-cross" />
        </span>
      </button>

      {/* Чат */}
      <div className="chat">
        <div className="chat-line"><span className="chat-name" style={{ color: "#e0b04a" }}>Рагнар:</span> <span>В атаку на север!</span></div>
        <div className="chat-line"><span className="chat-name" style={{ color: "#d06060" }}>Бьёрн:</span> <span>Собираем войска к стене</span></div>
        <div className="chat-line"><span className="chat-name" style={{ color: "#60a0d0" }}>Лагерта:</span> <span>Ресурсы шлите к причалу</span></div>
      </div>

      {/* Марши */}
      <div className="marches">
        <div className="march-slot">
          <span className="march-ph">🦅</span>
          <span className="badge badge--purple">!</span>
        </div>
        <div className="march-slot">
          <span className="march-ph">🐺</span>
          <span className="badge badge--purple">!</span>
        </div>
      </div>

      {/* Быстрые действия */}
      <div className="quick-actions">
        <button type="button" className="round-btn round-btn--green" title="Собрать">
          <span>✊</span><span className="badge">7</span>
        </button>
        <button type="button" className="round-btn round-btn--blue" title="Помощь клана">
          <span>🤝</span><span className="badge">2</span>
        </button>
        <button type="button" className="round-btn round-btn--dark" title="События/квесты">
          <span>📜</span><span className="badge">4</span>
        </button>
        <button
          type="button"
          className="round-btn round-btn--dark"
          title="Почта"
          onClick={() => setPanel(panel === "mail" ? null : "mail")}
        >
          <span>✉</span><span className="badge">19</span>
        </button>
      </div>

      {/* Щитовая навигация */}
      <nav className="shield-nav">
        <button type="button" className="shield-btn" title="Герои" onClick={() => setPanel(panel === "commanders" ? null : "commanders")}>
          <span>⛑</span><span className="badge">2</span>
        </button>
        <button type="button" className="shield-btn" title="Предметы" onClick={() => setPanel(panel === "items" ? null : "items")}>
          <span>🎒</span><span className="badge">19</span>
        </button>
        <button type="button" className="shield-btn" title="Армия/атака">
          <span>⚔</span>
        </button>
        <button type="button" className="shield-btn" title="Клан" onClick={() => setPanel(panel === "clan" ? null : "clan")}>
          <span>🚩</span><span className="badge">11</span>
        </button>
        <button type="button" className="shield-btn" title="Ещё">
          <span className="menu-dots"><i></i><i></i><i></i><i></i></span>
        </button>
      </nav>

      {/* Пузыри на сцене */}
      <div className="bubbles" aria-hidden>
        <div className="bubble bubble--build" style={{ left: "42%", top: "38%" }} title="Идёт строительство">
          <span>🔨</span><span className="bubble-ring" />
        </div>
        <div className="bubble bubble--up" style={{ left: "58%", top: "30%" }} title="Доступно улучшение">↑</div>
        <div className="bubble bubble--idle" style={{ left: "72%", top: "46%" }} title="Простаивает">z</div>
        <div className="bubble bubble--collect" style={{ left: "30%", top: "56%" }} title="Забрать ресурсы"><span>🍖</span></div>
      </div>

      {/* Панель строительства / заглушки */}
      {panel === "build" ? (
        <BuildPanel
          view={view}
          lang={lang}
          roadTool={roadTool}
          onPlaceStart={(type) => {
            setPanel(null);
            onPlaceStart(type);
          }}
          onRoadTool={() => {
            setPanel(null);
            onRoadTool();
          }}
          onUpgrade={onUpgrade}
        />
      ) : panel !== null && panel !== "map" ? (
        <div className="vr-modal-bg" style={{
          position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",backdropFilter:"blur(4px)",
          display:"grid",placeItems:"center",zIndex:100
        }} onClick={() => setPanel(null)}>
          <div style={{
            position:"relative",width:"min(560px,calc(100vw-24px))",maxHeight:"calc(100dvh-48px)",overflow:"auto",
            background:"linear-gradient(180deg,#201020,#100818)",border:"2px solid var(--gold-dark,#a87c28)",
            borderRadius:"var(--radius-lg)",boxShadow:"0 18px 40px rgba(0,0,0,0.5)",padding:"18px"
          }} onClick={(e) => e.stopPropagation()}>
            <button type="button" style={{
              position:"absolute",top:10,right:10,width:36,height:36,borderRadius:"50%",display:"grid",placeItems:"center",
              background:"var(--red)",border:"2px solid var(--gold)",color:"#fff",fontSize:18,fontWeight:800,cursor:"pointer",
              boxShadow:"0 2px 4px rgba(0,0,0,0.6)"
            }} onClick={() => setPanel(null)}>✕</button>
            <h2 style={{textAlign:"center",fontSize:24,fontWeight:800,color:"var(--text)",margin:"0 0 14px",letterSpacing:"0.02em"}}>{panelTitle}</h2>
            <p style={{textAlign:"center",color:"var(--text-muted)",padding:"20px 0",margin:0,fontSize:13,lineHeight:1.5}}>{panelText}</p>
            <div style={{display:"flex",gap:10}}>
              <button type="button" style={{
                minHeight:52,borderRadius:"var(--radius-md)",border:"1.5px solid var(--gold-dark)",
                background:"linear-gradient(180deg,var(--gold-light),var(--gold))",
                color:"#2a1a08",fontWeight:800,fontSize:16,cursor:"pointer",flex:1,
                boxShadow:"0 4px 10px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.4)"
              }} onClick={() => setPanel(null)}>Хорошо</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Подсказка при постановке здания */}
      {placingName ? (
        <div className="court-note">
          Ставим: {placingName} · коснитесь сетки ·
          <button type="button" style={{ marginLeft: 8, color: "var(--gold-light)", background: "none", border: "none", cursor: "pointer", minHeight: 0, padding: "0 6px" }} onClick={onCancel}>✕</button>
        </div>
      ) : null}
    </>
  );
}
