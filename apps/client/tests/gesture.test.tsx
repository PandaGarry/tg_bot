import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { centerOfBuilding, footprintKeys, sizeFor, worldToCell, gridToWorld } from "../src/court/grid";
import {
  TOUCH,
  edgeScroll,
  fits,
  liftFor,
  pickBuilding,
  rectContains,
  rectOf,
  slopFor,
  twistDelta,
  type PickBody,
} from "../src/court/touch/gesture";
import { CELL } from "../src/court/skin/kit";

describe("пороги касания", () => {
  it("палец прощает больший сдвиг, чем мышь, и поднимает призрак над собой", () => {
    expect(slopFor("touch")).toBe(TOUCH.slop);
    expect(slopFor("mouse")).toBeLessThan(slopFor("touch"));
    expect(liftFor("touch")).toBe(TOUCH.lift);
    expect(liftFor("mouse")).toBe(0);
  });
});

describe("пятно и поворот", () => {
  it("нечётный поворот меняет ширину и глубину местами", () => {
    expect(sizeFor("bench", 0)).toEqual([2, 1]);
    expect(sizeFor("bench", 1)).toEqual([1, 2]);
    expect(sizeFor("bench", 2)).toEqual([2, 1]);
    expect(sizeFor("townhall", 1)).toEqual([3, 3]);
  });

  it("прямоугольник клеток совпадает с правилом сервера", () => {
    expect(rectOf(5, 5, [3, 3])).toEqual({ x0: 4, z0: 4, x1: 6, z1: 6 });
    expect(rectOf(5, 5, [2, 2])).toEqual({ x0: 4, z0: 4, x1: 5, z1: 5 });
    expect(rectOf(5, 5, [2, 1])).toEqual({ x0: 4, z0: 5, x1: 5, z1: 5 });
    expect(rectOf(5, 5, [1, 2])).toEqual({ x0: 5, z0: 4, x1: 5, z1: 5 });
  });

  it("занятые клетки учитывают поворот скамьи", () => {
    const grid = { size: 14, roads: [], buildings: [{ type: "bench", x: 3, z: 3, rot: 1 }] };
    expect([...footprintKeys(grid)].sort()).toEqual(["3:2", "3:3"]);
  });

  it("клетка в мир и обратно", () => {
    for (const c of [0, 3, 7, 13]) expect(worldToCell(gridToWorld(c, 14), gridToWorld(c, 14), 14)).toEqual({ x: c, z: c });
  });
});

describe("призрак и сетка", () => {
  const none = new Set<string>();
  it("не лезет за край, на постройку или дорогу", () => {
    expect(fits(rectOf(3, 3, [2, 2]), 14, none, none)).toBe(true);
    expect(fits(rectOf(0, 0, [2, 2]), 14, none, none)).toBe(false);
    expect(fits(rectOf(13, 13, [2, 2]), 14, none, none)).toBe(true); // 2×2 с якорем у края помещается
    expect(fits(rectOf(13, 13, [3, 3]), 14, none, none)).toBe(false);
    expect(fits(rectOf(3, 3, [2, 2]), 14, new Set(["3:3"]), none)).toBe(false);
    expect(fits(rectOf(3, 3, [2, 2]), 14, none, new Set(["2:2"]))).toBe(false);
  });

  it("палец рядом с призраком берёт его, далеко — нет", () => {
    const r = rectOf(5, 5, [2, 2]);
    expect(rectContains(r, 5, 5, TOUCH.halo)).toBe(true);
    expect(rectContains(r, 6, 5, TOUCH.halo)).toBe(true); // соседняя клетка вплотную
    expect(rectContains(r, 7, 5, TOUCH.halo)).toBe(false);
  });
});

describe("автопрокрутка и поворот двумя пальцами", () => {
  it("у края экрана едем, в середине стоим", () => {
    expect(edgeScroll(200, 400, 390, 844)).toEqual({ x: 0, y: 0 });
    expect(edgeScroll(2, 400, 390, 844).x).toBeLessThan(-0.9);
    expect(edgeScroll(388, 400, 390, 844).x).toBeGreaterThan(0.9);
    expect(edgeScroll(200, 842, 390, 844).y).toBeGreaterThan(0.9);
  });

  it("поворот по часовой на экране — плюс, обратно — минус", () => {
    const a0 = { x: 100, y: 100 };
    const b0 = { x: 200, y: 100 };
    const cw = twistDelta(a0, b0, a0, { x: 200, y: 150 });
    const ccw = twistDelta(a0, b0, a0, { x: 200, y: 50 });
    expect(cw).toBeGreaterThan(0.3);
    expect(ccw).toBeLessThan(-0.3);
    expect(twistDelta(a0, b0, a0, b0)).toBe(0);
  });
});

describe("попадание в здание лучом", () => {
  const size = 14;
  const bodies: PickBody[] = [
    { type: "townhall", x: 7, z: 7, rot: 0, height: 4 },
    { type: "cottage", x: 3, z: 10, rot: 0, height: 1.9 },
  ];
  const centerOf = (b: PickBody) => centerOfBuilding(b, size);

  // камера, как в игре: сверху-сбоку, смотрит на центр двора
  const camera = new THREE.PerspectiveCamera(40, 390 / 844, 3.5, 140);
  camera.position.set(17, 16, 17);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const caster = new THREE.Raycaster();
  const rayTo = (world: THREE.Vector3) => {
    const ndc = world.clone().project(camera);
    caster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
    return caster.ray;
  };

  it("тап по крыше выбирает здание, а не землю за ним", () => {
    const c = centerOfBuilding(bodies[0]!, size);
    const roof = rayTo(new THREE.Vector3(c.wx, 3.8, c.wz));
    expect(pickBuilding(roof, bodies, centerOf, sizeFor, CELL)?.type).toBe("townhall");
    // та же точка экрана, но по земле, лежит за зданием: плоскость земли дала бы чужую клетку
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.2);
    const onGround = roof.intersectPlane(ground, new THREE.Vector3())!;
    const cell = worldToCell(onGround.x, onGround.z, size);
    expect(cell.x === 7 && cell.z === 7).toBe(false);
  });

  it("пустое место и дальнее здание не выбираются", () => {
    const empty = rayTo(new THREE.Vector3(gridToWorld(11, size), 0.2, gridToWorld(2, size)));
    expect(pickBuilding(empty, bodies, centerOf, sizeFor, CELL)).toBeNull();
    const c = centerOfBuilding(bodies[1]!, size);
    const hit = rayTo(new THREE.Vector3(c.wx, 1, c.wz));
    expect(pickBuilding(hit, bodies, centerOf, sizeFor, CELL)?.type).toBe("cottage");
  });
});
