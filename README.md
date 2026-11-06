# AR Dino 🦖

A WebXR / A-Frame experience: detect the floor with your phone camera, drop a cute walking dinosaur on it,
hear it roar, and move / resize / rotate it with natural touch gestures.
Supported: **Chrome on Android with Google Play Services for AR** (HTTPS). Everything else gets a non-AR preview.

See **GUIDE.md** for the full step-by-step setup, GitHub Pages deployment and phone testing.

## Run locally
```bash
npm install
npm run vendor      # copies the pinned A-Frame build into lib/aframe/
npm run serve       # http://localhost:5500  (desktop: use "Preview without AR")
```
Phone over USB: `adb reverse tcp:5500 tcp:5500`, then open `http://localhost:5500` in Chrome on the phone.

## Structure
```
index.html              entry page (overlay UI + a-scene)
css/style.css           overlay styles
js/compat/              browser workarounds (loaded first)
js/debug/               ?xrdebug=1 diagnostics
js/config.js            tunables and URL flags
js/core/dino-core.js    pure logic (math, behavior choice, state machine) - unit tested
js/core/model-formats.js pure GLB / OBJ / STL writers - unit tested
js/models/              procedural animal geometry (dino, chick example)
js/utils/model-export.js browser adapter + download for the exporters
export.html             page that saves the models
js/utils/dino-voice.js  synthesized dinosaur voice (Web Audio, no audio files)
js/systems/app-state.js shared phase/mode state
js/components/          touch-gestures, surface-placement, cute-dino, dino-controller, preview-backdrop
js/ui/overlay.js        start screen, HUD, buttons
js/main.js              bootstrap
lib/                    vendored A-Frame (committed, pinned)
tools/                  vendor.mjs, check-links.mjs
tests/                  node --test unit tests
```

## Save the 3D model
`/export.html` saves the dinosaur (and the example chick) as GLB, OBJ+MTL or STL. See docs/MODEL_EXPORT.md.

## Share with a free HTTPS link (Cloudflare)
`npm run build && npx wrangler deploy`, or a Quick Tunnel for local testing. See docs/CLOUDFLARE.md.

## Test
`npm test` · `npm run check`

## Deploy
GitHub Pages: Settings → Pages → Deploy from a branch → `main` / `(root)`.

## Controls
| Action | Gesture |
|---|---|
| Place | Tap (or "Place dino here") when the yellow ring shows |
| Move | Drag the dino (finger must start on it) |
| Resize | Pinch with two fingers (bigger = deeper voice) |
| Rotate | Twist with two fingers |
| Roar | Tap the dino |
| Walk somewhere | Tap the floor |
| Re-place | "New spot" |

## URL flags
`?debug=1` fps stats · `?xrdebug=1` XR render-path log · `?xrlayers=0|1` toggle the layers workaround

## Known browser issues
- Some Android Chrome builds need the projection-layers workaround (`js/compat/xr-compat.js`, on by default on phones). Test with `?xrlayers=1` to see whether it is still needed.
- iOS Safari does not support WebXR AR; the non-AR preview works there.

## Credits and licenses
A-Frame (MIT). All dinosaur geometry and sounds are generated in code.
