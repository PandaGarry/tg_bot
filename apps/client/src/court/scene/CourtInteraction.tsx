/**
 * Сетка режима стройки и привязка ввода двора поверх чистого контроллера
 * courtInput.ts и математики gridMath.ts (PR #28).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { ACCENT_COLORS } from "../materials/palette.js";
import {
  getGhostBoxMaterialSpec,
  getGhostPlaneMaterialSpec,
  INTERACTION_MATERIALS,
} from "../materials/MaterialRegistry.js";
import { createCourtInputController } from "./courtInput.js";
import {
  buildingAt,
  CELL,
  footprintCenterToWorld,
  footprintKeys,
  footprintSize,
  isFootprintFree,
  worldToCell,
  type CourtGridLite,
} from "./gridMath.js";

export type CourtTool = { kind: "place"; type: string } | { kind: "road" } | null;

export interface CourtPending {
  type: string;
  x: number;
  z: number;
  from?: { x: number; z: number };
}

function buildGridGeometry(size: number): THREE.BufferGeometry {
  const half = (size * CELL) / 2;
  const pts: number[] = [];
  for (let i = 0; i <= size; i++) {
    const p = -half + i * CELL;
    pts.push(p, 0, -half, p, 0, half, -half, 0, p, half, 0, p);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  return g;
}

/** Сетка двора: тонкие тёплые линии поверх площадки — только в режиме стройки. */
function GridOverlay({ size }: { size: number }) {
  const [state, setState] = useState(() => ({ size, geom: buildGridGeometry(size) }));

  useEffect(() => {
    let active = state;
    if (active.size !== size || active.geom.userData.__tdlDisposed) {
      active = { size, geom: buildGridGeometry(size) };
      setState(active);
    }
    return () => {
      active.geom.userData.__tdlDisposed = true;
      active.geom.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  return (
    <lineSegments geometry={state.geom} position-y={0.185} renderOrder={5}>
      <lineBasicMaterial {...INTERACTION_MATERIALS.gridLine} />
    </lineSegments>
  );
}

/**
 * Ввод двора: тап ставит выбранную постройку или двигает подтверждаемую,
 * тап кладёт/убирает плиту дороги, долгое нажатие (0.55 с) поднимает
 * постройку для переноски — включая Ратушу (забор вне сетки и не трогается).
 * Тап отличаем от панорамы порогом 8px.
 */
export function CourtInteraction({
  grid,
  tool,
  pending,
  onTarget,
  onRoad,
  onPickup,
}: {
  grid: CourtGridLite;
  tool: CourtTool;
  pending: CourtPending | null;
  onTarget: (x: number, z: number) => void;
  onRoad: (x: number, z: number, has: boolean) => void;
  onPickup: (type: string, x: number, z: number) => void;
}) {
  const [hover, setHover] = useState<{ x: number; z: number } | null>(null);
  const size = grid.size;

  const roads = useMemo(() => new Set(grid.roads.map((r) => `${r.x}:${r.z}`)), [grid]);
  const busy = useMemo(() => footprintKeys(grid, pending?.from), [grid, pending]);
  const activeType = pending?.type ?? (tool?.kind === "place" ? tool.type : "");
  const [viewW, viewH] = footprintSize(activeType);

  const free = (gx: number, gz: number): boolean =>
    isFootprintFree({ size, type: activeType, gx, gz, busy, roads });

  const centerOf = (cell: { x: number; z: number }) =>
    footprintCenterToWorld(activeType, cell.x, cell.z, size);

  const handlersRef = useRef({
    onHold: (_cell: { x: number; z: number }) => false as boolean,
    onTap: (_cell: { x: number; z: number }) => {},
  });
  handlersRef.current = {
    onHold: (cell) => {
      if (pending || tool) return false;
      const hit = buildingAt(grid, cell.x, cell.z);
      if (hit) {
        onPickup(hit.type, hit.x, hit.z);
        return true;
      }
      // на постройке пусто — может, это плита дороги
      if (roads.has(`${cell.x}:${cell.z}`)) {
        onPickup("road", cell.x, cell.z);
        return true;
      }
      return false;
    },
    onTap: (cell) => {
      if (pending) {
        if (free(cell.x, cell.z)) onTarget(cell.x, cell.z);
      } else if (tool?.kind === "place") {
        if (free(cell.x, cell.z)) onTarget(cell.x, cell.z);
      } else if (tool?.kind === "road") {
        onRoad(cell.x, cell.z, roads.has(`${cell.x}:${cell.z}`));
      }
    },
  };

  const controller = useMemo(
    () =>
      createCourtInputController({
        onHold: (cell) => handlersRef.current.onHold(cell),
        onTap: (cell) => handlersRef.current.onTap(cell),
      }),
    [],
  );

  useEffect(() => {
    const onWindowDown = (ev: PointerEvent) => {
      if (ev.button !== 0) {
        controller.cancelAll();
        return;
      }
      controller.onGlobalPointerDown(ev.pointerId);
    };
    const onWindowUp = (ev: PointerEvent) => {
      if (ev.button !== 0) return;
      controller.onGlobalPointerEnd(ev.pointerId);
    };
    const onWindowCancel = (ev: PointerEvent) => {
      controller.onPointerCancel(ev.pointerId);
    };
    const onWindowBlur = () => {
      controller.cancelAll();
    };
    window.addEventListener("pointerdown", onWindowDown);
    window.addEventListener("pointerup", onWindowUp);
    window.addEventListener("pointercancel", onWindowCancel);
    window.addEventListener("blur", onWindowBlur);
    return () => {
      window.removeEventListener("pointerdown", onWindowDown);
      window.removeEventListener("pointerup", onWindowUp);
      window.removeEventListener("pointercancel", onWindowCancel);
      window.removeEventListener("blur", onWindowBlur);
      controller.dispose();
    };
  }, [controller]);

  const ghost = pending
    ? { valid: true, ...centerOf(pending) }
    : hover && tool?.kind === "place"
      ? { valid: free(hover.x, hover.z), ...centerOf(hover) }
      : null;
  const ghostColor = pending
    ? ACCENT_COLORS.ghostPending
    : ghost?.valid
      ? ACCENT_COLORS.ghostValid
      : ACCENT_COLORS.ghostInvalid;

  return (
    <group>
      {tool || pending ? <GridOverlay size={size} /> : null}
      <mesh
        rotation-x={-Math.PI / 2}
        position-y={0.22}
        onPointerMove={(e) => {
          controller.onPointerMove({
            pointerId: e.nativeEvent.pointerId,
            buttons: e.nativeEvent.buttons,
            clientX: e.nativeEvent.clientX,
            clientY: e.nativeEvent.clientY,
          });
          setHover(worldToCell(e.point.x, e.point.z, size));
        }}
        onPointerDown={(e) => {
          const cell = worldToCell(e.point.x, e.point.z, size);
          controller.onPointerDown({
            pointerId: e.nativeEvent.pointerId,
            button: e.nativeEvent.button,
            buttons: e.nativeEvent.buttons,
            pointerType: e.nativeEvent.pointerType,
            clientX: e.nativeEvent.clientX,
            clientY: e.nativeEvent.clientY,
            cell,
          });
        }}
        onPointerUp={(e) => {
          const cell = worldToCell(e.point.x, e.point.z, size);
          controller.onPointerUp({
            pointerId: e.nativeEvent.pointerId,
            button: e.nativeEvent.button,
            clientX: e.nativeEvent.clientX,
            clientY: e.nativeEvent.clientY,
            cell,
          });
        }}
        onPointerCancel={(e) => {
          controller.onPointerCancel(e.nativeEvent.pointerId);
        }}
        onPointerLeave={(e) => {
          controller.onPointerLeave(e.nativeEvent.pointerId);
        }}
      >
        <planeGeometry args={[size * CELL, size * CELL]} />
        <meshBasicMaterial {...INTERACTION_MATERIALS.raycastHidden} />
      </mesh>
      {ghost ? (
        <group position={[ghost.wx, 0.2, ghost.wz]}>
          <mesh rotation-x={-Math.PI / 2}>
            <planeGeometry args={[viewW * CELL - 0.08, viewH * CELL - 0.08]} />
            <meshBasicMaterial {...getGhostPlaneMaterialSpec(ghostColor)} />
          </mesh>
          <mesh position-y={0.5}>
            <boxGeometry args={[viewW * CELL - 0.2, 1.0, viewH * CELL - 0.2]} />
            <meshBasicMaterial {...getGhostBoxMaterialSpec(ghostColor)} />
          </mesh>
        </group>
      ) : null}
    </group>
  );
}
