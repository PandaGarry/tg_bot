/**
 * Процедурные архитектурные и резные геометрии Цитадели (TDL-ARCH-006 v2).
 *
 * Строятся однократно при монтировании, разделяются статическими мешами
 * без пер-кадровых аллокаций и корректно освобождаются при размонтировании
 * (включая React StrictMode).
 */

import { useEffect, useState } from "react";
import * as THREE from "three";

/** Трёхступенчатый готический контрфорс (вылет вдоль +Z, толщина по X, высота 0..1 по Y). */
export function buildSteppedButtressGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(1, 0);
  shape.lineTo(1, 0.28);
  shape.lineTo(0.78, 0.36);
  shape.lineTo(0.78, 0.6);
  shape.lineTo(0.54, 0.7);
  shape.lineTo(0.54, 0.86);
  shape.lineTo(0.28, 0.96);
  shape.lineTo(0, 1);
  shape.closePath();

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: 1,
    bevelEnabled: true,
    bevelThickness: 0.028,
    bevelSize: 0.022,
    bevelSegments: 1,
    curveSegments: 1,
  });
  geom.translate(0, 0, -0.5);
  geom.rotateY(-Math.PI / 2);
  geom.computeVertexNormals();
  return geom;
}

/** Стрельчатая готическая профилированная арка (уступчатый архивольт и оконные рамы). */
export function buildPointedArchFrameGeometry(): THREE.ExtrudeGeometry {
  const outer = new THREE.Shape();
  outer.moveTo(-0.5, 0);
  outer.lineTo(-0.5, 0.64);
  outer.quadraticCurveTo(-0.46, 0.89, 0, 1.05);
  outer.quadraticCurveTo(0.46, 0.89, 0.5, 0.64);
  outer.lineTo(0.5, 0);
  outer.lineTo(0.32, 0);
  outer.lineTo(0.32, 0.6);
  outer.quadraticCurveTo(0.28, 0.78, 0, 0.89);
  outer.quadraticCurveTo(-0.28, 0.78, -0.32, 0.6);
  outer.lineTo(-0.32, 0);
  outer.closePath();

  const geom = new THREE.ExtrudeGeometry(outer, {
    depth: 1,
    bevelEnabled: true,
    bevelThickness: 0.026,
    bevelSize: 0.022,
    bevelSegments: 2,
    curveSegments: 7,
  });
  geom.translate(0, 0, -0.5);
  geom.computeVertexNormals();
  return geom;
}

/** Остроконечный готический щипец-вимперг с резными краббами по скатам. */
export function buildWimpergGeometry(): THREE.ExtrudeGeometry {
  const s = new THREE.Shape();
  s.moveTo(-0.56, 0);
  // левый скат с тремя краббами
  s.lineTo(-0.46, 0.2);
  s.lineTo(-0.52, 0.24);
  s.lineTo(-0.38, 0.36);
  s.lineTo(-0.29, 0.54);
  s.lineTo(-0.35, 0.58);
  s.lineTo(-0.2, 0.72);
  s.lineTo(-0.11, 0.9);
  s.lineTo(-0.15, 0.94);
  s.lineTo(0, 1.12);
  // правый скат симметрично
  s.lineTo(0.15, 0.94);
  s.lineTo(0.11, 0.9);
  s.lineTo(0.2, 0.72);
  s.lineTo(0.35, 0.58);
  s.lineTo(0.29, 0.54);
  s.lineTo(0.38, 0.36);
  s.lineTo(0.52, 0.24);
  s.lineTo(0.46, 0.2);
  s.lineTo(0.56, 0);
  // внутренняя арка проёма вимперга
  s.lineTo(0.4, 0);
  s.lineTo(0, 0.78);
  s.lineTo(-0.4, 0);
  s.closePath();

  const geom = new THREE.ExtrudeGeometry(s, {
    depth: 1,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.015,
    bevelSegments: 1,
    curveSegments: 2,
  });
  geom.translate(0, 0, -0.5);
  geom.computeVertexNormals();
  return geom;
}

