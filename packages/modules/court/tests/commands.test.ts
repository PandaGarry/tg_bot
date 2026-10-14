import { describe, expect, it } from "vitest";
import court from "../src/module.js";

type Handler = (ctx: Record<string, unknown>, input: Record<string, unknown>) => unknown[];
const cmd = (id: string): Handler => {
  const found = (court as unknown as { server: { commands: { id: string; handle: Handler }[] } }).server.commands.find(
    (c) => c.id === id,
  );
  if (!found) throw new Error(`нет команды ${id}`);
  return found.handle;
};

/** Состояние двора в формате снимка модуля (v2). */
function state(level: number, buildings: { type: string; x: number; z: number }[], size = 10) {
  return {
    starter: 1,
    townhallLevel: level,
    grid: { size, buildings, roads: [], v: 2 },
  };
}

function ctxOf(st: unknown, stock: Record<string, number>) {
  return { actor: { id: "h1" }, now: 1000, state: st, stock, facts: {}, world: {} };
}

/** Патч с сеткой из эффектов команды (первый patch актёра). */
function gridOf(effects: unknown[]): { size: number; buildings: { type: string; x: number; z: number }[] } | null {
  for (const e of effects as { kind?: string; ops?: { path: string; value: unknown }[] }[]) {
    if (e.kind !== "patch") continue;
    const op = e.ops?.find((o) => o.path === "modules.court.grid");
    if (op) return op.value as never;
  }
  return null;
}

describe("court.place", () => {
  it("на старте ставит одну лесопилку бесплатно и отдаёт сетку с ней", () => {
    const effects = cmd("court.place")(ctxOf(state(1, [{ type: "citadel", x: 5, z: 5 }]), {}), {
      type: "sawmill",
      x: 2,
      z: 2,
    });
    expect(effects.length).toBeGreaterThan(0);
    const grid = gridOf(effects)!;
    expect(grid.buildings.map((b) => b.type)).toEqual(["citadel", "sawmill"]);
  });

  it("вторую лесопилку на Цитадели 1 не ставит: открыта одна", () => {
    const st = state(1, [
      { type: "citadel", x: 5, z: 5 },
      { type: "sawmill", x: 2, z: 2 },
    ]);
    expect(cmd("court.place")(ctxOf(st, {}), { type: "sawmill", x: 7, z: 2 })).toEqual([]);
  });

  it("здание не выходит за край сетки", () => {
    // стена 3×3 с якорем в углу не помещается
    expect(cmd("court.place")(ctxOf(state(2, [{ type: "citadel", x: 5, z: 5 }]), {}), { type: "wall", x: 0, z: 0 })).toEqual([]);
  });

  it("не ставит на Цитадель и на дорогу", () => {
    const st = state(2, [{ type: "citadel", x: 5, z: 5 }]);
    expect(cmd("court.place")(ctxOf(st, {}), { type: "wall", x: 4, z: 4 })).toEqual([]);
  });

  it("Таверна не ставится, пока не назначена стоимость", () => {
    expect(cmd("court.place")(ctxOf(state(3, [{ type: "citadel", x: 5, z: 5 }]), {}), { type: "tavern", x: 1, z: 1 })).toEqual([]);
  });
});

describe("court.upgrade (Цитадель)", () => {
  it("уровень 1 → 2 списывает 310 дерева и не меняет сетку на полосе 10×10", () => {
    const effects = cmd("court.upgrade")(ctxOf(state(1, [{ type: "citadel", x: 5, z: 5 }]), { wood: 1000 }), {});
    const patch = (effects as { kind?: string; ops?: { path: string; value: unknown }[] }[]).find((e) => e.kind === "patch")!;
    expect(patch.ops!.find((o) => o.path === "modules.court.townhallLevel")!.value).toBe(2);
    expect(patch.ops!.find((o) => o.path === "stock.wood")!.value).toBe(-310);
    expect(gridOf(effects)!.size).toBe(10);
  });

  it("без ресурсов не улучшает", () => {
    expect(cmd("court.upgrade")(ctxOf(state(1, [{ type: "citadel", x: 5, z: 5 }]), { wood: 100 }), {})).toEqual([]);
  });

  it("уровень 3 растит сетку до 12×12", () => {
    const effects = cmd("court.upgrade")(
      ctxOf(state(2, [{ type: "citadel", x: 5, z: 5 }]), { wood: 1e9, stone: 1e9, metal: 1e9 }),
      {},
    );
    expect(gridOf(effects)!.size).toBe(12);
  });
});

describe("court.remove", () => {
  it("Цитадель и здания не убираются, декор — да", () => {
    const st = state(2, [
      { type: "citadel", x: 5, z: 5 },
      { type: "lantern", x: 1, z: 1 },
    ]);
    expect(cmd("court.remove")(ctxOf(st, {}), { type: "citadel", x: 5, z: 5 })).toEqual([]);
    const effects = cmd("court.remove")(ctxOf(st, {}), { type: "lantern", x: 1, z: 1 });
    expect(gridOf(effects)!.buildings.map((b) => b.type)).toEqual(["citadel"]);
  });
});

describe("старый формат сетки", () => {
  it("сохранённый двор без версии 2 сбрасывается: уровень Цитадели 1, улучшение — до 2", () => {
    const legacy = {
      starter: 1,
      townhallLevel: 3,
      grid: { size: 14, buildings: [{ type: "townhall", x: 7, z: 7 }], roads: [] },
    };
    const effects = cmd("court.upgrade")(ctxOf(legacy, { wood: 1e9, stone: 1e9 }), {});
    const patch = (effects as { kind?: string; ops?: { path: string; value: unknown }[] }[]).find((e) => e.kind === "patch")!;
    expect(patch.ops!.find((o) => o.path === "modules.court.townhallLevel")!.value).toBe(2);
  });
});
