// Pure logic: no THREE, no A-Frame, no DOM. Works in the browser (window.DinoCore) and in Node (require).
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DinoCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const TWO_PI = Math.PI * 2;

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  /** Signed shortest rotation from `from` to `to`, in (-PI, PI]. */
  function shortestAngle(from, to) {
    let d = (to - from) % TWO_PI;
    if (d > Math.PI) d -= TWO_PI;
    else if (d < -Math.PI) d += TWO_PI;
    return d;
  }

  /** Rotate `current` toward `target` by at most `maxStep` radians (shortest way). */
  function stepAngle(current, target, maxStep) {
    return current + clamp(shortestAngle(current, target), -maxStep, maxStep);
  }

  /** Screen-space angle of the line from point a to point b. */
  function angleBetween(ax, ay, bx, by) {
    return Math.atan2(by - ay, bx - ax);
  }

  /** Yaw (radians, +Z is "forward") that points from the origin to (dx, dz). */
  function yawToTarget(dx, dz) {
    return Math.atan2(dx, dz);
  }

  /** New scale from a pinch: base scale * finger-distance ratio, clamped. */
  function pinchScale(base, ratio, min, max) {
    return clamp(base * ratio, min, max);
  }

  /** A tap is short and barely moved. */
  function isTap(durationMs, movedPx, maxMs, maxMovePx) {
    return durationMs <= maxMs && movedPx <= maxMovePx;
  }

  /** Random point in a ring around (cx, cz). r1, r2 are random numbers in [0, 1). */
  function pickWanderTarget(cx, cz, minR, maxR, r1, r2) {
    const a = r1 * TWO_PI;
    const r = minR + (maxR - minR) * r2;
    return { x: cx + Math.sin(a) * r, z: cz + Math.cos(a) * r };
  }

  const BEHAVIORS = [['walk', 0.55], ['look', 0.2], ['grumble', 0.1], ['roar', 0.15]];

  /** Weighted choice of the next idle behavior; special behaviors never repeat back to back. */
  function chooseNextBehavior(prev, r) {
    const options = BEHAVIORS.filter(([name]) => name === 'walk' || name !== prev);
    const total = options.reduce((sum, [, w]) => sum + w, 0);
    let x = clamp(r, 0, 0.999999) * total;
    for (const [name, w] of options) {
      if (x < w) return name;
      x -= w;
    }
    return 'walk';
  }

  /** Bigger dino = deeper voice. */
  function voicePitch(scale) {
    return clamp(Math.pow(scale, -0.35), 0.55, 1.6);
  }

  /** Overshooting "pop" easing for the spawn animation. x in [0, 1]. */
  function easeOutBack(x) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  }

  // ---- App state machine (serializable, pure) ----
  // phase: idle -> scanning -> ready -> placed ; mode: 'ar' | 'preview' | null
  function initialAppState() {
    return { phase: 'idle', mode: null };
  }

  function reduceApp(state, action) {
    switch (action) {
      case 'ar-start':
        return { phase: 'scanning', mode: 'ar' };
      case 'preview-start':
        return { phase: 'placed', mode: 'preview' };
      case 'surface-found':
        return state.phase === 'scanning' ? { ...state, phase: 'ready' } : state;
      case 'surface-lost':
        return state.phase === 'ready' ? { ...state, phase: 'scanning' } : state;
      case 'placed':
        return state.phase === 'ready' ? { ...state, phase: 'placed' } : state;
      case 'replace':
        return state.mode === 'ar' && state.phase === 'placed' ? { ...state, phase: 'scanning' } : state;
      case 'exit':
        return initialAppState();
      default:
        return state;
    }
  }

  return {
    clamp, shortestAngle, stepAngle, angleBetween, yawToTarget, pinchScale, isTap,
    pickWanderTarget, chooseNextBehavior, voicePitch, easeOutBack, initialAppState, reduceApp
  };
});
