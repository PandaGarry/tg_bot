/**
 * Процедурные архитектурные геометрии Цитадели TDL-ARCH-006 R2 (Ossuary Cathedral-Fortress).
 *
 * Строятся однократно на монтировании, разделяются статическими мешами
 * без пер-кадровых аллокаций и строго освобождаются при размонтировании (в т.ч. StrictMode).
 */

import { useEffect, useState } from "react";
import * as THREE from "three";

/** Трёхступенчатый готический контрфорс (вылет вдоль +Z, толщина по X, высота 0..1 по Y). */
export function buildSteppedButtressGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(1, 0);
  shape.lineTo(1, 0.30);
  shape.lineTo(0.78, 0.38);
  shape.lineTo(0.78, 0.64);
  shape.lineTo(0.54, 0.74);
  shape.lineTo(0.54, 0.88);
  shape.lineTo(0.24, 0.96);
  shape.lineTo(0, 1);
  shape.closePath();

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: 1,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.02,
    bevelSegments: 1,
    curveSegments: 1,
  });
  geom.translate(0, 0, -0.5);
  geom.rotateY(-Math.PI / 2);
  geom.computeVertexNormals();
  return geom;
}

/** Профилированная стрельчатая арка (уступчатые архивольты портала и готические рамы). */
export function buildPointedArchFrameGeometry(): THREE.ExtrudeGeometry {
  const outer = new THREE.Shape();
  outer.moveTo(-0.5, 0);
  outer.lineTo(-0.5, 0.62);
  outer.quadraticCurveTo(-0.46, 0.90, 0, 1.06);
  outer.quadraticCurveTo(0.46, 0.90, 0.5, 0.62);
  outer.lineTo(0.5, 0);
  outer.lineTo(0.32, 0);
  outer.lineTo(0.32, 0.58);
  outer.quadraticCurveTo(0.28, 0.78, 0, 0.90);
  outer.quadraticCurveTo(-0.28, 0.78, -0.32, 0.58);
  outer.lineTo(-0.32, 0);
  outer.closePath();

  const geom = new THREE.ExtrudeGeometry(outer, {
    depth: 1,
    bevelEnabled: true,
    bevelThickness: 0.024,
    bevelSize: 0.02,
    bevelSegments: 2,
    curveSegments: 7,
  });
  geom.translate(0, 0, -0.5);
  geom.computeVertexNormals();
  return geom;
}

/** Призма двускатной кровли/щипца (ширина 1.08 по X, высота 0..1 по Y, глубина 1 по Z). */
export function buildGableRoofGeometry(): THREE.ExtrudeGeometry {
  const tri = new THREE.Shape();
  tri.moveTo(-0.54, 0);
  tri.lineTo(0.54, 0);
  tri.lineTo(0, 1);
  tri.closePath();

  const geom = new THREE.ExtrudeGeometry(tri, {
    depth: 1,
    bevelEnabled: true,
    bevelThickness: 0.018,
    bevelSize: 0.014,
    bevelSegments: 1,
    curveSegments: 1,
  });
  geom.translate(0, 0, -0.5);
  geom.computeVertexNormals();
  return geom;
}

/** Односкатный клин бокового нефа/придела (опирается левым высоким краем на главный неф). */
export function buildLeanToRoofGeometry(): THREE.ExtrudeGeometry {
  const s = new THREE.Shape();
  s.moveTo(-0.5, 0);
  s.lineTo(0.52, 0);
  s.lineTo(-0.5, 1);
  s.closePath();

  const geom = new THREE.ExtrudeGeometry(s, {
    depth: 1,
    bevelEnabled: true,
    bevelThickness: 0.018,
    bevelSize: 0.012,
    bevelSegments: 1,
    curveSegments: 1,
  });
  geom.translate(0, 0, -0.5);
  geom.computeVertexNormals();
  return geom;
}

