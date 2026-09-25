/**
 * Служебная полоса для разработки: связь, эпоха писателя, число патчей
 * и отказов. Игроку такое не показывают — это проверка ядра.
 */

import { useEffect, useState } from "react";
import type { Locale } from "@tdl/protocol";
import { statusKey, translator } from "../i18n/index.js";
import { store } from "../store.js";

interface Health {
  ok: boolean;
  world: string;
  ready: boolean;
  stats: {
    epoch: number;
    pending: number;
    rejections: number;
    modulesEnabled: number;
    seasonRehearsal: { season: string; toMs: number } | null;
  } | null;
}

export function Diagnostics({ lang }: { lang: Locale }) {
  const t = translator(lang);
  const state = store.get();
  const [health, setHealth] = useState<Health | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const response = await fetch("/api/health");
        const data = (await response.json()) as Health;
        if (alive) setHealth(data);
      } catch {
        if (alive) setHealth(null);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  const world = state.view?.world;
  return (
    <section className="mt-4 rounded border border-stone-800 p-2 text-[11px] text-stone-500">
      <button type="button" className="w-full text-left" onClick={() => setOpen((value) => !value)}>
        {t("shell.diag.title")} · {t(statusKey(state.status))} · {t("shell.status.ready")}:{" "}
        {health?.ready ? "да" : "нет"} {open ? "▲" : "▼"}
      </button>
      {open ? (
        <div className="mt-2 flex flex-col gap-1 font-mono">
          <span>
            {t("shell.diag.epoch")}: {health?.stats?.epoch ?? "—"} · модулей: {health?.stats?.modulesEnabled ?? "—"}
          </span>
          <span>
            {t("shell.diag.patches")}: {state.patches} · {t("shell.diag.errors")}: {state.errors.length}
          </span>
          <span>
            {t("shell.diag.world")}: {health?.world ?? "—"}
            {world ? ` (${world.name})` : ""}
          </span>
          <span>
            {t("shell.world.now")}: {world ? new Date(world.now).toISOString().slice(11, 19) : "—"} ·{" "}
            {t("shell.world.downtime")}: {world ? Math.round(world.downtimeMs / 1000) : 0}с
          </span>
          {health?.stats?.seasonRehearsal ? (
            // Примерка: мир живёт не по календарю, и это видно в служебной полосе.
            <span className="text-amber-500">
              {t("shell.diag.rehearsal")}: {health.stats.seasonRehearsal.season}
            </span>
          ) : null}
          {state.errors.slice(0, 5).map((error, index) => (
            <span key={`${error.at}-${index}`} className="text-amber-600">
              {t(error.key, error.params)}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