/** Ажурный готический трилистник-тимпан (резьба в стрельчатом поле с 3 прорезами). */
export function buildTrefoilTraceryGeometry(): THREE.ExtrudeGeometry {
  const outer = new THREE.Shape();
  outer.moveTo(-0.46, 0);
  outer.quadraticCurveTo(-0.42, 0.56, 0, 0.92);
  outer.quadraticCurveTo(0.42, 0.56, 0.46, 0);
  outer.closePath();

  const addCircleHole = (cx: number, cy: number, r: number) => {
    const hole = new THREE.Path();
    hole.absarc(cx, cy, r, 0, Math.PI * 2, true);
    outer.holes.push(hole);
  };
  addCircleHole(0, 0.54, 0.115);
  addCircleHole(-0.16, 0.22, 0.105);
  addCircleHole(0.16, 0.22, 0.105);

  const geom = new THREE.ExtrudeGeometry(outer, {
    depth: 1,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.014,
    bevelSegments: 1,
    curveSegments: 8,
  });
  geom.translate(0, 0, -0.5);
  geom.computeVertexNormals();
  return geom;
}

/** Фронтонная / щипцовая призма кровли. */
export function buildGableRoofGeometry(): THREE.ExtrudeGeometry {
  const tri = new THREE.Shape();
  tri.moveTo(-0.54, 0);
  tri.lineTo(0.54, 0);
  tri.lineTo(0, 1);
  tri.closePath();

  const geom = new THREE.ExtrudeGeometry(tri, {
    depth: 1,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.015,
    bevelSegments: 1,
    curveSegments: 1,
  });
  geom.translate(0, 0, -0.5);
  geom.computeVertexNormals();
  return geom;
}

/** Ажурный готический аркбутан с прорезной аркой (spandrel hole) внутри пролёта. */
export function buildFlyingButtressGeometry(): THREE.ExtrudeGeometry {
  const arm = new THREE.Shape();
  arm.moveTo(0, 0.04);
  arm.lineTo(0.16, 0);
  arm.quadraticCurveTo(0.58, 0.22, 1, 0.52);
  arm.lineTo(1, 1);
  arm.lineTo(0.82, 1);
  arm.quadraticCurveTo(0.42, 0.68, 0, 0.3);
  arm.closePath();

  const spandrel = new THREE.Path();
  spandrel.moveTo(0.36, 0.24);
  spandrel.quadraticCurveTo(0.62, 0.38, 0.84, 0.56);
  spandrel.lineTo(0.84, 0.78);
  spandrel.quadraticCurveTo(0.58, 0.58, 0.36, 0.4);
  spandrel.closePath();
  arm.holes.push(spandrel);

  const geom = new THREE.ExtrudeGeometry(arm, {
    depth: 1,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.014,
    bevelSegments: 1,
    curveSegments: 6,
  });
  geom.translate(0, 0, -0.5);
  geom.computeVertexNormals();
  return geom;
}

/** Резной готический пинакль с ярусными уступами (LatheGeometry, высота 0..1). */
export function buildPinnacleSpireGeometry(): THREE.LatheGeometry {
  const pts = [
    new THREE.Vector2(0.14, 0.0),
    new THREE.Vector2(0.14, 0.14),
    new THREE.Vector2(0.17, 0.16),
    new THREE.Vector2(0.12, 0.2),
    new THREE.Vector2(0.11, 0.36),
    new THREE.Vector2(0.14, 0.38),
    new THREE.Vector2(0.085, 0.44),
    new THREE.Vector2(0.065, 0.66),
    new THREE.Vector2(0.095, 0.69),
    new THREE.Vector2(0.045, 0.75),
    new THREE.Vector2(0.008, 1.0),
  ];
  const geom = new THREE.LatheGeometry(pts, 4);
  geom.rotateY(Math.PI / 4);
  geom.computeVertexNormals();
  return geom;
}

/** Готический геральдический щит с фаской. */
export function buildHeraldicShieldGeometry(): THREE.ExtrudeGeometry {
  const s = new THREE.Shape();
  s.moveTo(-0.46, 0.5);
  s.lineTo(0.46, 0.5);
  s.lineTo(0.46, 0.04);
  s.quadraticCurveTo(0.4, -0.34, 0, -0.56);
  s.quadraticCurveTo(-0.4, -0.34, -0.46, 0.04);
  s.closePath();

  const geom = new THREE.ExtrudeGeometry(s, {
    depth: 1,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.03,
    bevelSegments: 2,
    curveSegments: 6,
  });
  geom.translate(0, 0, -0.5);
  geom.computeVertexNormals();
  return geom;
}

