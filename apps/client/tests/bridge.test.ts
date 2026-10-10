import { describe, expect, it } from "vitest";
import { bridge } from "../src/game/bridge.js";

describe("bridge — связь Pixi и HUD", () => {
  it("событие доходит до подписчика с полезной нагрузкой", () => {
    const seen: { x: number; z: number }[] = [];
    const off = bridge.on("tile:click", (payload) => seen.push(payload));
    bridge.emit("tile:click", { x: 3, z: 7 });
    bridge.emit("tile:click", { x: 0, z: 0 });
    expect(seen).toEqual([{ x: 3, z: 7 }, { x: 0, z: 0 }]);
    off();
    bridge.emit("tile:click", { x: 9, z: 9 });
    expect(seen).toHaveLength(2);
  });

  it("подписчик одного события не слышит другое", () => {
    const hudActions: { action: string }[] = [];
    const off = bridge.on("hud:action", (payload) => hudActions.push(payload));
    bridge.emit("camera:moved", { x: 1, y: 2, zoom: 1 });
    bridge.emit("state:update", { court: { grid: { size: 14, buildings: [], roads: [] } } });
    expect(hudActions).toEqual([]);
    off();
  });

  it("emit без подписчиков не падает (этапы идут последовательно)", () => {
    expect(() => bridge.emit("building:click", { id: "b1", type: "townhall", x: 7, z: 7 })).not.toThrow();
  });

  it("поздняя Pixi-сцена получает последний снимок двора при подписке", () => {
    const payload = { court: { grid: { size: 14, buildings: [{ type: "townhall", x: 7, z: 7 }], roads: [] } } };
    bridge.emit("state:update", payload);
    const seen: typeof payload[] = [];
    const off = bridge.on("state:update", (state) => seen.push(state));
    expect(seen).toEqual([payload]);
    off();
  });
});
