/**
 * Безопасный рендерер Цитадели с откатом на CitadelLegacy при сбое
 * или при явном переключении варианта (`variant="legacy"`).
 */

import { Component, type ErrorInfo, type ReactNode } from "react";
import type { CourtGridLite } from "../../scene/gridMath.js";
import { CitadelBuilding } from "./CitadelBuilding.js";
import { TownHall as LegacyTownHall } from "./CitadelLegacy.js";

export type CitadelRenderVariant = "citadel" | "legacy";

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
    console.warn("[tdl/citadel] visual failed, falling back to legacy TownHall", error, info);
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

  return (
    <CitadelErrorBoundary fallback={legacy}>
      <CitadelBuilding level={level} grid={grid} />
    </CitadelErrorBoundary>
  );
}
