# TDL-ARCH-004 — Typed Building Registry & Asset Manifest Proposal (`TDL_BUILDING_REGISTRY_PROPOSAL.md`)

> **Task:** `TDL-ARCH-004` (Scope C)  
> **Audited source branch:** `refactor/tdl-asset-pipeline-foundation` (PR #26)  
> **Exact audited source SHA:** `0a5e465ede6096ecdfc33b4771b0761baf327fab`  
> **Arena delivery branch:** `arena/ff89979b-tg-bot` (proposal only; zero production code edited)  
> **Date:** 2026-11-12

---

## 1. Domain Single-Authority Contract & Boundary Rule

At `0a5e465ede6096ecdfc33b4771b0761baf327fab`, gameplay rules live exclusively in `packages/modules/court/src/module.ts`, yet the client currently duplicates them twice:

1. `FOOTVIEW` in `apps/client/src/court/CourtScene.tsx:300-313` duplicates `FOOTPRINT` (`packages/modules/court/src/module.ts:56-59`: `townhall: [3,3]`, 8 buildings `[2,2]`, `bench: [2,1]`, `lantern`/`flag: [1,1]`, plus client-only `road: [1,1]`).
2. `CATALOG` & `TH_COSTS` in `apps/client/src/ui/BuildPanel.tsx:22-60` duplicate `CATALOG` & `TH_COSTS` in `packages/modules/court/src/module.ts:34-70`.

**Boundary constraint (`tools/check/boundaries.ts:89-96`):**  
`apps/client` is **forbidden** from importing `@tdl/module-court` directly (`pnpm check` fails if a client file imports any workspace module package directly).  
Therefore, the client registry **must read authoritative footprint / building-type metadata through `@tdl/protocol`** (either emitted in the `court` module snapshot `world.modules.court` alongside `grid`, or imported as pure read-only protocol constants/types from `@tdl/protocol`). The renderer never stores `cost`, `th` unlock gates, `production`, placement legality, or upgrade eligibility.

---

## 2. Proposed Minimal TypeScript Interfaces

```ts
// Proposed location: apps/client/src/court/buildings/types.ts
// Reads domain building keys & footprint metadata from @tdl/protocol snapshot/contract — never defines a second authority.

export type DomainBuildingType =
  | "townhall"
  | "cottage"
  | "farm"
  | "sawmill"
  | "quarry"
  | "mine"
  | "barracks"
  | "lantern"
  | "bench"
  | "well"
  | "flag";

/** Authoritative footprint tuple [cellsWidth, cellsDepth] supplied by @tdl/protocol / court module snapshot. */
export type DomainFootprint = readonly [widthCells: number, depthCells: number];

export type AssetFormat = "glb" | "gltf" | "procedural-legacy";

export type LicenseComplianceStatus = "original-tdl" | "licensed-commercial" | "procedural-legacy";

export type QualityTier = "low" | "medium" | "high";

export type LodLevel = "lod0" | "lod1";

export type MaterialFamilyId =
  | "weathered-stone"
  | "dark-timber"
  | "aged-roof-slate-thatch"
  | "forged-iron"
  | "tarnished-brass"
  | "bone-ivory"
  | "crimson-banner-cloth"
  | "packed-earth-ash"
  | "packed-snow"
  | "amber-hearth-emissive"
  | "necrotic-accent-emissive";

export interface AssetDimensions {
  /** Authoritative grid footprint echoed for validation against domain contract; never overrides server. */
  footprintCells: DomainFootprint;
  /** Physical local bounding box in meters (1 grid cell = 1.1m at current court scale). */
  worldBoundsMeters: readonly [widthM: number, heightM: number, depthM: number];
  /** Ground-plane pivot convention: [0, 0, 0] at footprint geometric center, Y=0 flush with ground contact. */
  pivot: "footprint-center-bottom";
  /** Maximum diffuse/PBR texture edge length in pixels (0 for pure procedural legacy). */
  maxTexturePx: 0 | 256 | 512 | 1024;
  triangleBudgetMax: number;
}

export interface AssetProvenance {
  author: string;
  source: string;
  license: LicenseComplianceStatus;
  licenseRef?: string;
  attributionRequired: boolean;
  verifiedAtIso: string;
}

export interface AssetManifestEntry {
  id: string;
  path: string | null; // null only when format === "procedural-legacy"
  format: AssetFormat;
  dimensions: AssetDimensions;
  materialRefs: readonly MaterialFamilyId[];
  provenance: AssetProvenance;
}

export interface BuildingLevelVisualVariant {
  /** Minimum authoritative level from server snapshot (`court.townhallLevel` or building `level`). */
  minLevel: number;
  /** Maximum authoritative level covered by this visual tier (inclusive). */
  maxLevel: number;
  /** Default/high-detail asset manifest entry ID (LOD0). */
  lod0AssetId: string;
  /** Optional simplified/mobile asset manifest entry ID (LOD1); falls back to lod0AssetId if omitted. */
  lod1AssetId?: string;
  /** Optional level-specific scale multiplier strictly within footprint envelope (e.g. 0.94..1.0). */
  scaleFactor?: number;
  /** Declarative anchor offsets (local meters) for UI badges, smoke/flame VFX, or banners. */
  anchors?: {
    labelOffsetY: number;
    vfxSockets?: readonly { kind: "smoke" | "flame" | "banner" | "dust"; localPos: readonly [number, number, number] }[];
  };
}

export interface BuildingDefinition<TType extends DomainBuildingType = DomainBuildingType> {
  type: TType;
  /** Display role in scene pipeline; does NOT duplicate build tabs, costs, or TH unlock rules. */
  visualCategory: "citadel" | "production" | "military" | "decor";
  /** Reads authoritative footprint from domain snapshot/contract map at lookup/validation time. */
  getFootprint: (domainFootprints: Readonly<Record<string, DomainFootprint>>) => DomainFootprint;
  /** Ordered ascending by minLevel; resolver picks highest variant with minLevel <= authoritativeLevel. */
  visualVariants: readonly BuildingLevelVisualVariant[];
  /** Legacy procedural component key used when RenderMode === "legacy" or during fallback. */
  legacyRendererKey: TType;
}

export interface QualityProfile {
  tier: QualityTier;
  dprRange: readonly [min: number, max: number];
  shadowsEnabled: boolean;
  shadowMapSize: 0 | 512 | 1024 | 2048;
  maxTexturePx: 256 | 512 | 1024;
  preferredLod: LodLevel;
  ambientFoliageRatio: number; // e.g. 0.5 on low mobile, 1.0 on high desktop
  animatedPropsEnabled: boolean;
}
```

---

## 3. Authoritative Lookup & Rendering Contract

1. **Single-authority footprint guard:**
   ```ts
   // Footprint comes from world.modules.court.footprints (via @tdl/protocol) when present,
   // with temporary typed fallback only until server snapshot includes the table.
   const [cellsW, cellsD] = definition.getFootprint(courtSnapshot.footprints);
   ```
   A build/runtime assertion verifies `assetEntry.dimensions.footprintCells` matches `[cellsW, cellsD]` and `worldBoundsMeters` stays within `[cellsW * CELL, maxHeight, cellsD * CELL]` so a 3D model never overflows onto neighboring plots or road tiles.

2. **Quality profiles (initial baseline matching `CourtScene.tsx:1883-1903`):**
   - `high`: `dprRange: [1, 1.75]`, `shadowsEnabled: true`, `shadowMapSize: 2048`, `maxTexturePx: 1024`, `preferredLod: "lod0"`, `ambientFoliageRatio: 1.0`, `animatedPropsEnabled: true`
   - `medium` (default mobile): `dprRange: [1, 1.5]`, `shadowsEnabled: true`, `shadowMapSize: 1024`, `maxTexturePx: 512`, `preferredLod: "lod0"`, `ambientFoliageRatio: 0.75`, `animatedPropsEnabled: true`
   - `low` (constrained WebGL): `dprRange: [1, 1.0]`, `shadowsEnabled: false`, `shadowMapSize: 0`, `maxTexturePx: 256`, `preferredLod: "lod1"`, `ambientFoliageRatio: 0.4`, `animatedPropsEnabled: false`

3. **Strict non-ownership guarantee:**
   `BuildingDefinition` contains **zero** fields for `cost`, `th` unlock level, `production` rate, `limit`, or placement legality. Those remain inside `packages/modules/court/src/module.ts` and are surfaced to `BuildPanel.tsx` / `Hud.tsx` via server state & `@tdl/protocol`.

---

## 4. Concrete Examples

### 4.1 Citadel (`townhall`) — Hero Vertical-Slice Asset (Levels 1–5)

*(Note: Domain ID remains `"townhall"` in `packages/modules/court/src/module.ts` and `FOOTPRINT.townhall = [3, 3]`; HUD/art refers to it as Citadel / Ратуша without renaming the server contract key.)*

```ts
export const CITADEL_ASSET_MANIFEST: Record<string, AssetManifestEntry> = {
  "citadel.legacy": {
    id: "citadel.legacy",
    path: null,
    format: "procedural-legacy",
    dimensions: {
      footprintCells: [3, 3],
      worldBoundsMeters: [2.9, 5.0, 2.9], // Matches CourtScene.tsx:1563 podium 2.9m & spire ~5m (scaled 0.8..0.96)
      pivot: "footprint-center-bottom",
      maxTexturePx: 0,
      triangleBudgetMax: 600,
    },
    materialRefs: ["weathered-stone", "dark-timber", "tarnished-brass", "packed-snow", "crimson-banner-cloth"],
    provenance: {
      author: "TDL team",
      source: "apps/client/src/court/CourtScene.tsx#TownHall",
      license: "procedural-legacy",
      attributionRequired: false,
      verifiedAtIso: "2026-11-12",
    },
  },
  // Target Phase D production entries (not yet in repo — gated on asset production):
  "citadel.lv1_2.lod0": {
    id: "citadel.lv1_2.lod0",
    path: "models/buildings/citadel/citadel_t1_lod0.glb",
    format: "glb",
    dimensions: {
      footprintCells: [3, 3],
      worldBoundsMeters: [3.1, 4.6, 3.1], // Fits inside 3 * 1.1m = 3.3m plot with clearance
      pivot: "footprint-center-bottom",
      maxTexturePx: 1024,
      triangleBudgetMax: 12000,
    },
    materialRefs: [
      "weathered-stone",
      "dark-timber",
      "aged-roof-slate-thatch",
      "forged-iron",
      "tarnished-brass",
      "amber-hearth-emissive",
      "packed-snow",
    ],
    provenance: {
      author: "TBD (Phase D original asset)",
      source: "internal-blender-source",
      license: "original-tdl",
      attributionRequired: false,
      verifiedAtIso: "TBD",
    },
  },
  "citadel.lv3_5.lod0": {
    id: "citadel.lv3_5.lod0",
    path: "models/buildings/citadel/citadel_t2_lod0.glb",
    format: "glb",
    dimensions: {
      footprintCells: [3, 3],
      worldBoundsMeters: [3.2, 5.6, 3.2], // Distinct silhouette tier: fortified keep tower + banners
      pivot: "footprint-center-bottom",
      maxTexturePx: 1024,
      triangleBudgetMax: 15000,
    },
    materialRefs: [
      "weathered-stone",
      "dark-timber",
      "aged-roof-slate-thatch",
      "forged-iron",
      "tarnished-brass",
      "bone-ivory",
      "crimson-banner-cloth",
      "amber-hearth-emissive",
      "necrotic-accent-emissive",
      "packed-snow",
    ],
    provenance: {
      author: "TBD (Phase D original asset)",
      source: "internal-blender-source",
      license: "original-tdl",
      attributionRequired: false,
      verifiedAtIso: "TBD",
    },
  },
};

export const CITADEL_DEFINITION: BuildingDefinition<"townhall"> = {
  type: "townhall",
  visualCategory: "citadel",
  getFootprint: (footprints) => footprints.townhall ?? [3, 3],
  visualVariants: [
    {
      minLevel: 1,
      maxLevel: 2,
      lod0AssetId: "citadel.lv1_2.lod0",
      anchors: {
        labelOffsetY: 4.8,
        vfxSockets: [{ kind: "smoke", localPos: [0.85, 2.75, -0.75] }],
      },
    },
    {
      minLevel: 3,
      maxLevel: 5,
      lod0AssetId: "citadel.lv3_5.lod0",
      anchors: {
        labelOffsetY: 5.8,
        vfxSockets: [
          { kind: "smoke", localPos: [0.85, 3.1, -0.75] },
          { kind: "banner", localPos: [0, 4.52, 0] },
        ],
      },
    },
  ],
  legacyRendererKey: "townhall",
};
```

### 4.2 Supporting Building (`sawmill`) — Single-Stage 2×2 Example

*(In `packages/modules/court/src/module.ts:40`, `sawmill` has `size: [2, 2]`, `tab: "economy"`, `th: 2`. Per-building upgrade levels do not exist on non-Citadel buildings at `0a5e465`, so `minLevel: 1, maxLevel: 99` covers all levels safely.)*

```ts
export const SAWMILL_ASSET_MANIFEST: Record<string, AssetManifestEntry> = {
  "sawmill.legacy": {
    id: "sawmill.legacy",
    path: null,
    format: "procedural-legacy",
    dimensions: {
      footprintCells: [2, 2],
      worldBoundsMeters: [1.86, 1.9, 1.86], // Within 2 * 1.1m = 2.2m cell footprint
      pivot: "footprint-center-bottom",
      maxTexturePx: 0,
      triangleBudgetMax: 250,
    },
    materialRefs: ["dark-timber", "packed-earth-ash", "forged-iron", "packed-snow"],
    provenance: {
      author: "TDL team",
      source: "apps/client/src/court/CourtScene.tsx#BuildingBody(sawmill)",
      license: "procedural-legacy",
      attributionRequired: false,
      verifiedAtIso: "2026-11-12",
    },
  },
  "sawmill.lv1.lod0": {
    id: "sawmill.lv1.lod0",
    path: "models/buildings/sawmill/sawmill_lod0.glb",
    format: "glb",
    dimensions: {
      footprintCells: [2, 2],
      worldBoundsMeters: [2.0, 2.2, 2.0],
      pivot: "footprint-center-bottom",
      maxTexturePx: 512,
      triangleBudgetMax: 4500,
    },
    materialRefs: ["dark-timber", "weathered-stone", "forged-iron", "packed-earth-ash", "packed-snow"],
    provenance: {
      author: "TBD (Phase E building asset)",
      source: "internal-blender-source",
      license: "original-tdl",
      attributionRequired: false,
      verifiedAtIso: "TBD",
    },
  },
};

export const SAWMILL_DEFINITION: BuildingDefinition<"sawmill"> = {
  type: "sawmill",
  visualCategory: "production",
  getFootprint: (footprints) => footprints.sawmill ?? [2, 2],
  visualVariants: [
    {
      minLevel: 1,
      maxLevel: 99,
      lod0AssetId: "sawmill.lv1.lod0",
      anchors: {
        labelOffsetY: 2.35,
        vfxSockets: [{ kind: "smoke", localPos: [0.4, 1.6, -0.3] }],
      },
    },
  ],
  legacyRendererKey: "sawmill",
};
```
