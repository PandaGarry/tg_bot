# TDL-ARCH-004 — Audit Evidence & Provenance Record

> **Task:** `TDL-ARCH-004` — Visual asset inventory and architecture audit  
> **Arena delivery branch:** `arena/ff89979b-tg-bot`  
> **Architecture source branch:** `refactor/tdl-asset-pipeline-foundation` (PR #26)  
> **Exact audited source SHA:** `0a5e465ede6096ecdfc33b4771b0761baf327fab`  
> **Cross-referenced functional parity baseline:** PR #28 (`refactor/tdl-court-grid-input-impl`, HEAD `db71165`) + `evidence/TDL-ARCH-003/smoke-report.json`  
> **Audit date:** 2026-11-12 (UTC)

---

## 1. Provenance & Branch Isolation

- **Source checkout under audit:** `/tmp/tdl-arch004-src` cloned directly from `origin` branch `refactor/tdl-asset-pipeline-foundation` at exact SHA `0a5e465ede6096ecdfc33b4771b0761baf327fab`.
- **Dependency inspection store:** `/tmp/tdl-pr28/node_modules/.pnpm` verified byte-identical (`diff -q` returned exit `0`) against `/tmp/tdl-arch004-src/package.json` and `/tmp/tdl-arch004-src/pnpm-lock.yaml` (`three@0.182.0`, `@react-three/fiber@9.5.0`, `react@19.3.0`, `vite@8.3.1`, `typescript@5.9.3`, `@types/three@0.182.0`, `meshoptimizer@0.22.0`).
- **Delivery isolation:** All 6 deliverable files were authored strictly on `arena/ff89979b-tg-bot` without modifying any application source code, `package.json`, `pnpm-lock.yaml`, binary assets, concept images, or prior `evidence/` bundles (`TDL-ENV-001`, `TDL-VIS-002`, `TDL-VIS-003`, `TDL-ARCH-001`, `TDL-ARCH-002`, `TDL-ARCH-003`).

---

## 2. Deliverable Files Created

| Deliverable | Path on `arena/ff89979b-tg-bot` | Scope |
|---|---|---|
| Asset Inventory | `docs/design/TDL_ASSET_INVENTORY.md` | Scope A — complete enumeration of all 322 binary visual files (`38` runtime `public/`, `2` `image-search/`, `282` `docs/game/ui/`), 20 inline React `<svg>` components, CSS system font stack, and `CourtScene.tsx` / `court3d` procedural 3D primitives |
| Runtime Capabilities | `docs/design/TDL_RUNTIME_ASSET_CAPABILITIES.md` | Scope B — verified capability matrix for `three@0.182.0` / `@react-three/fiber@9.5.0` / `vite@8.3.1` / `apps/server/src/http.ts` |
| Building Registry Proposal | `docs/design/TDL_BUILDING_REGISTRY_PROPOSAL.md` | Scope C — typed `BuildingDefinition`, `BuildingLevelVisualVariant`, `AssetManifestEntry`, `QualityProfile`, Citadel & Sawmill examples obeying `tools/check/boundaries.ts` |
| CourtScene Extraction Map | `docs/design/TDL_COURTSCENE_EXTRACTION_MAP.md` | Scope D — 10-area extraction map (`0a5e465` + PR #28 `db71165` cross-reference) and `TDL-ARCH-003` parity gates |
| Migration Risk Register | `docs/design/TDL_VISUAL_MIGRATION_RISKS.md` | Scope E — prioritized risk register (`R1`–`R10`) + smallest safe Slice B1 recommendation |
| Evidence Summary | `evidence/TDL-ARCH-004/README.md` | Provenance, commands, inspected paths, tool versions, and limitations |

---

## 3. Inspected Paths (`0a5e465ede6096ecdfc33b4771b0761baf327fab`)

- Baseline documentation: `AGENTS.md`, `docs/AI_COLLABORATION/{README,STATUS}.md`, `PROJECT_MASTER.md`, `docs/DECISIONS.md`, `docs/TDL_PRODUCT_VISION_AND_ACCEPTANCE.md`, `docs/design/TDL_VISUAL_REFACTOR_ARCHITECTURE.md`, `docs/game/24-court-3d.md`, `docs/game/ui/{hud/README.md,shots/README.md,concepts/bone-wood-round-08/design-brief.md,hud/icons/icons.json,court/sprites/a.json}`.
- Client & 3D runtime code: `apps/client/package.json`, `apps/client/vite.config.ts`, `apps/client/index.html`, `apps/client/src/styles.css`, `apps/client/src/court/CourtScene.tsx` (`1,926` lines), `apps/client/src/ui/{Boot,BuildPanel,Hud,Register,Slides,World}.tsx`, `apps/client/src/ui/iconSrc.ts`, `apps/court3d/{package.json,index.html,src/App.tsx}`.
- Server, modules, protocol & checks: `apps/server/src/http.ts`, `packages/modules/court/{package.json,src/module.ts}`, `packages/protocol/src/view.ts`, `tools/check/boundaries.ts`, `tools/shots/{court3d,icons}.ts`.
- Binary asset directories: `apps/client/public/**`, `docs/game/ui/**`, `image-search/**`.
- Cross-reference on delivery branch / PR #28 (`db71165`): `apps/client/src/court/scene/{gridMath,courtInput}.ts`, `evidence/TDL-ARCH-001/*`, `evidence/TDL-ARCH-003/{README.md,smoke-report.json}`.

---

## 4. Tool Versions & Key Verification Commands

| Tool | Version | Purpose |
|---|---|---|
| `node` | `v22.22.3` | Inspected installed `three@0.182.0` / `@react-three/fiber@9.5.0` / `@types/three@0.182.0` JS & `.d.ts` exports |
| `python3` | `3.11.2` | Enumerated all 322 binary visual files, parsed PNG/JPG headers for exact dimensions, computed `SHA-256` hashes, counted JSX geometries/materials, verified static references |
| `git` | `2.39.5` | Cloned exact `0a5e465` source tree, verified remote PR heads (`db71165`), confirmed zero unintended modifications |
| `pnpm` | `12.6.0` | Verified workspace manifest compatibility |

Representative commands executed against `/tmp/tdl-arch004-src` (`0a5e465ede6096ecdfc33b4771b0761baf327fab`):
- `git clone --depth 5 --branch refactor/tdl-asset-pipeline-foundation ... /tmp/tdl-arch004-src && git -C /tmp/tdl-arch004-src rev-parse HEAD` → `0a5e465ede6096ecdfc33b4771b0761baf327fab`
- `diff -q /tmp/tdl-arch004-src/pnpm-lock.yaml /tmp/tdl-pr28/pnpm-lock.yaml` & `diff -q /tmp/tdl-arch004-src/package.json /tmp/tdl-pr28/package.json` → exit `0`
- Python tree scan across `/tmp/tdl-arch004-src` (excluding `.git/`, `node_modules/`, `dist/`) → `322` raster visual files (`175` `.jpg`, `147` `.png`, `104,581,859 B`), `0` 3D models, `0` PBR maps, `0` font binaries, `0` audio files, `0` `LICENSE`/`NOTICE` files; `20` inline `<svg>` components; `155` JSX geometries & `157` JSX materials in `CourtScene.tsx`.
- Python regex exact reference check + `SHA-256` matching across `apps/client/public/**` vs `apps/client/src/**` and `docs/game/ui/**` → `24` reachable runtime files + `1` defensive fallback (`gear.png`) + `13` unreferenced legacy PNGs (`2,730,207 B`).
- Node inspection of `/tmp/tdl-pr28/node_modules/.pnpm` → verified `three@0.182.0` (`GLTFLoader`, `KTX2Loader`, `DRACOLoader`, `HDRLoader`, deprecated `RGBELoader`, `EXRLoader`, `basis_transcoder.{js,wasm}`, `draco_decoder.{js,wasm}`, `meshopt_decoder.module.js`, `SRGBColorSpace`, `NoColorSpace`, `MeshStandardMaterial` maps) and `@react-three/fiber@9.5.0` (`useLoader`, `useGraph`).

---

## 5. Audit Scope & Limitations

- **Documentation/proposal only:** Per `TDL-ARCH-004.md`, no source code, lockfiles, dependencies, or runtime servers were modified or rebuilt as part of this audit; runtime screenshot/smoke parity numbers cited come from the prior `TDL-ARCH-003` verification (`evidence/TDL-ARCH-003/smoke-report.json`).
- **License verification boundary:** No external AI platform terms or third-party vendor receipts exist inside the Git repository; therefore, all binary raster files are strictly marked `unknown` for license until owner/legal provenance is recorded.
- **Note on prior `evidence/TDL-ARCH-001/` snapshot:** This `TDL-ARCH-004` audit supersedes two earlier summary numbers from `TDL-ARCH-001` through exact regex matching and `db71165` cross-referencing: (1) `apps/client/public/` actually contains `24` reachable files + `1` fallback (`gear.png`) + `13` unreferenced PNGs (not `24` + `14`, because substring matching previously conflated `bag.png` etc. with `i-bag.png`), and (2) `RGBELoader` in `three@0.182.0` is `@deprecated, r180` in favor of `HDRLoader`, while the right-hold pickup defect present at `0a5e465` has already been fixed on PR #28 (`db71165`).
