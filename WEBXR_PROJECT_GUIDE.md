# WebXR / A-Frame Project Guide: Structure, Code Patterns and Best Practices

A project-independent reference for building scalable, maintainable, mobile-friendly WebXR experiences
(A-Frame first, with notes for plain three.js and other static-site projects).
Everything here is a **default to start from**; deviate on purpose, not by accident.

> Version note: A-Frame, three.js and browsers change often. Component/attribute names below match
> A-Frame 1.x conventions; always confirm details in the docs of the exact version you pin.

---

## Table of contents

1. Principles
2. Project layout
3. Naming and code conventions
4. `index.html` anatomy
5. Script loading and execution order
6. A-Frame code structure (components, systems, primitives, mixins, events)
7. Separating logic from view; state; data-driven content
8. UI: DOM overlay vs in-world UI
9. Input and interaction
10. XR sessions, feature detection, compat shims, diagnostics
11. Assets: organization, optimization, 360 media, audio, models, loading
12. Performance
13. Dependency management and vendoring
14. Dev environment, device testing and debugging
15. Testing and QA
16. CI and deployment (GitHub Pages)
17. Git workflow
18. Documentation and AI-assistant files
19. Security, privacy, accessibility
20. Common pitfalls
21. Checklists
22. Appendix: ready-to-copy templates

---

## 1. Principles

1. **Static, no build step by default.** Plain HTML, CSS and JS served as-is. It is easy to host (GitHub Pages), debug on a phone and understand. Add a bundler only when a concrete need appears (large dependency graph, TypeScript, tree-shaking), never "just because".
2. **Separation of concerns.** Pure logic (rules, state, math) is separate from rendering (A-Frame/three.js), which is separate from UI (DOM). Logic must be testable in Node without a browser.
3. **One responsibility per file.** One component per file, one system per file, small modules.
4. **Declarative scene, imperative logic.** The HTML describes the scene structure; behavior lives in components and systems.
5. **Loose coupling through events.** Components do not reach into each other; they emit and listen to events or talk to a system.
6. **Mobile-first performance.** Budget draw calls, textures and per-frame work from day one; measure on a real mid-range phone, not only on a desktop.
7. **Relative paths, pinned dependencies, vendored libraries.** Reproducible builds, works from any sub-path, works offline.
8. **Progressive enhancement.** The page must say something useful where WebXR is not supported, and non-XR "magic window" modes should work where possible.
9. **Measure, then optimize.** Keep debug and diagnostic tools in the project, off by default.
10. **Work in small, verified increments.** Implement, test, debug, stabilize, then move on. Keep a plan file and a status log.

---

## 2. Project layout

```
project/
├── index.html                  entry page (one per experience/scene if multi-page)
├── css/
│   ├── style.css               global/base styles + overlay UI
│   └── <page>.css              page-specific styles (optional)
├── js/
│   ├── compat/                 browser workarounds and polyfills (classic scripts)
│   │   └── xr-compat.js
│   ├── debug/                  diagnostics, HUD, logger (off by default)
│   │   └── xr-diagnostics.js
│   ├── components/             A-Frame components (one per file, kebab-case)
│   ├── systems/                A-Frame systems (shared state/services)
│   ├── primitives/             A-Frame primitives (optional)
│   ├── core/                   pure logic: no A-Frame, no THREE, no DOM (unit-testable)
│   ├── state/                  store / state machine (if not inside a system)
│   ├── ui/                     DOM overlay controllers (HUD, dialogs, menus)
│   ├── utils/                  small helpers (math, dom, params, logger)
│   ├── config.js               constants and feature flags
│   └── main.js                 bootstrap: wires modules together, nothing else
├── lib/                        vendored third-party libraries (pinned) + lib/README.md
├── assets/
│   ├── images/                 textures/, 360/, ui/, icons/
│   ├── video/
│   ├── audio/                  sfx/, music/, voice/
│   ├── models/                 *.glb (+ LICENSES.md)
│   └── fonts/
├── data/                       JSON: scene definitions, content, localization
├── tests/                      *.test.mjs  (node --test) for core/ and utils/
├── tools/                      dev scripts: check-links.mjs, vendor.mjs, optimize scripts
├── docs/                       PLAN.md, ARCHITECTURE.md, TESTING.md, decisions/
├── .github/
│   ├── workflows/ci.yml
│   └── copilot-instructions.md  (conventions for AI assistants)
├── .editorconfig
├── .gitignore
├── .nojekyll                   (empty; stops GitHub Pages from running Jekyll)
├── package.json                (scripts + pinned deps used only to fetch/vendor/test)
├── README.md
└── LICENSE
```

### Why each folder exists
- **`js/compat/` first-class citizen.** Browser regressions happen. Isolating workarounds in one place, loaded first, behind flags, keeps app code clean and makes workarounds removable.
- **`js/core/`** is the scalability engine: logic that does not know about A-Frame can be tested, reused in other projects, and later moved to a server (for multiplayer, validation, etc.).
- **`lib/`** committed on purpose. GitHub Pages serves the repository files; it will not run `npm install`.
- **`data/`** keeps content out of code and out of giant HTML files.
- **`tools/`** holds scripts that are not shipped to users.

### Scaling the layout (feature folders)
When there are more than roughly 15 components, group by feature instead of by type:

```
js/features/
├── navigation/   component.js  system.js  logic.js  ui.js  README.md
├── inventory/    ...
└── audio/        ...
```
Shared code stays in `js/core/` and `js/utils/`. Pick **one** organization (by type or by feature) per project and keep it.

