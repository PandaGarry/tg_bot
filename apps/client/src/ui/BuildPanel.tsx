/**
 * Панель строительства: вкладки «Экономика · Военные · Украшения».
 * Карточки с ценой; неоткрытое видно с замком — здания открываются
 * уровнем Ратуши (прокачка). Каталог здесь — копия для показа:
 * серверный модуль court остаётся единственной властью.
 */

import { useState } from "react";
import type { Locale, WorldViewBase } from "@tdl/protocol";
import { translator } from "../i18n/index.js";

type BuildTab = "economy" | "military" | "decor";

interface CatalogItem {
  id: string;
  tab: BuildTab;
  th: number;
  cost: [string, number][];
}

// Должно совпадать с CATALOG модуля court (сервер — власть, это показ).
const CATALOG: CatalogItem[] = [
  { id: "cottage", tab: "economy", th: 1, cost: [["wood", 50], ["stone", 20]] },
  { id: "farm", tab: "economy", th: 1, cost: [["wood", 60], ["stone", 30]] },
  { id: "sawmill", tab: "economy", th: 2, cost: [["wood", 80], ["stone", 40]] },
  { id: "quarry", tab: "economy", th: 2, cost: [["wood", 60], ["stone", 80]] },
  { id: "mine", tab: "economy", th: 3, cost: [["wood", 90], ["stone", 60], ["metal", 30]] },
  { id: "barracks", tab: "military", th: 3, cost: [["wood", 150], ["stone", 120], ["metal", 40]] },
  { id: "lantern", tab: "decor", th: 1, cost: [["wood", 10], ["gold", 5]] },
  { id: "bench", tab: "decor", th: 1, cost: [["wood", 15]] },
  { id: "well", tab: "decor", th: 2, cost: [["stone", 40], ["wood", 10]] },
  { id: "flag", tab: "decor", th: 1, cost: [["wood", 20], ["gold", 10]] },
];

const TABS: BuildTab[] = ["economy", "military", "decor"];
const TAB_KEYS: Record<BuildTab, string> = {
  economy: "shell.hud.build.tab.economy",
  military: "shell.hud.build.tab.military",
  decor: "shell.hud.build.tab.decor",
};

const RES_ICONS: Record<string, string> = {
  meat: "meat",
  wood: "wood",
  stone: "stone",
  metal: "metal",
  mushrooms: "mushroom",
  gold: "gold",
};

/** Цена улучшения Ратуши — копия TH_COSTS модуля (индекс — целевой уровень). */
const TH_COSTS: Record<number, [string, number][]> = {
  2: [["wood", 300], ["stone", 250], ["gold", 50]],
  3: [["wood", 600], ["stone", 500], ["metal", 100], ["gold", 150]],
  4: [["wood", 1200], ["stone", 900], ["metal", 250], ["gold", 400]],
  5: [["wood", 2400], ["stone", 1800], ["metal", 500], ["gold", 1000]],
};
const TH_MAX = 5;

