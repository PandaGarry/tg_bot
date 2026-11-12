/**
 * Процедурные архитектурные геометрии Цитадели (TDL-ARCH-006).
 *
 * Повторно используемые профили (ступенчатый контрфорс, стрельчатая арка
 * портала, щипцовая/фронтонная кровля, аркбутан 5-го уровня, гранёный
 * кристалл) строятся один раз при монтировании, разделяются статическими
 * мешами без пер-кадровых аллокаций и корректно очищаются при размонтировании
 * (включая двойной цикл React StrictMode).
 */

import { useEffect, useState } from "react";
import * as THREE from "three";

/**
 * Ступенчатый готический контрфорс единичного масштаба:
 * ширина по X = 1 (-0.5..0.5), высота по Y = 1 (0..1), вылет по Z = 1 (0..1 от стены вперёд).
 */
export function buildSteppedButtressGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  // профиль в плоскости (z -> x_shape, y -> y_shape): позже поворачивается вокруг Y на -PI/2
  shape.moveTo(0, 0);
  shape.lineTo(1, 0);
  shape.lineTo(1, 0.34);
  shape.lineTo(0.72, 0.44);
  shape.lineTo(0.72, 0.72);
  shape.lineTo(0.42, 0.84);
  shape.lineTo(0.42, 0.96);
  shape.lineTo(0, 1);
  shape.closePath();

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: 1,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.025,
    bevelSegments: 1,
    curveSegments: 1,
  });
  geom.translate(0, 0, -0.5);
  // повернём так, чтобы вылет шёл вдоль +Z, а толщина по X
  geom.rotateY(-Math.PI / 2);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Стрельчатая готическая рама портала (проём по центру, ширина 1.0, высота 1.0).
 */
export function buildPointedArchFrameGeometry(): THREE.ExtrudeGeometry {
  const outer = new THREE.Shape();
  outer.moveTo(-0.5, 0);
  outer.lineTo(-0.5, 0.68);
  outer.quadraticCurveTo(-0.46, 0.9, 0, 1.04);
  outer.quadraticCurveTo(0.46, 0.9, 0.5, 0.68);
  outer.lineTo(0.5, 0);
  outer.lineTo(0.32, 0);
  outer.lineTo(0.32, 0.62);
  outer.quadraticCurveTo(0.28, 0.78, 0, 0.87);
  outer.quadraticCurveTo(-0.28, 0.78, -0.32, 0.62);
  outer.lineTo(-0.32, 0);
  outer.closePath();

  const geom = new THREE.ExtrudeGeometry(outer, {
    depth: 1,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.02,
    bevelSegments: 1,
    curveSegments: 6,
  });
  geom.translate(0, 0, -0.5);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Фронтонная / щипцовая призма кровли: основание шириной 1 (-0.5..0.5),
 * высота конька 1 (0..1), глубина по Z = 1 (-0.5..0.5).
 */
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

/**
 * Аркбутан 5-го уровня (пролёт от внешней башни к верхнему ярусу донжона):
 * от опоры (x=0, y=0) вверх-внутрь к стене (x=1, y=1).
 */
export function buildFlyingButtressGeometry(): THREE.ExtrudeGeometry {
  const arm = new THREE.Shape();
  arm.moveTo(0, 0.08);
  arm.lineTo(0.14, 0);
  arm.quadraticCurveTo(0.56, 0.45, 1, 0.78);
  arm.lineTo(1, 1);
  arm.lineTo(0.84, 1);
  arm.quadraticCurveTo(0.45, 0.64, 0, 0.28);
  arm.closePath();

  const geom = new THREE.ExtrudeGeometry(arm, {
    depth: 1,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.015,
    bevelSegments: 1,
    curveSegments: 5,
  });
  geom.translate(0, 0, -0.5);
  geom.computeVertexNormals();
  return geom;
}

/** Вытянутый гранёный некротический кристалл. */
export function buildCrystalGeometry(): THREE.BufferGeometry {
  const g = new THREE.OctahedronGeometry(0.24, 0);
  g.scale(0.78, 1.65, 0.78);
  g.computeVertexNormals();
  return g;
}

export interface CitadelGeometrySet {
  readonly buttress: THREE.ExtrudeGeometry;
  readonly pointedArch: THREE.ExtrudeGeometry;
  readonly gableRoof: THREE.ExtrudeGeometry;
  readonly flyingButtress: THREE.ExtrudeGeometry;
  readonly crystal: THREE.BufferGeometry;
}

export function createCitadelGeometrySet(): CitadelGeometrySet {
  return {
    buttress: buildSteppedButtressGeometry(),
    pointedArch: buildPointedArchFrameGeometry(),
    gableRoof: buildGableRoofGeometry(),
    flyingButtress: buildFlyingButtressGeometry(),
    crystal: buildCrystalGeometry(),
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
