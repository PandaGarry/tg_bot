# TDL-ARCH-001 — Client, Dependency & Runtime Capabilities Audit

**Audited repository:** `PandaGarry/tg_bot`  
**Branch:** `refactor/tdl-asset-pipeline-foundation` (PR #26)  
**Live audited HEAD SHA:** `0a5e465ede6096ecdfc33b4771b0761baf327fab`  
**Handoff starting HEAD SHA:** `a761453e2a69530af02298409b359bb481ff87e0`  
**Audit environment:** Node `v22.22.3`, `pnpm@12.6.0`, HeadlessChrome `153.0.8010.0` (ANGLE Vulkan / SwiftShader `0x0000C0DE`), embedded PostgreSQL `18.4` (`127.0.0.1:55432`).  
**Note:** No source files, `package.json`, or lockfiles were edited during this audit.

---

## 1. Installed 3D & Build Dependencies (`apps/client/package.json`)

| Package | Version | Role |
|---|---|---|
| `three` | `0.182.0` | Core WebGL/Three.js renderer (plus JSM loaders/transcoders in `node_modules/three/examples/jsm/`) |
| `@types/three` | `0.182.0` | TypeScript declarations |
| `@react-three/fiber` | `9.5.0` | React 19 reconciler & `<Canvas>` / `useFrame` / `useThree` (`three-jsx.d.ts` augments JSX) |
| `react` / `react-dom` | `19.3.0` | UI runtime |
| `vite` | `8.3.1` | Bundler (`apps/client/vite.config.ts`) |
| `@tdl/protocol` | `workspace:*` | Shared wire/view/slot contracts |
| `@tdl/modules` | `workspace:*` | Module view registry (`views.gen.ts`) |

**Absent from `apps/client` and workspace `node_modules`:**
- `@react-three/drei` (no `useGLTF`, `useTexture`, `Environment`, `Lightformer`, `Bounds`, etc.)
- `@gltf-transform/core`, `@gltf-transform/cli`, `@gltf-transform/extensions` (`gltf-transform` CLI is **not installed**)
- `gltfpack`, `meshoptimizer` CLI, `basisu`, `toktx`, `ktx`, `blender` (**none installed** in workspace or system `PATH`)
- Any client-side texture/mesh asset manifest or caching/disposal manager

---

## 2. glTF, Draco, Meshopt & KTX2 Loading Support

### Current Runtime Usage: **None**
A full search across `apps/client/src/` and `apps/court3d/src/` shows **zero** imports of `GLTFLoader`, `DRACOLoader`, `KTX2Loader`, `TextureLoader`, `RGBELoader`, `HDRLoader`, `EXRLoader`, `MeshoptDecoder`, or `useLoader`. The app currently loads zero 3D assets or 3D textures over HTTP.

### What `three@0.182.0` Already Ships (Ready to Import, Not Yet Wired)

| Capability | Included Module (`three/examples/jsm/...`) | Companion Binary / Runtime Files in `node_modules/three` | Current Integration Gap |
|---|---|---|---|
| **glTF 2.0 / GLB** | `loaders/GLTFLoader.js` (`114,883 B`) | Pure JS | Not imported anywhere |
| **Draco mesh compression** | `loaders/DRACOLoader.js` (`17,774 B`) | `libs/draco/gltf/draco_decoder.wasm` (`192,420 B`), `draco_wasm_wrapper.js` (`58,456 B`), `draco_decoder.js` (`512,465 B`) | Not copied to `apps/client/public/` and no decoder path configured; **offline TG Mini App environments cannot rely on external Google CDN (`gstatic.com`)** |
| **KTX2 / Basis Universal GPU textures** | `loaders/KTX2Loader.js` (`35,695 B`) | `libs/basis/basis_transcoder.wasm` (`527,333 B`), `basis_transcoder.js` (`57,529 B`), plus `ktx-parse` and `zstddec` | Not copied to `apps/client/public/`, `detectSupport(gl)` never called |
| **Meshopt compression** | `libs/meshopt_decoder.module.js` (`24,848 B`) | Pure ES module | Not imported or passed to `GLTFLoader.setMeshoptDecoder` |
| **HDR / EXR environment maps** | `loaders/HDRLoader.js` / `RGBELoader` / `EXRLoader.js` | Pure JS | No IBL / PMREM environment map pipeline exists |

### Critical Production Server MIME Gap (`apps/server/src/http.ts:327–336`)

In production mode (`NODE_ENV=production`), `apps/server/src/http.ts` serves `apps/client/dist/` via a manual `contentType(path)` helper:

```ts
function contentType(path: string): string {
  if (path.endsWith(".html")) return "text/html; charset=utf-8";
  if (path.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (path.endsWith(".css")) return "text/css; charset=utf-8";
  if (path.endsWith(".json")) return "application/json";
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".woff2")) return "font/woff2";
  return "application/octet-stream";
}
```

**Blocking defects before Phase C asset delivery:**
1. **`.wasm` resolves to `application/octet-stream`** instead of `application/wasm` — breaks `WebAssembly.instantiateStreaming()` used by Draco/Basis decoders in Chromium/Safari unless corrected.
2. **`.glb`, `.gltf`, `.ktx2`, `.hdr`, `.exr`, `.jpg`/`.jpeg`, `.webp`, `.bin` all fall back to `application/octet-stream`** (even `court-fallback.jpg` and `emblem.jpg` currently get `application/octet-stream` in `NODE_ENV=production`!).
3. Static cache header (`http.ts:81`) sets `Cache-Control: public, max-age=31536000, immutable` on **all** non-`index.html` files regardless of whether paths in `public/` have content hashes — unhashed assets placed directly under `public/` would be cached aggressively for 1 year without cache-busting unless imported via Vite assets or versioned filenames.

---

## 3. PBR Material, Color-Space & Lighting Pipeline

Inspection of `apps/client/src/court/CourtScene.tsx`:
- **Renderer setup (`L1860–1868`):** `<Canvas shadows dpr={[1, 1.75]} gl={{ antialias: true, powerPreference: "high-performance" }}>` sets `gl.toneMapping = THREE.ACESFilmicToneMapping` and `gl.toneMappingExposure = 1.12`. `outputColorSpace` relies on Three 0.182 default (`THREE.SRGBColorSpace`).
- **Lighting (`L1871–1884`):** Single `hemisphereLight` (`#e8f0fa`, `#a08a6c`, `0.9`) + single `directionalLight` (`#ffd9a0`, `intensity: 2.0`, `position: [16, 22, 8]`, `shadow-mapSize={[2048, 2048]}`). **No `PMREMGenerator` / IBL environment map** (`scene.environment` is `null`), meaning metallic surfaces (`iron_forged`) have no specular environment reflections and look dark/flat.
- **Materials currently used (`L1–1926`):** `153` inline `<meshStandardMaterial>` tags using only flat hex `color`, `roughness` (`0.3–1.0`), `metalness` (`0.4–0.6` on gold trims only), `flatShading`, and `opacity`. Zero `map`, `normalMap`, `roughnessMap`, `metalnessMap`, `aoMap`, `emissiveMap`, or `envMapIntensity` bindings exist.
- **Color-space & texture validation gap:** No texture loader enforces `THREE.SRGBColorSpace` for albedo/emissive maps vs `THREE.NoColorSpace` (linear) for normal/roughness/metalness/AO maps, nor configures `anisotropy`, `wrapS`/`wrapT` (`RepeatWrapping`), or `flipY = false` for KTX2/glTF UV conventions.
- **Mobile quality/budget scaling gap:** Shadow map is unconditionally `2048×2048` on every device (`L1878`), and `dpr` is fixed `[1, 1.75]` (`L1861`). There is no `qualityProfiles` tiering (shadow resolution, anisotropy, LOD, or geometry culling).

---

## 4. Measured Browser / WebGL2 & Compression Capabilities (Headless SwiftShader)

Measured live on the running PR #26 client (`0a5e465ede6096ecdfc33b4771b0761baf327fab`) in `HeadlessChrome/153.0.8010.0` (`evidence/TDL-ARCH-001/smoke-report.json`):

| Capability | Measured Value (SwiftShader Vulkan 1.3.0) | Notes & Mobile Fallback Implications |
|---|---|---|
| WebGL Context | `WebGL 2.0 (OpenGL ES 3.0 Chromium)` | Desktop/mobile fallback in `CourtScene.tsx:58` accepts `webgl2 ?? webgl` |
| `MAX_TEXTURE_SIZE` | `8192` | Mobile WebView budget must still cap textures at ≤1024 px (`<=512 px` small props) |
| `MAX_CUBE_MAP_TEXTURE_SIZE` | `16384` | — |
| `MAX_COMBINED_TEXTURE_IMAGE_UNITS` | `64` | — |
| `MAX_SAMPLES` (MSAA) | `4` | — |
| `MAX_TEXTURE_MAX_ANISOTROPY_EXT` | `16` | Should clamp to `min(4, maxAnisotropy)` on mobile profile |
| `WEBGL_compressed_texture_s3tc` (BC1–BC3) | `true` | Typical Desktop GPU target via KTX2 UASTC/ETC1S transcoding |
| `WEBGL_compressed_texture_s3tc_srgb` | `true` | Needed for sRGB albedo BC1–BC3 |
| `EXT_texture_compression_bptc` (BC7) | `true` | Preferred high-quality Desktop target from KTX2 |
| `EXT_texture_compression_rgtc` (BC4/BC5) | `true` | Suitable for roughness/normal channels |
| `WEBGL_compressed_texture_etc` / `etc1` | `true` | Typical Android WebGL2 target |
| `WEBGL_compressed_texture_astc` | `true` | Primary modern iOS + Android GPU target via KTX2 |
| `WEBGL_compressed_texture_pvrtc` | `false` | Legacy iOS WebGL fallback (uncompressed RGBA8 / reduced PNG/WebP when ASTC absent) |

**Honest SwiftShader limitation:**  
`ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)))` is a **CPU software rasterizer**, not a real desktop or mobile GPU. Its extension flags and render times cannot validate real Telegram Mini App mobile GPU behavior, VRAM limits, shader compile stalls, battery/thermal throttling, or real FPS. Note also that the repository's own `tools/shots/browser.ts:105–106` defaults to `--disable-gpu`, which forces the `court-fallback.jpg` 2D branch unless SwiftShader flags are passed explicitly.

---

## 5. Baseline Verification & Runtime Smoke Results (PR #26 HEAD `0a5e465e...`)

All commands ran unmodified on the isolated checkout `/tmp/tdl-pr26`:

| Check / Command | Exit Code | Result Summary | Notes |
|---|---:|---|---|
| `pnpm typecheck` | `0` | `18/18` workspace tasks passed | Clean |
| `pnpm check` | `0` | Registry (`11` modules), boundaries, i18n (`24` kernel + `126` shell keys), calendar `2026–2028` valid | Clean |
| `pnpm build` | `0` | `3/3` tasks (`@tdl/server`, `@tdl/court3d`, `@tdl/client`) passed | `apps/client/dist` emits `1.3 MiB` JS + `7.8 MiB` `dist/icons/` |
| `pnpm test` | `0` *(turbo wrapper)* | `@tdl/kernel` `44/44`, `@tdl/client` `15/15`, `@tdl/server` `34/34`, `@tdl/host` `88 passed, 2 failed` (**181 passed, 2 failed**) | **Inherited `main` date-dependent failures** on test date `2026-11-12` in `packages/host/tests/clock.test.ts` and `packages/host/tests/switches.test.ts` |
| Runtime Smoke (`0a5e465e`) | `0` | `health.json` `ok: true`, desktop `1376×768` + mobile `390×844` + `320×690`, WebGL2 active, `0` failed asset requests | Captured 9 unedited runtime PNGs (`evidence/TDL-ARCH-001/screenshots/01..09.png`) |

### Key Runtime Smoke Findings
1. **Gameplay smoke verified on baseline:** registration -> lord creation -> full-yard Lv.1 render -> close-up zoom -> Farm build grid & placement (`wood 600->540`, `stone 400->370`, `power 145->185`) -> left long-press pickup -> TownHall upgrade to Lv.2 (`power 185->305`) -> Map & Court navigation -> mobile `390×844` and `320×690` (`horizontalOverflow: false`, zero HUD overlaps).
2. **Confirmed baseline input bug (`smoke-report.json`):** Holding **right mouse button for 700ms** without dragging triggered building pickup (`rightHold700msTriggeredPickup: true`), because `CourtInput` (`CourtScene.tsx:1443–1467`) starts the `550ms` hold timer without checking `e.nativeEvent.button === 0`.
3. **Confirmed runtime icon bug (`01-desktop-court-full-lv1.png`):** Right-rail Clan button visually displays a **gear** icon (`gear.png`) instead of `i-shield.png` due to `Hud.tsx:33` (`icon: "clan"`) vs `iconSrc.ts:10` (`shield`).
4. **Confirmed TownHall upgrade readability gap (`01` vs `05`/`06`):** Lv.1 and Lv.2 TownHalls are nearly indistinguishable (`+5%` scale + one thin gold belt at `y=2.54` barely visible beneath the roof cornice).
5. **Dev HMR console notice (`console.txt`):** In `pnpm dev` middleware mode, Vite HMR websocket attempted `ws://127.0.0.1:24678` (`ERR_CONNECTION_REFUSED` in headless mode without `TDL_HMR=1`); zero runtime JS exceptions (`app` errors = 0) and zero failed HTTP asset requests.
