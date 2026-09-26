/**
 * Создание лорда: имя, портрет, знамя, тип. Не конструктор лица.
 * Восемь голов, шесть знаков, восемь цветов.
 */

import { useState } from "react";
import type { JsonValue, Locale, SlotId } from "@tdl/protocol";
import { createLord } from "../net.js";
import { statusKey, translator } from "../i18n/index.js";
import { store } from "../store.js";
import { Slot, hasSlot } from "../slots.js";
import type { WorldViewBase } from "@tdl/protocol";

const PORTRAITS = ["portrait-1", "portrait-2", "portrait-3", "portrait-4", "portrait-5", "portrait-6", "portrait-7", "portrait-8"];
const SIGNS = ["skull", "bell", "tooth", "hand", "tower", "mushroom"];
const COLORS = ["bone", "moss", "ash", "blood", "iron", "wheat", "night", "rust"];
const TYPES = ["flesh", "bone", "spore"] as const;

export function Create({
  lang,
  view,
  serverNow,
}: {
  lang: Locale;
  view: WorldViewBase | null;
  serverNow: number;
}) {
  const t = translator(lang);
  const [name, setName] = useState("");
  const [portrait, setPortrait] = useState(PORTRAITS[0] as string);
  const [sign, setSign] = useState(SIGNS[0] as string);
  const [color, setColor] = useState(COLORS[0] as string);
  const [type, setType] = useState<(typeof TYPES)[number]>("flesh");
  const nameOk = name.trim().length >= 2 && name.trim().length <= 18;

  const worldView: WorldViewBase = view ?? {
    world: { id: "world-1", name: "", size: 0, zones: 0, zonePit: 0, zoneCapital: 0, now: serverNow, downtimeMs: 0 },
    me: null,
    stock: {},
    modules: {},
  };

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-xl flex-col gap-4 p-4 pb-[env(safe-area-inset-bottom)]">
      <h1 className="text-xl text-bone">{t("shell.create.title")}</h1>

      <Slot
        slot={"creation.steps" as SlotId}
        view={worldView}
        lang={lang}
        serverNow={serverNow}
        empty={hasSlot("creation.steps" as SlotId) ? null : undefined}
      />

      <label className="flex flex-col gap-1 text-sm text-stone-400">
        {t("shell.create.name")}
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={18}
          className="min-h-[44px] rounded border border-stone-700 bg-stone-900 px-3 text-bone outline-none focus:border-stone-500"
        />
      </label>

      <Group title={t("shell.create.portrait")}>
        {PORTRAITS.map((item, index) => (
          <Choice key={item} active={portrait === item} onClick={() => setPortrait(item)}>
            <span className="text-xs">{index + 1}</span>
          </Choice>
        ))}
      </Group>

      <Group title={t("shell.create.banner")}>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {SIGNS.map((item) => (
              <Choice key={item} active={sign === item} onClick={() => setSign(item)}>
                <span className="text-xs uppercase">{item}</span>
              </Choice>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((item) => (
              <Choice key={item} active={color === item} onClick={() => setColor(item)}>
                <span className="h-5 w-5 rounded-full" style={{ background: swatch(item) }} />
              </Choice>
            ))}
          </div>
        </div>
      </Group>

      <Group title={t("shell.create.type")}>
        <div className="flex w-full gap-2">
          {TYPES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setType(item)}
              className={`flex min-h-[44px] flex-1 flex-col items-start rounded border p-2 text-left ${
                type === item ? "border-bone text-bone" : "border-stone-700 text-stone-400"
              }`}
            >
              <span className="text-sm">{t(`shell.type.${item}`)}</span>
              <span className="text-[11px] leading-tight opacity-80">{t(`shell.type.${item}.bonus`)}</span>
            </button>
          ))}
        </div>
      </Group>

      <button
        type="button"
        disabled={!nameOk}
        onClick={() => createLord({ name: name.trim(), portrait, bannerSign: sign, bannerColor: color, type })}
        className="min-h-[44px] rounded border border-stone-600 bg-stone-800 text-bone disabled:opacity-40"
      >
        {t("shell.create.take")}
      </button>

      <p className="text-xs text-stone-500">{t(statusKey(store.get().status))}</p>
    </main>
  );
}

function Group({ title, children }: { title: string; children: JsonValue | React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm text-stone-400">{title}</h2>
      {children as React.ReactNode}
    </section>
  );
}

function Choice({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded border px-3 ${
        active ? "border-bone text-bone" : "border-stone-700 text-stone-400"
      }`}
    >
      {children}
    </button>
  );
}

function swatch(name: string): string {
  const table: Record<string, string> = {
    bone: "#d8d2c4",
    moss: "#6b7a4a",
    ash: "#7d7a74",
    blood: "#7a2b28",
    iron: "#4a4f55",
    wheat: "#b08b4f",
    night: "#2b2f3a",
    rust: "#8a4b2a",
  };
  return table[name] ?? "#7d7a74";
}