/** Мощный аркбутан-связка от башни-реликвария к своду центрального нефа (X: 0..1, Y: 0..1). */
export function buildFlyingButtressGeometry(): THREE.ExtrudeGeometry {
  const arm = new THREE.Shape();
  arm.moveTo(0, 0.22);
  arm.quadraticCurveTo(0.45, 0.64, 1, 0.96);
  arm.lineTo(1, 0.68);
  arm.quadraticCurveTo(0.52, 0.36, 0, 0);
  arm.closePath();

  const geom = new THREE.ExtrudeGeometry(arm, {
    depth: 1,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.015,
    bevelSegments: 1,
    curveSegments: 6,
  });
  geom.translate(0, 0, -0.5);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Единичное скульптурное ребро-клык Broken Ossuary Crown (вытянуто вверх вдоль +Y: 0..1,
 * выгиб в +Z от основания 0.36 к наружной дуге 0.56 и острое заужение внутрь к 0.22).
 */
export function buildCrownRibGeometry(): THREE.ExtrudeGeometry {
  const s = new THREE.Shape();
  s.moveTo(0.24, 0.0);
  s.lineTo(0.42, 0.0);
  s.quadraticCurveTo(0.58, 0.28, 0.50, 0.58);
  s.quadraticCurveTo(0.40, 0.84, 0.20, 1.0);
  s.quadraticCurveTo(0.28, 0.78, 0.31, 0.52);
  s.quadraticCurveTo(0.32, 0.24, 0.24, 0.0);
  s.closePath();

  const geom = new THREE.ExtrudeGeometry(s, {
    depth: 0.14,
    bevelEnabled: true,
    bevelThickness: 0.016,
    bevelSize: 0.012,
    bevelSegments: 1,
    curveSegments: 8,
  });
  geom.translate(0, 0, -0.07);
  geom.rotateY(-Math.PI / 2); // после поворота выгиб идёт вперёд вдоль +Z
  geom.computeVertexNormals();
  return geom;
}

/**
 * Барельеф/горельеф символа Broken Ossuary Crown для портала и геральдики (в плоскости XY):
 * два изогнутых боковых костяных ребра вокруг узкого центрального провала.
 * Центральная вертикальная железная ость накладывается поверх отдельным мешем.
 */
export function buildBrokenCrownEmblemGeometry(): THREE.ExtrudeGeometry {
  const s = new THREE.Shape();
  // левое восходящее ребро-клык
  s.moveTo(-0.44, -0.18);
  s.quadraticCurveTo(-0.48, 0.18, -0.28, 0.44);
  s.quadraticCurveTo(-0.30, 0.12, -0.22, -0.16);
  s.closePath();

  const geom = new THREE.ExtrudeGeometry(s, {
    depth: 0.18,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.012,
    bevelSegments: 1,
    curveSegments: 6,
  });
  geom.translate(0, 0, -0.09);
  geom.computeVertexNormals();
  return geom;
}

/** Пинакль / вершина контрфорса. */
export function buildPinnacleSpireGeometry(): THREE.LatheGeometry {
  const pts = [
    new THREE.Vector2(0.14, 0.0),
    new THREE.Vector2(0.14, 0.18),
    new THREE.Vector2(0.16, 0.22),
    new THREE.Vector2(0.10, 0.26),
    new THREE.Vector2(0.08, 0.56),
    new THREE.Vector2(0.11, 0.60),
    new THREE.Vector2(0.05, 0.66),
    new THREE.Vector2(0.008, 1.0),
  ];
  const geom = new THREE.LatheGeometry(pts, 4);
  geom.rotateY(Math.PI / 4);
  geom.computeVertexNormals();
  return geom;
}

/** Готический геральдический щит ордена. */
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
    bevelThickness: 0.035,
    bevelSize: 0.025,
    bevelSegments: 2,
    curveSegments: 6,
  });
  geom.translate(0, 0, -0.5);
  geom.computeVertexNormals();
  return geom;
}

/** Ажурный готический трилистник-тимпан (резная ниша портала). */
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

/** Остроконечный щипец над вратами (без лишних зубцов-краббов: строгая крепостная кромка). */
export function buildWimpergGeometry(): THREE.ExtrudeGeometry {
  const s = new THREE.Shape();
  s.moveTo(-0.56, 0);
  s.lineTo(-0.12, 0.88);
  s.lineTo(0, 1.08);
  s.lineTo(0.12, 0.88);
  s.lineTo(0.56, 0);
  s.lineTo(0.38, 0);
  s.lineTo(0, 0.74);
  s.lineTo(-0.38, 0);
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

/** Вытянутый гранёный некротический кристалл. */
export function buildCrystalGeometry(): THREE.BufferGeometry {
  const g = new THREE.OctahedronGeometry(0.24, 0);
  g.scale(0.72, 1.78, 0.72);
  g.computeVertexNormals();
  return g;
}

/** Внутреннее гранёное ядро кристалла. */
export function buildCrystalCoreGeometry(): THREE.BufferGeometry {
  const g = new THREE.OctahedronGeometry(0.12, 0);
  g.scale(0.62, 1.56, 0.62);
  g.computeVertexNormals();
  return g;
}

export interface CitadelGeometrySet {
  readonly buttress: THREE.ExtrudeGeometry;
  readonly pointedArch: THREE.ExtrudeGeometry;
  readonly gableRoof: THREE.ExtrudeGeometry;
  readonly leanToRoof: THREE.ExtrudeGeometry;
  readonly flyingButtress: THREE.ExtrudeGeometry;
  readonly crownRib: THREE.ExtrudeGeometry;
  readonly brokenCrownEmblem: THREE.ExtrudeGeometry;
  readonly pinnacleSpire: THREE.LatheGeometry;
  readonly heraldicShield: THREE.ExtrudeGeometry;
  readonly trefoilTracery: THREE.ExtrudeGeometry;
  readonly wimperg: THREE.ExtrudeGeometry;
  readonly crystal: THREE.BufferGeometry;
  readonly crystalCore: THREE.BufferGeometry;
}

export function createCitadelGeometrySet(): CitadelGeometrySet {
  return {
    buttress: buildSteppedButtressGeometry(),
    pointedArch: buildPointedArchFrameGeometry(),
    gableRoof: buildGableRoofGeometry(),
    leanToRoof: buildLeanToRoofGeometry(),
    flyingButtress: buildFlyingButtressGeometry(),
    crownRib: buildCrownRibGeometry(),
    brokenCrownEmblem: buildBrokenCrownEmblemGeometry(),
    pinnacleSpire: buildPinnacleSpireGeometry(),
    heraldicShield: buildHeraldicShieldGeometry(),
    trefoilTracery: buildTrefoilTraceryGeometry(),
    wimperg: buildWimpergGeometry(),
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