/** Значок постройки: тонкая SVG-пиктограмма в тёплой палитре игры. */
function Sign({ id }: { id: string }) {
  const wood = "#c89a62";
  const dark = "#6b4a2c";
  const roof = "#f0e6d2";
  const stone = "#b9b2a4";
  const gold = "#f0c866";
  const red = "#c25438";
  const common = { width: 40, height: 40, viewBox: "0 0 40 40" } as const;
  switch (id) {
    case "cottage":
      return (
        <svg {...common}>
          <rect x="9" y="18" width="22" height="14" fill={wood} stroke={dark} strokeWidth="1.4" />
          <path d="M6 19 L20 8 L34 19 Z" fill={roof} stroke={dark} strokeWidth="1.4" />
          <rect x="17" y="24" width="6" height="8" fill={dark} />
          <rect x="25" y="10.5" width="4" height="6" fill={stone} />
        </svg>
      );
    case "farm":
      return (
        <svg {...common}>
          <rect x="5" y="22" width="30" height="11" fill="#8a6544" stroke={dark} strokeWidth="1.2" />
          <path d="M7 26 H33 M7 30 H33" stroke="#b08a5c" strokeWidth="1.6" />
          <rect x="8" y="10" width="13" height="11" fill={wood} stroke={dark} strokeWidth="1.4" />
          <path d="M6 11 L14.5 5 L23 11 Z" fill={red} stroke={dark} strokeWidth="1.2" />
        </svg>
      );
    case "sawmill":
      return (
        <svg {...common}>
          <circle cx="27" cy="16" r="7" fill="none" stroke={stone} strokeWidth="2.4" strokeDasharray="3 2.2" />
          <rect x="6" y="22" width="22" height="10" fill={wood} stroke={dark} strokeWidth="1.4" />
          <path d="M6 22 L11 16 L22 16 L28 22 Z" fill={roof} stroke={dark} strokeWidth="1.2" />
          <rect x="5" y="34" width="26" height="3" rx="1.5" fill={dark} />
        </svg>
      );
    case "quarry":
      return (
        <svg {...common}>
          <path d="M5 33 L13 17 L22 26 L28 15 L35 33 Z" fill={stone} stroke={dark} strokeWidth="1.4" />
          <path d="M13 17 L17 25 L10 28 Z" fill="#8f8878" />
          <rect x="24" y="8" width="10" height="3.4" rx="1" fill={dark} transform="rotate(-30 29 10)" />
        </svg>
      );
    case "mine":
      return (
        <svg {...common}>
          <path d="M6 33 Q8 12 20 9 Q32 12 34 33 Z" fill="#6b5a45" stroke={dark} strokeWidth="1.4" />
          <rect x="14" y="23" width="12" height="10" fill="#241a10" />
          <rect x="12.5" y="21.5" width="15" height="3" fill={dark} />
          <rect x="14" y="21.5" width="2.6" height="11.5" fill={dark} />
          <rect x="23.4" y="21.5" width="2.6" height="11.5" fill={dark} />
        </svg>
      );
    case "barracks":
      return (
        <svg {...common}>
          <rect x="6" y="20" width="28" height="13" fill={wood} stroke={dark} strokeWidth="1.4" />
          <path d="M4 21 L20 9 L36 21 Z" fill="#b3402f" stroke={dark} strokeWidth="1.4" />
          <rect x="17" y="25" width="6" height="8" fill={dark} />
          <rect x="30" y="4" width="2" height="10" fill={dark} />
          <path d="M32 5 L37 7 L32 9 Z" fill={red} />
        </svg>
      );
    case "lantern":
      return (
        <svg {...common}>
          <rect x="18.6" y="14" width="2.8" height="20" fill={dark} />
          <rect x="12" y="32" width="16" height="3" rx="1.2" fill={dark} />
          <rect x="14" y="7" width="12" height="9" rx="1.6" fill={gold} stroke={dark} strokeWidth="1.4" />
          <path d="M12.5 7 L20 2.5 L27.5 7 Z" fill={dark} />
        </svg>
      );
    case "bench":
      return (
        <svg {...common}>
          <rect x="7" y="22" width="26" height="3.6" rx="1.4" fill={wood} stroke={dark} strokeWidth="1.2" />
          <rect x="7" y="12" width="26" height="3.6" rx="1.4" fill={wood} stroke={dark} strokeWidth="1.2" />
          <rect x="10" y="14" width="3" height="19" fill={dark} />
          <rect x="27" y="14" width="3" height="19" fill={dark} />
        </svg>
      );
    case "well":
      return (
        <svg {...common}>
          <ellipse cx="20" cy="28" rx="11" ry="6.5" fill={stone} stroke={dark} strokeWidth="1.4" />
          <ellipse cx="20" cy="26" rx="6" ry="3.4" fill="#241a10" />
          <rect x="9" y="8" width="2.6" height="18" fill={dark} />
          <rect x="28.4" y="8" width="2.6" height="18" fill={dark} />
          <path d="M6 9.5 L20 3 L34 9.5 Z" fill={roof} stroke={dark} strokeWidth="1.3" />
        </svg>
      );
    case "flag":
      return (
        <svg {...common}>
          <rect x="17" y="4" width="2.8" height="31" fill={dark} />
          <rect x="10" y="33" width="17" height="3" rx="1.2" fill={dark} />
          <path d="M19.8 6 L33 9.5 L19.8 13 Z" fill={red} stroke={dark} strokeWidth="1" />
        </svg>
      );
    case "road":
      return (
        <svg {...common}>
          <rect x="4" y="15" width="32" height="11" rx="4.5" fill="#7d6444" />
          <circle cx="12" cy="18.6" r="1.8" fill="#b3a17f" />
          <circle cx="20" cy="23" r="2" fill="#9c8767" />
          <circle cx="28" cy="18.2" r="1.7" fill="#a89a82" />
          <circle cx="16" cy="23.6" r="1.4" fill="#8a7a5e" />
          <circle cx="25" cy="21.4" r="1.3" fill="#b3a17f" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <rect x="10" y="16" width="20" height="16" fill={wood} stroke={dark} strokeWidth="1.4" />
        </svg>
      );
  }
}