/** Изогнутая нервюра свода или ребро оссуария (высота 0..1 вдоль +Y, выгиб в +Z). */
export function buildVaultRibGeometry(): THREE.TubeGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0.45),
    new THREE.Vector3(0, 0.35, 0.48),
    new THREE.Vector3(0, 0.75, 0.3),
    new THREE.Vector3(0, 1.0, 0.0),
  ]);
  const geom = new THREE.TubeGeometry(curve, 12, 0.048, 6, false);
  geom.computeVertexNormals();
  return geom;
}

/** Загнутый рог черепа-трофея (от корня в [0,0,0] вверх-в сторону-вперёд). */
export function buildHornTrophyGeometry(): THREE.TubeGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.35, 0.15, 0.08),
    new THREE.Vector3(0.68, 0.46, 0.28),
    new THREE.Vector3(0.55, 0.85, 0.46),
  ]);
  const geom = new THREE.TubeGeometry(curve, 10, 0.11, 6, false);
  geom.computeVertexNormals();
  return geom;
}

/** Вытянутый гранёный некротический кристалл (внешняя филактерия). */
export function buildCrystalGeometry(): THREE.BufferGeometry {
  const g = new THREE.OctahedronGeometry(0.24, 0);
  g.scale(0.74, 1.72, 0.74);
  g.computeVertexNormals();
  return g;
}

/** Внутреннее гранёное ядро некротического кристалла. */
export function buildCrystalCoreGeometry(): THREE.BufferGeometry {
  const g = new THREE.OctahedronGeometry(0.12, 0);
  g.scale(0.65, 1.55, 0.65);
  g.computeVertexNormals();
  return g;
}

export interface CitadelGeometrySet {
  readonly buttress: THREE.ExtrudeGeometry;
  readonly pointedArch: THREE.ExtrudeGeometry;
  readonly wimperg: THREE.ExtrudeGeometry;
  readonly trefoilTracery: THREE.ExtrudeGeometry;
  readonly gableRoof: THREE.ExtrudeGeometry;
  readonly flyingButtress: THREE.ExtrudeGeometry;
  readonly pinnacleSpire: THREE.LatheGeometry;
  readonly heraldicShield: THREE.ExtrudeGeometry;
  readonly vaultRib: THREE.TubeGeometry;
  readonly hornTrophy: THREE.TubeGeometry;
  readonly crystal: THREE.BufferGeometry;
  readonly crystalCore: THREE.BufferGeometry;
}

export function createCitadelGeometrySet(): CitadelGeometrySet {
  return {
    buttress: buildSteppedButtressGeometry(),
    pointedArch: buildPointedArchFrameGeometry(),
    wimperg: buildWimpergGeometry(),
    trefoilTracery: buildTrefoilTraceryGeometry(),
    gableRoof: buildGableRoofGeometry(),
    flyingButtress: buildFlyingButtressGeometry(),
    pinnacleSpire: buildPinnacleSpireGeometry(),
    heraldicShield: buildHeraldicShieldGeometry(),
    vaultRib: buildVaultRibGeometry(),
    hornTrophy: buildHornTrophyGeometry(),
    crystal: buildCrystalGeometry(),
    crystalCore: buildCrystalCoreGeometry(),
  };
}

export function disposeCitadelGeometrySet(set: CitadelGeometrySet): void {
  const items = Object.values(set) as THREE.BufferGeometry[];
  for (const g of items) {
    g.userData.__tdlDisposed = true;
    g.dispose();
  }
}

export function useCitadelGeometrySet(): CitadelGeometrySet {
  const [set, setGeoms] = useState<CitadelGeometrySet>(() => createCitadelGeometrySet());

  useEffect(() => {
    let active = set;
    if ((Object.values(active) as THREE.BufferGeometry[]).some((g) => g.userData.__tdlDisposed)) {
      active = createCitadelGeometrySet();
      setGeoms(active);
    }
    return () => {
      disposeCitadelGeometrySet(active);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return set;
}