### Multi-page / multi-scene projects
- Keep each published page at the repo root (`index.html`, `tour.html`, ...) so URLs stay stable.
- Share code via `js/` and `css/`; page-specific bootstrap goes in `js/pages/<page>.js`.
- Never duplicate vendored libraries per page; always reference the same `lib/` copy.
- If a page is renamed or moved, leave a small redirect stub at the old path.

---

## 3. Naming and code conventions

| Item | Convention | Example |
|---|---|---|
| Files and folders | lowercase kebab-case, ASCII, no spaces | `scene-manager.js`, `hand-pointer.js` |
| A-Frame components | kebab-case, **file name = component name** | `teleport-pad.js` → `AFRAME.registerComponent('teleport-pad', ...)` |
| Systems | kebab-case, file name = system name | `app-state.js` |
| JS identifiers | camelCase; classes PascalCase; constants UPPER_SNAKE | `maxDistance`, `class Store`, `MAX_HINTS` |
| DOM ids/classes | kebab-case | `#start-button`, `.is-hidden` |
| Custom events | `domain:action`, past tense for facts | `app:state-changed`, `item:picked` |
| URL flags | short lowercase | `?debug=1`, `?stats=1` |
| Commits | Conventional Commits | `feat(ui): add pause menu` |

Rules:
- **Units are meters, angles are radians in code** (A-Frame attributes use degrees for rotation; convert at the edge). Write the convention in `docs/ARCHITECTURE.md`.
- **Document coordinate conventions** (which axis is up/forward, where the origin is).
- No magic numbers: put tunables in `config.js` or component schemas.
- No globals except the framework objects (`AFRAME`, `THREE`). If you must share, use a system or a module.
- No inline event handlers (`onclick=""`) and no inline `<script>`/`<style>` blocks in finished pages.
- Prefer early returns, short functions, and comments that explain *why*.
- Add JSDoc types on public functions; it gives editor help without TypeScript.
- Use an `.editorconfig` (Appendix) so every editor/AI tool formats identically.

---

## 4. `index.html` anatomy (A-Frame)

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Experience title</title>
  <link rel="stylesheet" href="./css/style.css">

  <!-- 1. Compat shims and diagnostics: ALWAYS FIRST, classic scripts, before any library -->
  <script src="./js/compat/xr-compat.js"></script>
  <script src="./js/debug/xr-diagnostics.js"></script>

  <!-- 2. Framework (vendored, pinned) -->
  <script src="./lib/aframe/aframe.min.js"></script>

  <!-- 3. Third-party A-Frame components (vendored, pinned) -->
  <script src="./lib/aframe-extras/aframe-extras.min.js"></script>

  <!-- 4. App systems and components: each file only REGISTERS, in dependency order -->
  <script src="./js/systems/app-state.js"></script>
  <script src="./js/components/example-widget.js"></script>

  <!-- 5. Bootstrap (wires UI and app flow) -->
  <script src="./js/main.js" defer></script>
</head>

<body>
  <!-- DOM overlay UI lives OUTSIDE the scene -->
  <div id="overlay" class="overlay">
    <div id="status" class="status" role="status" aria-live="polite"></div>
    <div id="controls" class="controls">
      <button id="btn-primary" type="button">Action</button>
    </div>
  </div>

  <a-scene
    webxr="optionalFeatures: local-floor, hit-test, dom-overlay; overlayElement: #overlay"
    renderer="antialias: true"
    loading-screen="enabled: true"
    device-orientation-permission-ui>

    <a-assets timeout="30000">
      <img id="tex-sky" src="./assets/images/360/sky.jpg" crossorigin="anonymous">
      <video id="vid-intro" src="./assets/video/intro.mp4"
             playsinline webkit-playsinline crossorigin="anonymous" preload="auto" loop></video>
      <audio id="snd-click" src="./assets/audio/sfx/click.mp3" preload="auto"></audio>
      <a-asset-item id="mdl-widget" src="./assets/models/widget.glb"></a-asset-item>
      <a-mixin id="clickable" class="clickable"></a-mixin>
    </a-assets>

    <!-- Camera rig: move the rig, not the camera, so head tracking stays intact -->
    <a-entity id="rig" position="0 0 0">
      <a-entity id="head" camera look-controls wasd-controls="enabled: false">
        <a-entity cursor="rayOrigin: mouse" raycaster="objects: .clickable"></a-entity>
      </a-entity>
    </a-entity>

    <!-- Content -->
    <a-sky src="#tex-sky"></a-sky>
    <a-entity id="widget" gltf-model="#mdl-widget" example-widget="speed: 2"></a-entity>
  </a-scene>
