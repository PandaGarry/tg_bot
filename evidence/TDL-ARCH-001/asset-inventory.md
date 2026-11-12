# TDL-ARCH-001 — Visual Asset Inventory

**Audited repository:** `PandaGarry/tg_bot`  
**Branch:** `refactor/tdl-asset-pipeline-foundation` (PR #26)  
**Live audited HEAD SHA:** `0a5e465ede6096ecdfc33b4771b0761baf327fab`  
**Handoff starting HEAD SHA:** `a761453e2a69530af02298409b359bb481ff87e0`  
**Base `main` SHA:** `eaaa9072a729f69ae19d44a1449c1d94f27c07a1`  
**Machine-readable source:** `evidence/TDL-ARCH-001/asset-inventory.json`

---

## Executive Verdict (Blunt Assessment)

1. **Zero production-ready 3D models exist in the repository.** There are **0** `.glb`, `.gltf`, `.obj`, `.fbx`, `.blend`, `.dae`, `.usdz`, or `.ply` files anywhere in the tree.
2. **Zero PBR material texture maps exist in the repository.** There are **0** albedo/baseColor, normal, roughness, metalness, ambient-occlusion, emissive, height, `.ktx`, `.ktx2`, `.hdr`, or `.exr` textures anywhere in the tree.
3. **Zero license or attribution documents exist.** There is no `LICENSE`, `NOTICE`, `COPYING`, or third-party attribution file anywhere in the repository (`find` returned 0).
4. **Current runtime 3D rendering is 100% untextured procedural primitives.** `apps/client/src/court/CourtScene.tsx` constructs every building, tree, road pebble, palisade log, and ground patch out of solid-color Three.js primitives (`153` `<meshStandardMaterial>`, `3` `<meshBasicMaterial>`, `1` `<lineBasicMaterial>` across `145` geometry primitives).
5. **All 2D visual assets on disk have `unknown` or non-commercial-unverified license status** (AI-generated mockups/icons/sprites, project-generated prototype screenshots without a repo `LICENSE`, or third-party copyrighted reference screenshots). None are usable as production 3D/PBR assets or flat in-game textures.

---

## Repository Totals

| Metric | Count | Size (bytes) | Size (MiB) |
|---|---:|---:|---:|
| Total visual files in repo | 322 | 104,581,859 | 99.74 |
| Format: JPEG (`.jpg`) | 175 | 46,356,374 | 44.21 |
| Format: PNG (`.png`) | 147 | 58,225,485 | 55.53 |
| 3D models (`.glb`, `.gltf`, `.obj`, `.fbx`, `.blend`, etc.) | **0** | 0 | 0.00 |
| PBR texture maps / environment maps (`.ktx2`, `.hdr`, `.exr`, normal/roughness/metallic/AO) | **0** | 0 | 0.00 |
| Production-usable 3D/PBR assets | **0** | 0 | 0.00 |
| Files in `apps/client/public/` (served to client / copied to `dist/`) | 38 | 8,205,758 | 7.83 |
| — Actively referenced in runtime code | 24 | 5,189,723 | 4.95 |
| — Unused or orphaned in `apps/client/public/icons/` | 14 | 3,016,035 | 2.88 |
| Non-runtime files (`docs/game/ui/**` + `image-search/**`) | 284 | 96,376,101 | 91.91 |

### Breakdown by Classification Category

| Category | Runtime? | Files | Bytes | MiB | Provenance / License Summary |
|---|---|---:|---:|---:|---|
| `runtime-ui-icon` | Yes | 22 | 5,044,528 | 4.81 | AI-generated HUD icons (`docs/game/24-court-3d.md:563`, `docs/game/ui/hud/README.md:60`); license **`unknown`** |
| `runtime-webgl-fallback` | Yes | 1 | 123,918 | 0.12 | Exact SHA-256 duplicate of `docs/game/ui/court3d/court3d-overview.jpg` (Puppeteer capture of `apps/court3d`); no repo `LICENSE` |
| `runtime-ui-brand` | Yes | 1 | 21,277 | 0.02 | AI-generated crest cropped from mockup (`docs/game/24-court-3d.md:250,283`); license **`unknown`** |
| `unused-client-ui-icon` | Shipped in `dist/`, unreferenced | 14 | 3,016,035 | 2.88 | 12 legacy 159–200px icons + unused 2.12 MB `i-web.png` + orphaned `i-shield.png`; license **`unknown`** |
| `concept-art` | No | 101 | 26,097,253 | 24.89 | AI-generated style/UI/architecture concepts in `docs/game/ui/concepts/`; license **`unknown`** |
| `icon-pack-source` | No | 78 | 27,660,791 | 26.38 | Source icon sheets and pre-processed pack tiles in `docs/game/ui/icon-packs/` & `docs/game/ui/hud/icons/`; license **`unknown`** |
| `prototype-2d-backdrop-or-screenshot` | No | 35 | 12,052,486 | 11.49 | AI-generated backgrounds & HTML prototype captures in `docs/game/ui/`; license **`unknown`** |
| `prototype-2d-sprite` | No | 34 | 22,250,501 | 21.22 | AI-generated 2D isometric sprite sheets/cutouts in `docs/game/ui/court/`; license **`unknown`** |
| `prototype-screenshot` | No | 34 | 8,139,217 | 7.76 | `docs/game/ui/court3d/` (19 project renders) + `docs/game/ui/shots/` (15 mockup screenshots) |
| `external-reference` | No | 2 | 175,853 | 0.17 | `image-search/rise-of-kingdoms-*.jpg`; third-party copyrighted reference screenshots (strictly non-usable) |

---

## Runtime & Shipped Public Files (`apps/client/public/`)

Every file in `apps/client/public/` is automatically copied verbatim into `apps/client/dist/` by Vite (`pnpm build`).

### 1. Actively Referenced Runtime Assets (24 files, 5,189,723 bytes)

| Path | Format | Dimensions | Size (B) | Role & Runtime References | Provenance & License Evidence |
|---|---|---:|---:|---|---|
| `apps/client/public/court-fallback.jpg` | jpg | 1376×768 | 123,918 | WebGL-unavailable fallback backdrop (`CourtScene.tsx:1851`) | Identical SHA-256 (`8ce78062...`) to `docs/game/ui/court3d/court3d-overview.jpg`; project-generated `court3d` screenshot; no `LICENSE` file |
| `apps/client/public/emblem.jpg` | jpg | 288×288 | 21,277 | Login crest (`Boot.tsx:66`) & favicon (`index.html:10`) | Cropped AI-generated crest (`docs/game/24-court-3d.md:250,283`); **`unknown`** |
| `apps/client/public/icons/crown.png` | png | 512×512 | 320,938 | VIP badge icon (`Hud.tsx:113`) | Normalized from `docs/game/ui/hud/icons/`; AI-generated; **`unknown`** |
| `apps/client/public/icons/gear.png` | png | 186×182 | 54,628 | Fallback icon in `Hud.tsx:128,144,158` & `World.tsx:222,237` (also hit by broken `"clan"` key!) | Legacy cropped tile (`docs/game/ui/hud/README.md:60`); AI-generated; **`unknown`** |
| `apps/client/public/icons/gold.png` | png | 512×512 | 250,646 | Gold resource chip (`Hud.tsx:128`, `BuildPanel.tsx:46`, `World.tsx:287`) | Normalized AI-generated HUD icon; **`unknown`** |
| `apps/client/public/icons/meat.png` | png | 512×512 | 318,748 | Meat resource chip (`Hud.tsx:128`, `BuildPanel.tsx:46`, `World.tsx:287`) | Normalized AI-generated HUD icon; **`unknown`** |
| `apps/client/public/icons/metal.png` | png | 512×512 | 221,092 | Metal resource chip (`Hud.tsx:128`, `BuildPanel.tsx:46`, `World.tsx:287`) | Normalized AI-generated HUD icon; **`unknown`** |
| `apps/client/public/icons/mushroom.png` | png | 512×512 | 228,575 | Mushrooms resource chip (`Hud.tsx:128`, `BuildPanel.tsx:46`, `World.tsx:287`) | Normalized AI-generated HUD icon; **`unknown`** |
| `apps/client/public/icons/stone.png` | png | 512×512 | 281,807 | Stone resource chip (`Hud.tsx:128`, `BuildPanel.tsx:46`, `World.tsx:287`) | Normalized AI-generated HUD icon; **`unknown`** |
| `apps/client/public/icons/wood.png` | png | 512×512 | 306,993 | Wood resource chip (`Hud.tsx:128`, `BuildPanel.tsx:46`, `World.tsx:287`) | Normalized AI-generated HUD icon; **`unknown`** |
| `apps/client/public/icons/i-bag.png` | png | 512×512 | 314,808 | Right rail Items button (`iconSrc.ts:11`, `Hud.tsx:34`) | Normalized from `docs/game/ui/icon-packs/glossy/`; **`unknown`** |
| `apps/client/public/icons/i-banner.png` | png | 512×512 | 162,935 | Bottom nav Court button (`iconSrc.ts:15`, `World.tsx:22`) | Normalized from `docs/game/ui/icon-packs/glossy/`; **`unknown`** |
| `apps/client/public/icons/i-flask.png` | png | 512×512 | 222,663 | Left rail Research queue (`iconSrc.ts:8`, `Hud.tsx:27`) | Normalized from `docs/game/ui/icon-packs/glossy/`; **`unknown`** |
| `apps/client/public/icons/i-gear.png` | png | 512×512 | 293,386 | Bottom nav Modules button (`iconSrc.ts:19`, `World.tsx:26`) | Normalized from `docs/game/ui/icon-packs/glossy/`; **`unknown`** |
| `apps/client/public/icons/i-hammer.png` | png | 512×512 | 82,500 | Left rail Build button (`iconSrc.ts:6`, `Hud.tsx:140`) | Normalized from `docs/game/ui/icon-packs/glossy/`; **`unknown`** |
| `apps/client/public/icons/i-helmet.png` | png | 512×512 | 266,222 | Right rail Commanders button (`iconSrc.ts:9`, `Hud.tsx:32`) | Normalized from `docs/game/ui/icon-packs/glossy/`; **`unknown`** |
| `apps/client/public/icons/i-lord.png` | png | 512×512 | 242,278 | Lord portrait (`Hud.tsx:99`, `Create.tsx:114`) | Normalized from `docs/game/ui/icon-packs/glossy/`; **`unknown`** |
| `apps/client/public/icons/i-mail.png` | png | 512×512 | 196,377 | Right rail Mail button (`iconSrc.ts:13`, `Hud.tsx:36`) | Normalized from `docs/game/ui/icon-packs/glossy/`; **`unknown`** |
| `apps/client/public/icons/i-map.png` | png | 512×512 | 298,521 | Bottom nav Map button (`iconSrc.ts:17`, `World.tsx:24`) | Normalized from `docs/game/ui/icon-packs/glossy/`; **`unknown`** |
| `apps/client/public/icons/i-power.png` | png | 512×512 | 305,967 | Power stat icon (`Hud.tsx:108`) | Normalized from `docs/game/ui/icon-packs/glossy/`; **`unknown`** |
| `apps/client/public/icons/i-quill.png` | png | 512×512 | 70,030 | Bottom nav Chronicle button (`iconSrc.ts:18`, `World.tsx:25`) | Normalized from `docs/game/ui/icon-packs/glossy/`; **`unknown`** |
| `apps/client/public/icons/i-scroll.png` | png | 512×512 | 84,887 | Bottom nav Reports button (`iconSrc.ts:16`, `World.tsx:23`) | Normalized from `docs/game/ui/icon-packs/glossy/`; **`unknown`** |
| `apps/client/public/icons/i-shop.png` | png | 512×512 | 284,996 | Right rail Shop button (`iconSrc.ts:12`, `Hud.tsx:35`) | Normalized from `docs/game/ui/icon-packs/glossy/`; **`unknown`** |
| `apps/client/public/icons/i-swords.png` | png | 512×512 | 235,531 | Left rail Train queue (`iconSrc.ts:7`, `Hud.tsx:26`) | Normalized from `docs/game/ui/icon-packs/glossy/`; **`unknown`** |

### 2. Unused / Orphaned Files Still Bundled into `dist/icons/` (14 files, 3,016,035 bytes)

| Path | Format | Dimensions | Size (B) | Why Unused / Defect Note | License |
|---|---|---:|---:|---|---|
| `apps/client/public/icons/i-web.png` | png | **1408×768** | **2,118,164** | **Unreferenced 2.12 MiB full-size image** copied into every build (`dist/icons/i-web.png`) | **`unknown`** |
| `apps/client/public/icons/i-shield.png` | png | 512×512 | 285,828 | **Orphaned by key mismatch:** `iconSrc.ts:10` registers `"shield": "icons/i-shield.png"`, while `Hud.tsx:33` requests `icon: "clan"`, hitting the fallback `icons/gear.png` (confirmed in runtime screenshot `01`) | **`unknown`** |
| `apps/client/public/icons/bag.png` | png | 193×160 | 58,033 | Legacy cropped sprite replaced by `i-bag.png` | **`unknown`** |
| `apps/client/public/icons/banner.png` | png | 163×200 | 47,625 | Legacy cropped sprite replaced by `i-banner.png` | **`unknown`** |
| `apps/client/public/icons/clan.png` | png | 197×167 | 60,008 | Legacy cropped sprite replaced by `i-shield.png` | **`unknown`** |
| `apps/client/public/icons/hammer.png` | png | 165×179 | 38,202 | Legacy cropped sprite replaced by `i-hammer.png` | **`unknown`** |
| `apps/client/public/icons/helmet.png` | png | 172×159 | 40,067 | Legacy cropped sprite replaced by `i-helmet.png` | **`unknown`** |
| `apps/client/public/icons/mail.png` | png | 184×139 | 58,129 | Legacy cropped sprite replaced by `i-mail.png` | **`unknown`** |
| `apps/client/public/icons/map.png` | png | 188×162 | 54,876 | Legacy cropped sprite replaced by `i-map.png` | **`unknown`** |
| `apps/client/public/icons/quill.png` | png | 174×184 | 36,329 | Legacy cropped sprite replaced by `i-quill.png` | **`unknown`** |
| `apps/client/public/icons/scroll.png` | png | 159×180 | 59,914 | Legacy cropped sprite replaced by `i-scroll.png` | **`unknown`** |
| `apps/client/public/icons/shop.png` | png | 179×176 | 58,385 | Legacy cropped sprite replaced by `i-shop.png` | **`unknown`** |
| `apps/client/public/icons/swords.png` | png | 175×171 | 44,167 | Legacy cropped sprite replaced by `i-swords.png` | **`unknown`** |
| `apps/client/public/icons/web.png` | png | 187×185 | 56,308 | Legacy cropped sprite, unused | **`unknown`** |

> **Runtime weight note:** Even active `512×512` HUD icons are uncompressed/heavy PNGs (`70–321 KiB` each, `4.81 MiB` total for 22 icons, plus `2.88 MiB` unused = `7.69 MiB` of HUD icons alone in `dist/icons/`). None are optimized spritesheets, WebP/AVIF, or SVG icons (except the inline SVG building signs in `BuildPanel.tsx`).

---

## Non-Runtime Documentation, Prototype & Reference Assets (284 files, 96,376,101 bytes)

Full file-by-file paths, exact dimensions, sizes, and SHA-256 digests are recorded in `evidence/TDL-ARCH-001/asset-inventory.json`.

| Directory / File | Files | Formats | Total Bytes (MiB) | Contents & Provenance | Usable in Game? |
|---|---|---|---:|---|---|
| `docs/game/ui/` (root) | 5 | 5 JPG | 1,123,300 (1.07) | AI-generated prototype UI mockups (`screen-main*.jpg`, `style-03-wood-ivory.jpg`, `style-05-bone-wood.jpg`) | **No** (mockups/concepts, license `unknown`) |
| `docs/game/ui/concepts/` | 101 | 101 JPG | 26,097,253 (24.89) | AI-generated architectural, HUD, map, portrait, and atmosphere concept sheets | **No** (concept art only; `TDL_VISUAL_REFACTOR_ARCHITECTURE.md` forbids AI images as textures; license `unknown`) |
| `docs/game/ui/court/` | 46 | 12 JPG, 34 PNG | 27,144,631 (25.89) | 2D isometric prototype backdrops (`ground-day.jpg`, `court-full.jpg`, etc.) + 34 AI-generated 2D building/prop PNG cutouts (`citadel.png`, `farm.png`, `palisade.png`, etc.) from early 2D-sprite experiment (`23-court-scene.md`) | **No** (not 3D models or PBR maps; 2D sprite direction was abandoned for 3D; license `unknown`) |
| `docs/game/ui/court3d/` | 19 | 19 JPG | 2,240,829 (2.14) | Project-generated Puppeteer captures of `apps/court3d` and early `CourtScene` (`court3d-overview.jpg` has identical SHA-256 to `public/court-fallback.jpg`) | Only as historical reference (no separate `LICENSE` file) |
| `docs/game/ui/hud/` | 61 | 19 JPG, 42 PNG | 11,491,526 (10.96) | 18 UI style variants + `hud/icons/` (`icons.json` + 43 source/sliced AI-generated icon tiles) | **No** (documentation/source tiles; license `unknown`) |
| `docs/game/ui/icon-packs/` | 35 | 35 PNG | 22,204,321 (21.18) | Source sheets and raw icon renders (`glossy/`, `sheets/`, `1024×1024` / `512×512`) used to populate `public/icons/` (`tools/shots/icons.ts`) | **No** (source AI-generated packs; license `unknown`) |
| `docs/game/ui/shots/` | 15 | 15 JPG | 5,898,388 (5.63) | Composite screenshots of HTML UI prototypes | **No** (docs only; license `unknown`) |
| `image-search/rise-of-kingdoms-city-view-hud-top-bar-r-1.jpg` | 1 | JPG (`820×410`) | 106,945 (0.10) | Rise of Kingdoms third-party commercial game screenshot | **Strictly NO** (third-party copyright) |
| `image-search/rise-of-kingdoms-city-view-hud-top-bar-r-2.jpg` | 1 | JPG (`1024×498`) | 68,908 (0.07) | Rise of Kingdoms third-party commercial game screenshot | **Strictly NO** (third-party copyright) |

---

## Asset Readiness Summary for `TDL_VISUAL_REFACTOR_ARCHITECTURE.md`

Every material family required by `docs/design/TDL_VISUAL_REFACTOR_ARCHITECTURE.md` §4 (`stone_basalt`, `stone_limestone`, `timber_blackened`, `iron_forged`, `roof_slate`, `bone_ivory`, `necrotic_crystal`) currently has **0% asset coverage**:

- **3D Meshes (`.glb`/`.gltf`):** `0` files on disk.
- **PBR Albedo / Normal / Roughness / Metalness / AO Maps:** `0` files on disk.
- **Environment Lighting / HDRI (`.hdr`/`.exr`):** `0` files on disk.
- **License / Provenance Tracking:** `0` asset manifest or license records exist anywhere in the repo; existing 2D icons/concepts have undocumented provenance (`unknown`).
