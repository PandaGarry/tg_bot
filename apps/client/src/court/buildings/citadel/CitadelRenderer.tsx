/**
 * Безопасный рендерер Цитадели R2 (Ossuary Cathedral-Fortress) с двойным откатом:
 * R2 CitadelBuilding -> стабильная резервная v2 CitadelV2Building -> CitadelLegacy.
 * Поддерживает явное переключение `variant="citadel" | "citadel-v2" | "legacy"`.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";
import type { CourtGridLite } from "../../scene/gridMath.js";
import { CitadelBuilding } from "./CitadelBuilding.js";
import { TownHall as LegacyTownHall } from "./CitadelLegacy.js";
import { CitadelV2Building } from "./v2/CitadelV2Building.js";

export type CitadelRenderVariant = "citadel" | "citadel-v2" | "legacy";

interface FallbackBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

interface FallbackBoundaryState {
  failed: boolean;
}

export class CitadelErrorBoundary extends Component<FallbackBoundaryProps, FallbackBoundaryState> {
  override state: FallbackBoundaryState = { failed: false };

  static getDerivedStateFromError(): FallbackBoundaryState {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.warn("[tdl/citadel] visual failed, falling back to stable variant", error, info);
  }

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function CitadelRenderer({
  level = 1,
  grid,
  variant = "citadel",
}: {
  level?: number;
  grid: CourtGridLite;
  variant?: CitadelRenderVariant;
}) {
  const legacy = <LegacyTownHall level={level} grid={grid} />;
  if (variant === "legacy") return legacy;

  const stableV2 = (
    <CitadelErrorBoundary fallback={legacy}>
      <CitadelV2Building level={level} grid={grid} />
    </CitadelErrorBoundary>
  );
  if (variant === "citadel-v2") return stableV2;

  return (
    <CitadelErrorBoundary fallback={stableV2}>
      <CitadelBuilding level={level} grid={grid} />
    </CitadelErrorBoundary>
  );
}
