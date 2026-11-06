# Testing

## Automated
- `npm test` — unit tests for `js/core/` (angles, gestures math, behavior choice, state machine).
- `npm run check` — every relative reference in html/css/js resolves (case-sensitive).

## Device matrix
| Device | OS | Chrome | Mode | Result / notes |
|---|---|---|---|---|
| (fill in) | Android | | AR | |
| Desktop | any | | Preview | |

## Manual checklist (real phone, GitHub Pages URL)
- [ ] Start screen shows; "Start AR" enabled on a supported phone
- [ ] Camera permission prompt appears after tapping Start AR
- [ ] Yellow ring appears on the floor/table after moving the phone slowly; it does not appear on walls
- [ ] Tap places the dino facing you; you hear a roar and it hops
- [ ] Dino wanders by itself, with footsteps, blinking and tail wag
- [ ] Tap dino → roar. Tap floor → dino walks there and squeaks
- [ ] One finger drag starting on the dino moves it without a jump; releasing drops it
- [ ] Pinch resizes smoothly (limits 0.25x–4x); voice gets deeper when big
- [ ] Two-finger twist rotates; the leftover finger does not start a drag/tap
- [ ] Imported GLB dinosaur can be selected before and during the session, placed, dragged, resized and rotated
- [ ] Selected local roar plays from the Roar button and a dino tap; mute stops it
- [ ] Buttons (Roar, +/−, rotate, New spot, mute, exit) work and do not also place/move the dino
- [ ] Exit AR returns to the start screen; Start AR again works (no stuck state)
- [ ] Background the tab and return; 5-minute session keeps a steady frame rate (use `?debug=1`)
- [ ] Deny camera permission: a readable message, no crash

## Preview mode (desktop)
- [ ] "Preview without AR" shows a grid floor and the dino
- [ ] Mouse wheel resizes, drag on the dino moves it, tap floor walks, buttons rotate
