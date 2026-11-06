// Single place for tunables and URL flags (classic script -> window.APP_CONFIG).
window.APP_CONFIG = Object.freeze({
  flags: Object.freeze({
    debug: new URLSearchParams(location.search).get('debug') === '1' // ?debug=1 shows fps/stats
  }),
  dino: Object.freeze({
    startScale: 1,      // 1 = about 0.5 m tall
    minScale: 0.25,
    maxScale: 4,
    walkSpeed: 0.35,    // m/s at scale 1 (scaled with the dino)
    stepRate: 6,        // leg cycle speed, rad/s
    turnSpeed: 4.5,     // rad/s
    wanderRadius: 0.7,  // m around the "home" spot at scale 1
    hitRadius: 0.3,     // m, generous touch target around the dino
    hitCenterY: 0.3     // m, height of that touch sphere
  }),
  gestures: Object.freeze({
    tapMaxMs: 280,
    tapMaxMovePx: 10,
    dragSlopPx: 8,
    suppressTapMs: 350  // ignore taps right after a drag/pinch ends
  }),
  ui: Object.freeze({
    hintMs: 8000
  })
});