</body>
</html>
```

Rules for this file:
- Head order is **compat → framework → third-party components → app code → bootstrap**.
- Preload everything the first view needs in `<a-assets>`; set a sensible `timeout`.
- Keep the HTML scene **small and declarative**. Repeated or data-driven content is created by components from JSON (see §7).
- Overlay UI is a normal DOM subtree, not inside `<a-scene>`.
- Check the exact attribute names of `webxr`, `renderer`, `xr-mode-ui` / `vr-mode-ui` in your pinned A-Frame version.

---

## 5. Script loading and execution order

A-Frame needs components registered **before the entities that use them initialize**.

**Option A: classic scripts (simplest, deterministic).** Put each file in `<head>` after the framework, in dependency order (as in §4). Each file only calls `AFRAME.registerComponent(...)`.

**Option B: ES modules.** Use `<script type="module">`; modules run after parsing but before `DOMContentLoaded`. Register components synchronously at module top level. Never register inside async callbacks after the scene has loaded. Use an import map for bare specifiers, and keep any workaround scripts as classic scripts.

Rules:
- Compat shims are always classic scripts, first in `<head>`, never `defer`/`module`.
- Don't mix global-dependent legacy scripts with modules unless you expose globals deliberately.
- Don't add `async`/`defer` to framework or component scripts unless you have verified the order.
- `main.js` runs last; it connects UI to the scene (`sceneEl.addEventListener('loaded', ...)`) and holds no business logic.

---

## 6. A-Frame code structure

A-Frame is an entity-component-system on top of three.js: **entities** are containers, **components** add behavior/appearance, **systems** hold shared state/services.

### 6.1 Component template

```js
// js/components/example-widget.js
(() => {
  const THREE = AFRAME.THREE;

  AFRAME.registerComponent('example-widget', {
    schema: {
      speed:   { type: 'number', default: 1 },
      target:  { type: 'selector' },
      active:  { type: 'boolean', default: true }
    },

    init() {
      // Allocate ONCE. Never allocate inside tick().
      this.tmpVec = new THREE.Vector3();
      this.elapsed = 0;

      // Bind handlers once so they can be removed.
      this.onClick = this.onClick.bind(this);
      this.el.addEventListener('click', this.onClick);
    },

    update(oldData) {
      // Called after init and whenever data changes. Apply only what changed.
      if (oldData.active !== undefined && oldData.active !== this.data.active) {
        this.el.object3D.visible = this.data.active;
      }
    },

    // Throttled per-frame work (here ~10 Hz). Use plain tick() only if it must run every frame.
    tick: AFRAME.utils.throttleTick(function (time, dt) {
      if (!this.data.active) return;
      this.elapsed += dt / 1000;
      // Write to object3D directly. setAttribute() every frame is slow.
      this.el.object3D.rotation.y = this.elapsed * this.data.speed;
    }, 100),

    onClick(evt) {
      this.el.emit('widget:activated', { time: performance.now() }, true);
    },

    remove() {
      // Undo everything init() did: listeners, timers, three.js resources.
      this.el.removeEventListener('click', this.onClick);
    }
  });
})();
```

Component rules:
- **Schema-driven.** Configuration goes through the schema (typed, defaulted, inspectable) rather than ad hoc globals.
- **One job per component.** Prefer composing two small components over one big one.
- **Declare dependencies** (`dependencies: ['raycaster']`) when a component requires another.
- **Clean up in `remove()`.** Listeners, intervals, `dispose()` of geometries/materials/textures you created.
- **`tick` is hot code:** no allocations, no `querySelector`, no `setAttribute`, throttle when possible.
- **Multiple instances:** use `multiple: true` when the same component can appear twice on one entity.
- **Don't reach across entities** with `document.querySelector` inside components; take targets from the schema (`type: 'selector'`) or events.

### 6.2 System template (shared state and services)

```js
// js/systems/app-state.js
AFRAME.registerSystem('app-state', {
  init() {
    this.state = { phase: 'idle', score: 0 };
  },

  dispatch(action, payload = {}) {
    const prev = this.state;
    this.state = reduce(prev, action, payload);        // pure function
    this.sceneEl.emit('app:state-changed', { prev, next: this.state, action }, false);
  },

  get() { return this.state; }
});

