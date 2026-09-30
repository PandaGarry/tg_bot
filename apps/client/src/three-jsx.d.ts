/**
 * Ручная регистрация JSX-элементов three.js для @react-three/fiber v9:
 * своя копия расширения, потому что встроенное в пакет не подхватывается
 * при react 19.3 (fiber просит <19.3). Форма — из документации fiber.
 */

import type { ThreeElements } from "@react-three/fiber";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}

declare module "react/jsx-runtime" {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}

declare module "react/jsx-dev-runtime" {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}