export function BuildPanel({
  view,
  lang,
  roadTool,
  onPlaceStart,
  onRoadTool,
  onUpgrade,
}: {
  view: WorldViewBase;
  lang: Locale;
  roadTool: boolean;
  onPlaceStart: (type: string) => void;
  onRoadTool: () => void;
  onUpgrade: () => void;
}) {
  const t = translator(lang);
  const [tab, setTab] = useState<BuildTab>("economy");
  const stock = view.stock ?? {};
  const court = (view.modules.court ?? {}) as { townhallLevel?: number };
  const level = Number(court.townhallLevel ?? 1);
  const upCost = TH_COSTS[level + 1];

  return (
    <div className="hud-build" onClick={(e) => e.stopPropagation()}>
      <div className="btabs" role="tablist">
        {TABS.map((id) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
            {t(TAB_KEYS[id])}
          </button>
        ))}
      </div>

      {tab === "economy" ? (
        <button
          type="button"
          className={`th-up${level >= TH_MAX ? " max" : ""}`}
          onClick={onUpgrade}
          disabled={level >= TH_MAX || !upCost?.every(([res, n]) => (stock[res] ?? 0) >= n)}
        >
          <Sign id="cottage" />
          <span className="th-up-text">
            <b>
              {t("shell.hud.b.townhall")} · Ур. {level}
            </b>
            {level >= TH_MAX ? (
              <i>{t("shell.hud.build.max")}</i>
            ) : (
              <i>
                {t("shell.hud.build.up", { n: level + 1 })}:{" "}
                {upCost?.map(([res, n]) => (
                  <em key={res} className={(stock[res] ?? 0) >= n ? "" : "lack"}>
                    <img src={`icons/${RES_ICONS[res]}.png`} alt="" /> {n}
                  </em>
                ))}
              </i>
            )}
          </span>
        </button>
      ) : null}

      {tab === "decor" ? (
        <button type="button" className={`th-up road${roadTool ? " active" : ""}`} onClick={onRoadTool}>
          <Sign id="road" />
          <span className="th-up-text">
            <b>{t("shell.hud.b.road")}</b>
          </span>
        </button>
      ) : null}

      <div className="bcards">
        {CATALOG.filter((item) => item.tab === tab).map((item) => {
          const locked = level < item.th;
          const poor = !locked && !item.cost.every(([res, n]) => (stock[res] ?? 0) >= n);
          return (
            <button
              key={item.id}
              type="button"
              className={`bcard${locked ? " locked" : ""}${poor ? " poor" : ""}`}
              onClick={() => (locked || poor ? undefined : onPlaceStart(item.id))}
            >
              <span className="bic">
                <Sign id={item.id} />
              </span>
              <b>{t(`shell.hud.b.${item.id}`)}</b>
              <span className="bcost">
                {item.cost.map(([res, n]) => (
                  <em key={res} className={locked ? "" : (stock[res] ?? 0) >= n ? "" : "lack"}>
                    <img src={`icons/${RES_ICONS[res]}.png`} alt="" /> {n}
                  </em>
                ))}
              </span>
              {locked ? <span className="blocker">🔒 {t("shell.hud.build.lock", { n: item.th })}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
