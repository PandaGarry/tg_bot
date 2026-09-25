/**
 * Вид пробного модуля. Панель нужна для проверки фундамента: её видно
 * в гнезде sheet, числа приходят из состояния модуля.
 */

import { defineView, type SlotPropsBase } from "@tdl/protocol";
import { strings } from "./strings.js";

interface ProbeState {
  level?: number;
  ticks?: number;
  holderId?: string;
}

function ProbeSheet({ t, module, send, view }: SlotPropsBase) {
  const state = (module<ProbeState>() ?? {}) as ProbeState;
  const dust = view.stock.probe_dust ?? 0;
  return (
    <div className="rounded-lg border border-stone-700 bg-stone-900/80 p-3 text-stone-200">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm text-stone-400">{t("probe.panel.title")}</span>
        <span className="font-mono text-sm">probe_dust {dust}</span>
      </div>
      <div className="mb-3 flex gap-4 text-sm">
        <span>
          {t("probe.panel.level")}: <span className="font-mono">{state.level ?? 0}</span>
        </span>
        <span>
          {t("probe.panel.ticks")}: <span className="font-mono">{state.ticks ?? 0}</span>
        </span>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          className="min-h-[44px] rounded border border-stone-600 px-4 text-sm active:bg-stone-800"
          onClick={() => send("_probe.poke", { steps: 1 })}
        >
          {t("probe.poke")}
        </button>
        <button
          type="button"
          className="min-h-[44px] rounded border border-stone-600 px-4 text-sm active:bg-stone-800"
          onClick={() => send("_probe.hush")}
        >
          {t("probe.hush")}
        </button>
      </div>
    </div>
  );
}

const probeView = defineView({
  id: "_probe",
  strings,
  slots: { sheet: ProbeSheet },
});

export default probeView;
