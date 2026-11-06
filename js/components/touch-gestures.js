// Turns raw pointer events (touch / mouse) into screen-space "intents" emitted on the scene:
//   gesture:tap {x,y}            gesture:dragstart {x,y} (finger-down position)   gesture:drag {x,y}   gesture:dragend
//   gesture:pinchstart           gesture:pinch {ratio}   gesture:twist {delta}    gesture:multiend
//   gesture:zoom {factor}        (mouse wheel, desktop preview)
// Best practices implemented: pointer events + touch-action:none, one Map of active pointers, a drag slop,
// finishing a drag/pinch never counts as a tap, and the leftover finger after a pinch is ignored.
AFRAME.registerComponent('touch-gestures', {
  schema: { target: { type: 'selector' } },

  init() {
    const Core = window.DinoCore;
    this.cfg = window.APP_CONFIG.gestures;
    this.Core = Core;
    this.surface = this.data.target;
    this.pointers = new Map();
    this.state = 'idle'; // idle | single | drag | multi | ignore
    this.multiIds = [0, 0];
    this.startDist = 1;
    this.prevAngle = 0;
    this.lastGestureEnd = 0;

    this.onDown = this.onDown.bind(this);
    this.onMove = this.onMove.bind(this);
    this.onUp = this.onUp.bind(this);
    this.onWheel = this.onWheel.bind(this);
    this.onContext = (e) => e.preventDefault();

    const s = this.surface;
    s.addEventListener('pointerdown', this.onDown);
    s.addEventListener('pointermove', this.onMove);
    s.addEventListener('pointerup', this.onUp);
    s.addEventListener('pointercancel', this.onUp);
    s.addEventListener('wheel', this.onWheel, { passive: false });
    s.addEventListener('contextmenu', this.onContext);
  },

  remove() {
    const s = this.surface;
    s.removeEventListener('pointerdown', this.onDown);
    s.removeEventListener('pointermove', this.onMove);
    s.removeEventListener('pointerup', this.onUp);
    s.removeEventListener('pointercancel', this.onUp);
    s.removeEventListener('wheel', this.onWheel);
    s.removeEventListener('contextmenu', this.onContext);
  },

  emit(name, detail) {
    this.el.emit(name, detail || {}, false);
  },

  onDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    try { this.surface.setPointerCapture(e.pointerId); } catch (err) { /* not fatal */ }
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, st: performance.now() });
    const n = this.pointers.size;
    if (n === 1) {
      this.state = 'single';
    } else if (n === 2) {
      if (this.state === 'drag') this.emit('gesture:dragend');
      this.beginMulti();
    }
  },

  beginMulti() {
    const ids = Array.from(this.pointers.keys()).slice(0, 2);
    this.multiIds = ids;
    const a = this.pointers.get(ids[0]);
    const b = this.pointers.get(ids[1]);
    this.startDist = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
    this.prevAngle = this.Core.angleBetween(a.x, a.y, b.x, b.y);
    this.state = 'multi';
    this.emit('gesture:pinchstart');
  },

  onMove(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX;
    p.y = e.clientY;

    if (this.state === 'single' && Math.hypot(p.x - p.sx, p.y - p.sy) > this.cfg.dragSlopPx) {
      this.state = 'drag';
      this.emit('gesture:dragstart', { x: p.sx, y: p.sy });
    }
    if (this.state === 'drag') {
      this.emit('gesture:drag', { x: p.x, y: p.y });
    } else if (this.state === 'multi') {
      const a = this.pointers.get(this.multiIds[0]);
      const b = this.pointers.get(this.multiIds[1]);
      if (!a || !b) return;
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const ang = this.Core.angleBetween(a.x, a.y, b.x, b.y);
      this.emit('gesture:pinch', { ratio: dist / this.startDist });
      this.emit('gesture:twist', { delta: this.Core.shortestAngle(this.prevAngle, ang) });
      this.prevAngle = ang;
    }
  },

  onUp(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    this.pointers.delete(e.pointerId);
    const now = performance.now();

    if (this.state === 'single') {
      const moved = Math.hypot(p.x - p.sx, p.y - p.sy);
      const isTap = e.type === 'pointerup' &&
        this.Core.isTap(now - p.st, moved, this.cfg.tapMaxMs, this.cfg.tapMaxMovePx) &&
        now - this.lastGestureEnd > this.cfg.suppressTapMs;
      if (isTap) this.emit('gesture:tap', { x: p.x, y: p.y });
      this.state = 'idle';
    } else if (this.state === 'drag') {
      this.emit('gesture:dragend');
      this.lastGestureEnd = now;
      this.state = 'idle';
    } else if (this.state === 'multi' && this.multiIds.includes(e.pointerId)) {
      this.emit('gesture:multiend');
      this.lastGestureEnd = now;
      this.state = 'ignore'; // the remaining finger must not start a drag or a tap
    }
    if (this.pointers.size === 0) this.state = 'idle';
  },

  onWheel(e) {
    e.preventDefault();
    this.emit('gesture:zoom', { factor: Math.exp(-e.deltaY * 0.0015) });
  }
});