function reduce(state, action, payload) {
  switch (action) {
    case 'start':    return { ...state, phase: 'running' };
    case 'finish':   return { ...state, phase: 'done', score: payload.score ?? state.score };
    default:         return state;
  }
}
```
Components access it with `this.el.sceneEl.systems['app-state']`. Keep reducers **pure** and put them in `js/core/` if they are non-trivial, so they can be unit-tested.

### 6.3 Primitives and mixins
- **Mixins** (`<a-mixin>`) share attribute sets (materials, interaction classes). Use them to avoid repeating attributes across many entities.
- **Primitives** (`AFRAME.registerPrimitive`) are convenience tags that map to entities + components. Use sparingly; plain entities with components are easier to reason about.

### 6.4 Events (the communication backbone)
- Emit with `el.emit(name, detail, bubbles)`; listen on the entity or the scene.
- Name events `domain:action`. Keep payloads small and plain-JSON.
- Prefer **state-changed events from a system** over components polling each other.
- Remove listeners in `remove()`; never leave anonymous listeners you can't remove.

### 6.5 Plain three.js variant (no A-Frame)
Use the same separation with ES modules and an import map:

```
js/
├── main.js          bootstrap
├── xr/              session.js (renderer, XR button, frame loop), placement.js
├── core/            pure logic
├── view/            scene objects, factories, animations
├── ui/              DOM overlay
└── input/           gestures, controllers
```
One renderer, one frame loop in `xr/session.js`; modules register per-frame callbacks instead of owning their own `requestAnimationFrame`.

---

## 7. Separating logic from view; state; data-driven content

### 7.1 Pure core + thin adapters
```
user input ─▶ intent ─▶ core/logic (pure) ─▶ events/result ─▶ view (animate) + ui (notify)
```
- `core/` takes plain data in and returns plain data/events out. No `THREE`, no DOM, no `AFRAME`.
- A-Frame components are **adapters**: they translate scene events into core calls and core results into scene changes.
- Benefits: Node unit tests, reuse on a server (validation, multiplayer), and easy replacement of the rendering layer.

### 7.2 State management
- Simple apps: one system with a pure reducer (§6.2).
- Larger apps: a tiny store (`subscribe`, `getState`, `dispatch`) in `js/state/`.
- Model flow as an explicit **state machine** (`loading → menu → running → paused → finished`) so impossible states cannot occur.
- Make state **serializable** (plain JSON). It enables save/load, replays, debugging dumps and network sync.

### 7.3 Data-driven content
- Describe scenes, hotspots, media lists and text in `data/*.json`; one factory component creates entities from it.
- Keeps HTML small, lets non-developers edit content, and enables localization (`data/i18n/<lang>.json`).
- Validate data on load (required fields, asset paths exist) and fail with a readable message.

### 7.4 Config and flags
`js/config.js` exports constants and reads URL flags once:

```js
export const FLAGS = Object.freeze({
  debug: new URLSearchParams(location.search).get('debug') === '1'
});
```
(For classic scripts expose a single `window.APP_CONFIG` object instead.)

---

## 8. UI: DOM overlay vs in-world UI

| | DOM overlay | In-world UI (a-text, planes, canvas textures) |
|---|---|---|
| Where it works | Handheld AR (Chrome Android with `dom-overlay`), flat screens | Headsets and any XR mode |
| Strengths | Real HTML/CSS, accessible, crisp text, easy to build | Visible in all XR modes, spatial |
| Weaknesses | Not shown in most headset sessions | Harder to make crisp, accessible and responsive |

Guidelines:
- Use the **DOM overlay for phone AR** (status text, buttons, dialogs) and provide **in-world equivalents** for headsets if you target them.
- Overlay root is `pointer-events: none`; only interactive children get `pointer-events: auto`.
- Intercept taps on overlay controls so they don't also hit the 3D scene: call `preventDefault()` on the `beforexrselect` event for those elements.
- Respect safe areas: `padding: env(safe-area-inset-*)` and `viewport-fit=cover`.
- UI code lives in `js/ui/`, never inside components that manage 3D objects. Communicate through events or the store.
- Large touch targets (≥ 44-48 px), high contrast over camera video, short text.

---

## 9. Input and interaction

- Normalize all inputs into **intents** (`select`, `confirm`, `cancel`, `move`, `zoom`) so touch, mouse, controllers, gaze and hand input feed the same logic.
- A-Frame: `cursor` + `raycaster="objects: .clickable"`; mark interactable entities with a class (via a mixin) instead of raycasting the whole scene.
- Controllers: `laser-controls` / `hand-controls` / `oculus-touch-controls`, depending on target devices.
- Handheld AR: taps arrive as XR `select` events and/or DOM pointer events. If both can fire, **dedupe** (ignore a second tap within ~300 ms).
- Gestures (pinch, twist, drag): implement in one `gestures` module using pointer events, track pointers in a `Map`, compute from the same pointers each move, and **suppress taps for a short time after a gesture**.
- Always provide a **fallback input** (on-screen buttons) for gestures that may fail.
- Use cheap **colliders** (invisible simple meshes) for picking instead of raycasting high-poly models.
- Autoplay/audio policies need a user gesture: wire "Start/Enter" buttons to resume audio and start video.

---

## 10. XR sessions, feature detection, compat shims, diagnostics

### 10.1 Feature detection and fallback
```js
const supported = await navigator.xr?.isSessionSupported('immersive-ar').catch(() => false);
```
- Show a clear message and a non-XR mode when unsupported.
- WebXR needs a **secure context** (HTTPS or `localhost`). Phone testing over a LAN IP over plain HTTP will not work.
- Request optional features as **optional**; the experience must work (degraded) without them.
- Handle `sessionstart` / `sessionend` (reset state, cancel hit-test sources, release resources).

### 10.2 Compat shims (keep them isolated)
- Put workarounds in `js/compat/*.js`: classic scripts, loaded first, tiny, **documented with why they exist, which versions they affect and how to remove them**.
- Gate them with URL flags so you can A/B test them (`?flag=1` keep native behavior, `?flag=0` force workaround).
- Keep a **diagnostics script** (`js/debug/xr-diagnostics.js`) that records which render path/features a session used; read it after exiting XR.
- Re-test shims on browser updates and remove them when the underlying issue is fixed.

Example: some Android Chrome builds had issues with the WebXR projection-layers rendering path (content invisible while camera/tracking worked). The shim hides the layers API so three.js/A-Frame use the classic layer. See Appendix A.

### 10.3 Session hygiene
- One owner for the render loop and XR session (session system/module).
- Cancel hit-test sources and anchors on session end.
- Anchor-relative content: keep user adjustments as **offsets relative to the anchored root**, never move the anchor itself repeatedly.
- Pause expensive work (hand tracking, particles, video decode) when not needed or when the tab is hidden (`visibilitychange`).

---

## 11. Assets

### 11.1 Organization
- Group by **type**, then by purpose: `assets/images/360/`, `assets/images/textures/`, `assets/audio/sfx/`, ...
- Names: lowercase kebab-case ASCII, no spaces. Include meaningful suffixes (`-4k`, `-mono`) and **never rely on case** (GitHub Pages is case-sensitive).
- Reference assets through `<a-assets>` ids in HTML and through `assets/...` relative paths in JS/CSS.
- Keep `assets/models/LICENSES.md` (and similar) with source, license, attribution for every third-party asset.

### 11.2 Images and textures
- Power-of-two sizes where possible; **≤ 4096 px** per side for broad mobile compatibility (some devices cap lower).
- JPEG (quality ~80-85) for photos and 360 images, PNG for UI/alpha, WebP where supported; consider KTX2/Basis for large texture sets once you need GPU-compressed memory savings.
- 360 equirectangular images: 2:1 ratio, typically 4096×2048 (stereo top/bottom: 4096×4096).
- Example: `magick in.jpg -resize 4096x2048 -quality 82 -strip assets/images/360/out.jpg`

### 11.3 Video
- H.264 (MP4) with AAC audio is the most widely decodable. Keep resolution modest for mobile (e.g. 2880×1440 or 3840×1920 for 360; test on target phones).
- Enable fast start: `-movflags +faststart`.
- Example: `ffmpeg -i in.mp4 -c:v libx264 -profile:v main -pix_fmt yuv420p -crf 23 -preset slow -vf scale=2880:1440 -c:a aac -b:a 128k -movflags +faststart out.mp4`
- `<video>` attributes: `playsinline webkit-playsinline crossorigin="anonymous" preload="auto"`; start with a user gesture; unmute after a gesture.
- Hosting must support HTTP Range requests (GitHub Pages does); large videos may need external hosting/CDN.

### 11.4 Audio
- MP3/AAC (broad support) or Ogg where acceptable; mono for positional sounds, shorter loops for music; normalize loudness.
- Resume/unlock audio on the first user gesture (browser autoplay policy).
- Use positional audio (`sound` component) for spatial cues; limit simultaneous sources.

### 11.5 3D models
- **glTF 2.0 / GLB** is the standard (single binary, PBR materials). Convert OBJ/FBX to GLB offline (Blender, `obj2gltf`, glTF-Transform).
- Budget per asset: triangles, textures, materials; one material per object where possible.
- Origin at the logical pivot (e.g. base center), +Y up, real-world scale in meters, no cameras/lights/animations unless needed.
- Optimize with glTF-Transform (`npx @gltf-transform/cli inspect model.glb`, then `optimize`; check `--help` for the flags of your version). Add Draco/meshopt/KTX2 only if you also configure the loaders for them.
- Share geometry and materials across clones; dispose them when removed.

### 11.6 Loading UX
- Preload the first scene in `<a-assets>`; lazy-load later scenes on demand with a loader component.
- Show progress (`a-assets` `progress`/`loaded`/`timeout` events) and handle failures with a visible message and a fallback.
- Add a cache-busting version to rarely-changing, heavily cached files when you update them (`?v=3` or hashed names).

### 11.7 Repository size limits (GitHub; verify current values)
- Single files over 50 MB trigger warnings; **over 100 MB are rejected**. Keep repositories reasonably small (around 1 GB or less). Pages sites have size and bandwidth soft limits.
- Large media: compress first; otherwise host externally (object storage/CDN) and reference by absolute `https://` URL with proper CORS headers.
- Git LFS objects have historically not been served correctly by GitHub Pages; verify before relying on it.

---

## 12. Performance

### 12.1 Budgets for mid-range phones (starting points)

| Metric | Target |
|---|---|
| Frame rate | ≥ 30 fps sustained in XR (aim 55-60), no long hitches |
| Draw calls | < 100 (aim < 60) |
| Triangles | < 150-300 k |
| Texture memory | < 64-128 MB, no texture above 4096² |
| Lights | 1-2; one shadow-casting at most |
| Per-frame allocations | none in steady state |
| Long sessions | no fps decay or memory growth over 10 minutes |

### 12.2 Rules of thumb
- Reuse geometries/materials/textures; instance repeated objects (three.js `InstancedMesh` through a small custom component).
- Merge static meshes; avoid many tiny objects with unique materials.
- Prefer baked lighting/textures to real-time lights; shadows only where they matter, small shadow maps (512-1024), update only when something moves.
- Limit transparency overdraw and large alpha-blended surfaces; avoid post-processing on phones.
- `tick` functions: few, throttled, allocation-free; write `object3D` properties directly.
- Use object pools for frequently created/destroyed things (markers, effects, bullets).
- Dispose geometry/material/texture when removing objects; `renderer.info` shows what is alive.
- Resolution levers: `renderer.xr.setFramebufferScaleFactor` (three.js) / renderer attributes (A-Frame), foveation level, antialias toggle, max canvas size. Make them configurable and test on-device.
- Debug layers (point clouds, bounding boxes, HUD) must be **off in normal use** and throttled when on.
- Don't run heavy ML/vision work every frame: throttle it (e.g. 10 Hz) and make it opt-in.

### 12.3 Profiling
- A-Frame `stats` component for quick dev stats; custom HUD with frame time (avg/max), draw calls, triangles, geometries, textures.
- Chrome remote debugging → Performance and Memory tabs on the phone session.
- Test protocol: fixed scenario, same device, 3 runs, record fps/draw calls/heap in the status log; compare after each milestone.
- Watch **thermal throttling**: a 10-minute test reveals what a 30-second test hides.

---

## 13. Dependency management and vendoring

- Fetch libraries with npm **only to pin and copy them**:
  ```bash
  npm init -y
  npm install aframe --save-exact          # or three, etc.
  ```
  Copy the built file(s) into `lib/<name>/` (the file name under `node_modules/<pkg>/dist/` depends on the version), commit them, and commit `package-lock.json`.
- Add a `vendor` npm script (or `tools/vendor.mjs`) so the copy is repeatable; `node_modules/` is git-ignored, `lib/` is committed.
- `lib/README.md` lists each library: name, exact version, source URL, license.
- **Pin exact versions** (no `latest`, no ranges). Prefer versions that have been public for a couple of weeks (supply-chain caution).
- Avoid CDN script tags for production; if a CDN is unavoidable, pin the exact version and consider Subresource Integrity (SRI).
- Don't upgrade a framework mid-feature. Upgrade in its own branch with the regression checklist.
- Prefer small, well-maintained libraries; check licenses before adding them.

---

## 14. Dev environment, device testing and debugging

### 14.1 Serving
- Desktop: any static server (`python3 -m http.server 5500`, a VS Code live-server extension, `npx serve`).
- WebXR requires HTTPS or `localhost`. For a phone:
  1. **USB port forwarding (simplest):** `adb reverse tcp:5500 tcp:5500`, then open `http://localhost:5500` on the phone.
  2. **Chrome flag** `chrome://flags/#unsafely-treat-insecure-origin-as-secure` for a LAN address (dev only).
  3. **HTTPS tunnel** (cloudflared/ngrok) or **GitHub Pages** for a real HTTPS URL.

### 14.2 Remote debugging
- Desktop Chrome → `chrome://inspect/#devices` → inspect the phone tab (console, network, performance).
- `adb logcat | grep -iE "chromium|arcore|webxr|gles"` for crashes and GPU errors.
- Useful device info: `chrome://version`, `chrome://gpu`, versions of the browser and of the platform AR service.

### 14.3 In-app debugging
- Flag-controlled HUD (`?debug=1`): fps, frame ms, draw calls, session features, errors, last log lines. Visible inside the DOM overlay.
- Capture `window.onerror` and `unhandledrejection` into the HUD log; on phones you often cannot see the console.
- Visual debug helpers: axes, bounding boxes, hit-test point clouds, plane polygons (when supported), ghost/preview objects.
- A-Frame Inspector (Ctrl+Alt+I) on desktop; the Immersive Web Emulator browser extension for quick desktop XR checks (not a replacement for real devices).

### 14.4 Device matrix
Keep a small table in `docs/TESTING.md`: device, OS, browser + version, XR modes tested, known issues. Always include **at least one mid-range phone** and, if targeted, a headset.

---

## 15. Testing and QA

| Layer | How |
|---|---|
| Pure logic (`core/`, `utils/`) | `node --test` unit tests in `tests/` (no browser needed) |
| References | `tools/check-links.mjs` (Appendix D) verifies every relative path exists, case-sensitively |
| Style | `.editorconfig`; optional ESLint/Prettier configs run via `npx` (no build step needed) |
| Browser behavior | Manual checklist in `docs/TESTING.md` run on real devices |
| Performance | Fixed scenario + HUD numbers recorded per milestone |
| Regression | Standard checklist re-run before each release/milestone |

Tips:
- Write tests for rules, math, state machines, parsers: anything pure.
- Add **scenario fixtures** (JSON) for hard-to-reach states and a debug loader (`?state=...`) to reach them on a phone quickly.
- Keep `docs/TESTING.md` as a living checklist: enter/exit XR repeatedly, tracking loss, backgrounding the tab, low battery mode, slow network, permission denial.

---

## 16. CI and deployment (GitHub Pages)

### 16.1 Deployment checklist
1. All paths are **relative**; verify with `tools/check-links.mjs`.
2. `.nojekyll` at the repo root.
3. Pages source: Settings → Pages → *Deploy from a branch* → `main` / `(root)` (or a `docs/` folder if you prefer).
4. URL: `https://<user>.github.io/<repo>/`. Test on the phone from that URL, not only from localhost.
5. Hard-reload after deploy (service workers and caches can serve stale files).
6. Tag releases (`v1.0.0`) so you can roll back by tag.

### 16.2 CI (optional but recommended)
Run tests and the link checker on every push/PR (Appendix E). Keep CI free of heavy steps; there is no build.

### 16.3 Caching
- Static hosts set their own cache headers. Use versioned file names or a `?v=` query for assets you change.
- If you add a service worker (offline/PWA), version the cache name and handle updates explicitly; a stale service worker is a common source of "my fix doesn't deploy".

---

## 17. Git workflow

- `main` is always deployable. Work on branches: `feat/...`, `fix/...`, `refactor/...`.
- Small commits, Conventional Commit messages (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `test:`).
- Use `git mv` when moving files so history follows.
- Tag completed milestones (`m3-done`) and releases (`v1.2.0`).
- Never commit `node_modules/`, secrets, local logs, or huge unoptimized media.
- Before a risky refactor, create a backup branch/tag.
- PR checklist: tests pass, link check passes, device test noted, docs updated, performance numbers recorded when relevant.

---

## 18. Documentation and AI-assistant files

- **README.md**: what it is, folder layout, run locally, test on a phone, deploy, URL flags, known browser issues.
- **docs/ARCHITECTURE.md**: module map, data flow diagram, coordinate/unit conventions, event catalogue, state machine.
- **docs/PLAN.md**: milestones in order, exit criteria, performance budget, status log (update after each milestone).
- **docs/TESTING.md**: device matrix and manual checklists.
- **docs/decisions/NNNN-title.md**: short decision records (context, decision, consequences).
- **CHANGELOG.md**: user-visible changes per version.
- **`.github/copilot-instructions.md`** (and `CLAUDE.md` / `AGENTS.md` for other assistants): conventions an AI assistant must follow. Suggested content:
  - Folder map and naming rules from this guide.
  - "Relative paths only; no CDN for production libs; no build step; keep `xr-compat.js` first in `<head>`."
  - "Don't change dependency versions, media files, or behavior unless asked."
  - How to run tests, the link checker and the local server.

---

## 19. Security, privacy, accessibility

- **Permissions:** request camera/motion/XR only on a user gesture, explain why, handle denial gracefully.
- **Privacy:** process camera frames locally; never upload them without explicit consent. Say so in the UI/README.
- **Third-party code:** vendored and pinned; review licenses; no secrets in client code; avoid inline scripts if you add a Content-Security-Policy.
- **Cross-origin media:** use `crossorigin="anonymous"` and CORS headers; mixed content (HTTP media on an HTTPS page) is blocked.
- **Accessibility:** DOM overlay uses semantic elements, labels, `aria-live` for status messages; avoid conveying meaning by color alone; offer reduced-motion and comfort options (vignette, snap turning) for VR; subtitles/captions for narrated media; sufficient contrast over camera video.
- **Comfort (VR):** never move the camera without user control; keep frame rate stable; avoid abrupt acceleration.

---

## 20. Common pitfalls

| Symptom / mistake | Likely cause | Fix |
|---|---|---|
| Works locally, 404 on Pages | Case mismatch or root-absolute path (`/assets/...`) | Exact-case relative paths; run the link checker |
| WebXR button missing / "needs HTTPS" | Not a secure context (LAN IP over HTTP) | `localhost` via `adb reverse`, tunnel, or Pages |
| XR session starts but nothing is drawn, camera/tracking fine | Browser rendering-path regression | Test with compat shim flags; read the diagnostics log; keep shims isolated |
| Black 360 video / won't play | Autoplay policy, missing `playsinline`, codec/size too large, no CORS | User-gesture start, H.264 MP4, moderate size, `crossorigin` |
| Texture shows black | Texture exceeds device limit or CORS failure | ≤ 4096 px, serve with CORS, check console |
| Components do nothing | Registered after entities initialized, or typo in name | Load order per §5; names are kebab-case and must match |
| Jank every few seconds | Allocations in `tick`, GC pauses | Reuse vectors, pools, throttle |
| Taps fire twice / gesture ends in a tap | XR `select` + DOM pointer both fire; gesture end counts as tap | Dedupe window; suppress taps after gestures |
| Overlay buttons also trigger the scene | `beforexrselect` not handled | `preventDefault()` on overlay controls |
| Content drifts in AR | Placing content in world space without anchors | Use anchors; keep adjustments as offsets under the anchored root |
| Memory climbs after repeated sessions | Missing `remove()`/dispose, listeners left attached | Clean up per §6.1; check `renderer.info` |
| "My fix doesn't deploy" | Browser/service-worker cache | Hard reload, version assets, version the SW cache |
| Repo push rejected | File > 100 MB | Compress or host externally |
| Library update broke everything | Unpinned dependency | Pin exact versions, vendor, upgrade in a branch |

---

## 21. Checklists

### 21.1 New project
- [ ] Create repo, `git init -b main`, add `.gitignore`, `.editorconfig`, `.nojekyll`, `LICENSE`, `README.md`
- [ ] Folder skeleton from §2
- [ ] `npm init -y`, pin and vendor libraries into `lib/`, write `lib/README.md`
- [ ] `index.html` skeleton from §4 with compat shims first
- [ ] `tools/check-links.mjs`, `tests/` with one sample test, `npm test` works
- [ ] `docs/PLAN.md` with milestones, budgets and status log
- [ ] `.github/copilot-instructions.md` (and `CLAUDE.md` if used)
- [ ] First deploy to Pages and a test on a real phone over HTTPS

### 21.2 New feature (definition of done)
- [ ] Pure logic in `core/` with unit tests
- [ ] Component/system follows templates (schema, cleanup, no allocations in `tick`)
- [ ] Communicates by events/state; no cross-component DOM lookups
- [ ] UI in `ui/`, accessible, overlay taps handled
- [ ] Tested on a real phone; performance numbers recorded
- [ ] Regression checklist re-run; docs/PLAN.md status updated
- [ ] Commit + tag

### 21.3 Release
- [ ] `npm test` and link check pass
- [ ] Debug off by default; no console errors
- [ ] Assets optimized and licensed; sizes within limits
- [ ] Tested on the device matrix; compat shims reviewed
- [ ] Version bump, changelog, tag, deploy, post-deploy smoke test from the public URL

---

## 22. Appendix: templates

### A. `js/compat/xr-compat.js` (example browser-regression shim)
```js
// Workaround: some Android Chrome builds don't composite the WebXR projection-layer path (content invisible
// while camera/tracking work). Hiding the layers API makes three.js / A-Frame use the classic layer.
// Verify whether it is still needed on current browsers and remove it when fixed.
//   ?xrlayers=1  keep the browser's layers path (A/B test)      ?xrlayers=0  force the workaround
// NOTE: apps that use WebXR compositor layers on purpose (equirect/quad/cylinder layers) lose them.
(() => {
  window.__xrLayersDisabled = false;
  const mode = new URLSearchParams(location.search).get('xrlayers');
  const ua = navigator.userAgent;
  const isPhone = /Android/.test(ua) && /Mobile/.test(ua) && !/OculusBrowser|Quest/.test(ua);
  if (mode === '1' || (mode !== '0' && !isPhone)) return;
  try {
    if (typeof XRWebGLBinding !== 'undefined' && 'createProjectionLayer' in XRWebGLBinding.prototype) {
      delete XRWebGLBinding.prototype.createProjectionLayer;
      window.__xrLayersDisabled = true;
    }
    if (typeof XRRenderState !== 'undefined' && 'layers' in XRRenderState.prototype) {
      delete XRRenderState.prototype.layers;
    }
  } catch (e) { console.warn('xr-compat failed', e); }
})();
```

### B. `js/debug/xr-diagnostics.js`
```js
// Activate with ?xrdebug=1 . Logs which render path the XR session used; readable after exiting XR.
(() => {
  if (new URLSearchParams(location.search).get('xrdebug') !== '1') return;
  const box = document.createElement('pre');
  box.style.cssText = 'position:fixed;left:0;right:0;bottom:0;margin:0;padding:6px;font:11px monospace;' +
    'background:#000c;color:#9fffb0;z-index:99999;white-space:pre-wrap;max-height:40vh;overflow:auto';
  const log = (m) => { box.textContent += m + '\n'; };
  addEventListener('DOMContentLoaded', () => document.body.appendChild(box));
  log(`${navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0]}  xr-compat disabled layers: ${window.__xrLayersDisabled}`);
  const xr = navigator.xr;
  if (!xr?.requestSession) { log('WebXR not available'); return; }
  const original = xr.requestSession.bind(xr);
  const describe = (s) => {
    const rs = s.renderState, bl = rs.baseLayer;
    return `baseLayer=${bl ? 'XRWebGLLayer ' + bl.framebufferWidth + 'x' + bl.framebufferHeight : 'null'} ` +
           `layers=${rs.layers ? rs.layers.length : 'n/a'} blend=${s.environmentBlendMode}`;
  };
  xr.requestSession = async (mode, init) => {
    log(`requestSession(${mode}) ${JSON.stringify(init || {})}`);
    const s = await original(mode, init);
    setTimeout(() => log('+1.5s ' + describe(s)), 1500);
    s.addEventListener('end', () => log('ended: ' + describe(s)));
    return s;
  };
})();
```

### C. `package.json` essentials
```json
{
  "name": "project-name",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "vendor": "node tools/vendor.mjs",
    "test": "node --test tests/",
    "check": "node tools/check-links.mjs",
    "serve": "python3 -m http.server 5500"
  },
  "dependencies": {
    "aframe": "1.x.y"
  }
}
```
Use **exact** versions (`npm install <pkg> --save-exact`). `tools/vendor.mjs` copies the needed built files from `node_modules/` into `lib/` (use `fs.cpSync`).

### D. `tools/check-links.mjs` (relative reference checker)
```js
// Verifies that relative references in html/css/js point to existing files (case-sensitive).
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';

const ROOT = process.cwd();
const IGNORE = new Set(['node_modules', '.git', 'lib']);
const EXT = /\.(html|css|js|mjs)$/;
const REF = /(?:src|href)\s*=\s*["']([^"'#?]+)|url\(\s*["']?([^"')#?]+)|from\s+["'](\.{1,2}\/[^"']+)|import\(\s*["'](\.{1,2}\/[^"']+)/g;
const EXTERNAL = /^(https?:|data:|mailto:|tel:|javascript:|blob:|\/\/)/;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (IGNORE.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (EXT.test(name)) yield p;
  }
}

// exact-case existence check (also correct on case-insensitive file systems)
function existsExact(path) {
  let cur = ROOT;
  for (const part of relative(ROOT, path).split(/[\\/]/)) {
    if (!existsSync(cur) || !readdirSync(cur).includes(part)) return false;
    cur = join(cur, part);
  }
  return true;
}

let bad = 0;
for (const file of walk(ROOT)) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(REF)) {
    const ref = m[1] || m[2] || m[3] || m[4];
    if (!ref || EXTERNAL.test(ref)) continue;
    const target = resolve(dirname(file), ref);
    if (!existsSync(target) || !existsExact(target)) {
      console.error(`${relative(ROOT, file)} -> ${ref}`);
      bad++;
    }
  }
}
if (bad) { console.error(`${bad} broken reference(s)`); process.exit(1); }
console.log('All relative references resolve.');
```
(Root-absolute references such as `/assets/x.png` are reported as broken on purpose.)

### E. `.github/workflows/ci.yml`
```yaml
name: CI
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4          # use the current major versions
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm test --if-present
      - run: node tools/check-links.mjs
```

### F. `.editorconfig`
```ini
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

### G. `.gitignore`
```
node_modules/
.DS_Store
*.log
.env
```

### H. `README.md` skeleton
```markdown
# Project name
One-sentence description. Supported devices/browsers.

## Run locally
python3 -m http.server 5500  → http://localhost:5500
Phone (USB): adb reverse tcp:5500 tcp:5500, open http://localhost:5500 in Chrome

## Structure
(short tree + one line per folder)

## Test
npm test · npm run check

## Deploy
GitHub Pages: Settings → Pages → Deploy from branch → main / root

## URL flags
?debug=1 · ?xrdebug=1 · ?xrlayers=0|1

## Known browser issues
(list, with versions and the shim that handles them)

## Credits and licenses
```

### I. Tiny pub/sub store (when a system is not enough)
```js
// js/state/store.js
export function createStore(reducer, initial) {
  let state = initial;
  const subs = new Set();
  return {
    getState: () => state,
    dispatch(action) {
      const next = reducer(state, action);
      if (next === state) return;
      const prev = state;
      state = next;
      subs.forEach((fn) => fn(state, prev, action));
    },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
  };
}
```
