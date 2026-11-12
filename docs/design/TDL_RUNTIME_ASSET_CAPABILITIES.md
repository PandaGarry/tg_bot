# TDL-ARCH-004 — Runtime & Toolchain Asset Capabilities (`TDL_RUNTIME_ASSET_CAPABILITIES.md`)

> **Task:** `TDL-ARCH-004` (Scope B)  
> **Audited source branch:** `refactor/tdl-asset-pipeline-foundation` (PR #26)  
> **Exact audited source SHA:** `0a5e465ede6096ecdfc33b4771b0761baf327fab`  
> **Arena delivery branch:** `arena/ff89979b-tg-bot` (documentation audit only; no packages or lockfiles modified)  
> **Date:** 2026-11-12

---

## 1. Audited Runtime & Dependency Baseline

Verified directly against `apps/client/package.json`, `apps/court3d/package.json`, `apps/client/vite.config.ts`, `apps/server/src/http.ts`, and `pnpm-lock.yaml` at `0a5e465ede6096ecdfc33b4771b0761baf327fab` (plus installed `node_modules` tree matching that byte-identical lockfile):

| Package / Tool | Declared / Installed Version | Where Declared / Verified | Current Usage in `apps/client/src` |
|---|---|---|---|
| `react` / `react-dom` | `19.3.0` | `apps/client/package.json:13-14` | UI shell + R3F reconciler; no `<Suspense>` around 3D scene/models |
| `@react-three/fiber` | `9.5.0` | `apps/client/package.json:11` | `<Canvas>`, `useFrame`, `useThree`; `useLoader` & `useGraph` exported but unused |
| `three` / `@types/three` | `0.182.0` | `apps/client/package.json:12,26` | Core scene/camera/primitives; `examples/jsm` loaders & decoders installed but unreferenced |
| `meshoptimizer` | `0.22.0` (transitive) | `pnpm-lock.yaml` / `node_modules/.pnpm` | Unused; `three/examples/jsm/libs/meshopt_decoder.module.js` present |
| `vite` / `@vitejs/plugin-react` | `8.3.1` / `6.1.1` | `apps/client/package.json:21,24` | `vite build` emits `dist/` (`sourcemap: true`); no `assetsInclude` for `.glb/.ktx2` |
| `typescript` | `5.9.3` | `apps/client/package.json:23` | Strict ESM compilation (`nodenext`/`bundler`) |
| `@react-three/drei` | **Not installed** | `apps/client/package.json` | None (`useGLTF`, `useKTX2`, `Environment` absent) |
| `@gltf-transform/*`, `gltfpack`, `toktx` | **Not installed** | `package.json`, `apps/client/package.json` | None (no offline glTF/KTX2/Draco asset-processing pipeline yet) |

---

## 2. Capability Matrix (Scope B)

Status taxonomy per `TDL-ARCH-004.md`:
- **`available now`** — usable in `apps/client` with zero new dependencies and zero missing runtime plumbing.
- **`possible with installed dependency`** — code/decoders exist in installed `three@0.182.0` / `@react-three/fiber@9.5.0` / `vite@8.3.1`, but require client wiring, static decoder hosting, and/or server MIME/cache fixes before safe production use.
- **`requires new dependency`** — missing from `package.json` / `pnpm-lock.yaml` (or requires external CLI/build tools).
- **`unsupported`** — blocked by current architecture/environment constraints.

| Capability Area | Status | Exact Evidence (`three@0.182.0` / R3F `9.5.0` / repo code) | Current Gaps & Required Wiring Before Production Use |
|---|---|---|---|
| **glTF / GLB loading in R3F & Three.js** | `possible with installed dependency` *(loaders `available now`, scene plumbing absent)* | `@react-three/fiber@9.5.0` exports `useLoader` & `useGraph` (`dist/declarations/src/core/hooks.d.ts`); `three@0.182.0/examples/jsm/loaders/GLTFLoader.js` (`114,883 B`) is installed with `setDRACOLoader`, `setKTX2Loader`, `setMeshoptDecoder`. | `apps/client/src/court/CourtScene.tsx` performs 0 network asset loads. Needs an `AssetLoader` wrapper, React `<Suspense>` + `ErrorBoundary` around `CourtScene`, clone/instancing helpers (`SkeletonUtils` if rigged later), and explicit disposal on unmount. |
| **`useGLTF` / `@react-three/drei` helpers** | `requires new dependency` | Not in `apps/client/package.json` or `pnpm-lock.yaml`. | Optional convenience only; `useLoader(GLTFLoader, ...)` from `@react-three/fiber@9.5.0` already covers glTF loading without adding `@react-three/drei`. |
| **PBR Material Maps (`map`, `normalMap`, `roughnessMap`, `metalnessMap`, `aoMap`, `emissiveMap`)** | `available now` | `@types/three@0.182.0/src/materials/MeshStandardMaterial.d.ts` exposes all six maps plus `normalScale`, `normalMapType`, `aoMapIntensity`, `emissiveIntensity`. | `CourtScene.tsx` uses 157 inline solid-color JSX materials (`153` `meshStandardMaterial`, `3` `meshBasicMaterial`, `1` `lineBasicMaterial`) with **0** bound textures. `aoMap` requires secondary UVs (`uv1`/`uv2`) in exported meshes. |
| **Color-space & normal-map handling** | `available now` *(runtime API)* / `possible with installed dependency` *(pipeline)* | `three@0.182.0/build/three.module.js` sets `WebGLRenderer.outputColorSpace = THREE.SRGBColorSpace` by default and provides `THREE.SRGBColorSpace`, `THREE.LinearSRGBColorSpace`, and `THREE.NoColorSpace`; `GLTFLoader.js` assigns `SRGBColorSpace` to color/emissive maps and linear/no-color-space to data maps. `CourtScene.tsx:1886-1889` enables `ACESFilmicToneMapping` (`exposure = 1.12`). | Manually loaded textures (via `TextureLoader`) must explicitly tag `colorMap.colorSpace = THREE.SRGBColorSpace` and keep `normalMap`, `roughnessMap`, `metalnessMap`, and `aoMap` at `THREE.NoColorSpace`. All normal maps must standardize on glTF/Three.js OpenGL `+Y` tangent-space convention (`TangentSpaceNormalMap`). |
| **IBL / Environment lighting (`.hdr` / `.exr`)** | `possible with installed dependency` | `three@0.182.0/examples/jsm/loaders/HDRLoader.js` (`12,445 B`), `EXRLoader.js` (`66,746 B`), and `UltraHDRLoader.js` (`15,079 B`) exist. Note: `RGBELoader.js` (`268 B`) is `@deprecated, r180` and warns to use `HDRLoader`. | Current scene uses only `<hemisphereLight>` + `<directionalLight>` (`CourtScene.tsx:1895-1906`). Adding metallic PBR materials without `PMREMGenerator` / `scene.environment` will cause dark metals; avoid `RGBELoader` and use `HDRLoader` (or baked procedural `RoomEnvironment`/PMREM). |
| **Texture compression / transcoding (KTX2 / Basis Universal)** | `possible with installed dependency` *(runtime)* / `requires new dependency` *(encoding)* | `three@0.182.0` ships `KTX2Loader.js` (`35,695 B`), `basis_transcoder.js` (`57,529 B`), and `basis_transcoder.wasm` (`527,333 B`), plus `GLTFLoader.setKTX2Loader()`. | 1. Copy `basis_transcoder.{js,wasm}` to static path (e.g. `apps/client/public/decoders/basis/`).<br>2. Fix `apps/server/src/http.ts:322-331` MIME types for `.wasm` (`application/wasm`) and `.ktx2` (`image/ktx2`).<br>3. Call `ktx2Loader.detectSupport(gl)` inside R3F `onCreated` / loader singleton.<br>4. Offline `.ktx2` encoding (`toktx` / `@gltf-transform/cli`) requires external tooling/devDependency. |
| **Geometry compression (Draco & Meshopt)** | `possible with installed dependency` *(runtime)* / `requires new dependency` *(encoding)* | `three@0.182.0` ships `DRACOLoader.js` (`17,774 B`), `draco_decoder.{js,wasm}` (`512,465 B` / `192,420 B`), `meshopt_decoder.module.js` (`24,848 B`), and `meshoptimizer@0.22.0` in pnpm store; `GLTFLoader` supports both `setDRACOLoader` and `setMeshoptDecoder`. | **Prefer Meshopt over Draco** for small stylized meshes: `meshopt_decoder.module.js` is only `24.8 KB` (JS/WASM self-contained, zero `.wasm` MIME dependency if bundled) vs `~705 KB` Draco JS+WASM. Offline compression (`gltfpack` / `@gltf-transform/cli`) requires adding devDependencies/build script. |
| **Mobile fallback behavior & lazy loading** | `available now` *(WebGL missing gate)* / `possible with installed dependency` *(tiering & lazy chunks)* | `CourtScene.tsx:58-66,1870-1874` detects `webgl2 \|\| webgl` and falls back to `court-fallback.jpg` (`123,918 B`). `Canvas` caps `dpr={[1, 1.75]}` and `shadows` (`2048x2048` map). `vite@8.3.1` supports `React.lazy()` code splitting. | 1. Current `apps/client` ships a single ~1.3 MB JS bundle (plus `5.4 MB` `.map` in `dist/assets/`). `CourtScene` should be `React.lazy`-loaded or paired with `<Suspense>`.<br>2. `CourtScene.tsx` has **no** `webglcontextlost` recovery handler (`TDL-ARCH-003` observed `THREE.WebGLRenderer: Context Lost.` on desktop Court→Map→Court remount).<br>3. `Ground()` creates 26 `THREE.ShapeGeometry` instances (`CourtScene.tsx:207-247`) without `.dispose()`.<br>4. No `QualityProfile` selector exists yet (`dpr`, shadow resolution, texture cap `512`/`1024`, instanced foliage density). |
| **Vite & production server (`apps/server/src/http.ts`) asset serving** | `available now` *(baseline HTML/JS/PNG)* with **4 production blockers for 3D assets** | `apps/client/vite.config.ts:1-22`; `apps/server/src/http.ts:55-96,322-339`. | See §3 below: missing MIME types (`.glb`, `.gltf`, `.ktx2`, `.wasm`, `.jpg`), `immutable` 1-year cache header on unhashed `public/` assets, SPA `index.html` fallback on missing static paths, and `public/icons/` dead weight. |

---

## 3. Vite Build & Production Server (`apps/server/src/http.ts`) Findings

1. **Missing MIME mappings in `apps/server/src/http.ts:322-331`:**
   `contentType(path)` currently maps **only**:
   `.html`, `.js`, `.css`, `.json`, `.svg`, `.png`, `.woff2`.
   Every other extension defaults to `application/octet-stream`:
   - `.wasm` → `application/octet-stream` (**breaks `WebAssembly.instantiateStreaming()`** in modern browsers for Basis/Draco WASM decoders).
   - `.glb` → `application/octet-stream` (should be `model/gltf-binary`).
   - `.gltf` → `application/octet-stream` (should be `model/gltf+json`).
   - `.ktx2` → `application/octet-stream` (should be `image/ktx2`).
   - `.jpg` / `.jpeg` → `application/octet-stream` (currently applies to `court-fallback.jpg` and `emblem.jpg`!).
   - `.webp` → `application/octet-stream` (should be `image/webp`).

2. **Immutable cache hazard on unhashed `public/` paths (`apps/server/src/http.ts:87`):**
   Every response except `index.html` is served with:
   `cache-control: public, max-age=31536000, immutable`.
   This is safe for Vite-hashed files under `/assets/*`, **unsafe for unhashed files under `apps/client/public/`** (such as `/icons/*.png`, `/court-fallback.jpg`, `/models/*.glb`, or `/decoders/*`). Replacing a model or texture at the same `public/` URL will leave clients pinned to stale cached bytes for up to 365 days unless assets use Vite-imported hashed URLs, content-hashed filenames, or versioned manifest paths.

3. **Silent SPA `200 index.html` fallback on missing asset URLs (`apps/server/src/http.ts:74-86`):**
   When `wanted` is not a file inside `distRoot`, `target` silently resets to `indexHtml` (`200 OK`, `text/html`). A missing `/models/citadel_lv1.glb` or `/decoders/basis/basis_transcoder.wasm` will return HTML instead of HTTP `404`, producing cryptic glTF/WASM parse failures unless static asset prefixes (`/models/`, `/textures/`, `/decoders/`, `/icons/`) return `404`.

4. **Vite bundle & `public/` payload behavior (`apps/client/vite.config.ts`):**
   - `build.sourcemap: true` emits a `~5.4 MB` `.js.map` alongside `~1.3 MB` JS in `apps/client/dist/assets/`.
   - `vite.config.ts` sets no `assetsInclude` for `.glb`/`.gltf`/`.ktx2`, so models imported via ES `import` would fail Vite transform unless stored under `public/` (unhashed!) or added to `assetsInclude` (recommended for Vite content-hashing!).
   - All `38` files in `apps/client/public/` (`8,205,758 B`) are copied verbatim into `dist/`, including `13` unreferenced legacy PNGs (`2,730,207 B`).

---

## 4. Recommended Capability Path (No Dependency Bloat Required for Phase B-D)

1. **Zero new runtime dependencies needed for Citadel vertical slice:** Use installed `@react-three/fiber@9.5.0` (`useLoader`) + `three@0.182.0` (`GLTFLoader`, `MeshStandardMaterial`, `SRGBColorSpace` / `NoColorSpace`, and `meshopt_decoder.module.js` if geometry compression is enabled).
2. **Defer Basis/KTX2 runtime transcoding until needed:** `585 KB` of Basis JS+WASM decoder overhead is unnecessary for a single vertical-slice Citadel if textures fit within `512x512`/`1024x1024` compressed PNG/WebP inside `.glb`; adopt KTX2 only once multi-building VRAM budgets demand GPU-compressed textures (and after fixing `.wasm`/`.ktx2` MIME in `apps/server/src/http.ts`).
3. **Require server MIME + unhashed-cache fix before shipping first `.glb`/`.ktx2`/`.wasm` assets** (not during `TDL-ARCH-004` audit).
