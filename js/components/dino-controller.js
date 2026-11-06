// Translates gesture intents + UI intents into dino actions. Lives on the dino entity.
//  - Phase "ready":   tap (or the Place button)        -> place the dino on the detected surface
//  - Phase "placed":  drag starting ON the dino        -> move it along the floor (no jump: keeps grab offset)
//                     tap the dino                     -> roar
//                     tap the floor                    -> dino walks there
//                     two fingers: pinch / twist       -> scale / rotate (anywhere on screen)
//                     mouse wheel (desktop preview)    -> scale
// Screen -> world: a ray from the touch point is intersected with a horizontal plane at the dino's height.
AFRAME.registerComponent('dino-controller', {
  schema: {
    reticle: { type: 'selector' },
    maxRange: { default: 10 } // meters from the origin; keeps drags sane
  },

  init() {
    const THREE = AFRAME.THREE;
    this.Core = window.DinoCore;
    this.CFG = window.APP_CONFIG.dino;
    this.sceneEl = this.el.sceneEl;
    this.sys = this.sceneEl.systems['app-state'];

    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.hit = new THREE.Vector3();
    this.camPos = new THREE.Vector3();
    this.camDir = new THREE.Vector3();
    this.placePos = new THREE.Vector3();

    this.dragging = false;
    this.grabDX = 0;
    this.grabDZ = 0;
    this.pinchBase = 1;

    const on = {
      'gesture:tap': this.onTap,
      'gesture:dragstart': this.onDragStart,
      'gesture:drag': this.onDrag,
      'gesture:dragend': this.onDragEnd,
      'gesture:pinchstart': this.onPinchStart,
      'gesture:pinch': this.onPinch,
      'gesture:twist': this.onTwist,
      'gesture:zoom': this.onZoom,
      'ui:place': this.place,
      'ui:replace': this.onReplace,
      'ui:preview': this.startPreview,
      'ui:roar': this.onRoarButton,
      'ui:scale': this.onScaleButton,
      'ui:rotate': this.onRotateButton,
      'app:state-changed': this.onState
    };
    this.listeners = Object.keys(on).map((name) => {
      const fn = on[name].bind(this);
      this.sceneEl.addEventListener(name, fn);
      return [name, fn];
    });
  },

  remove() {
    this.listeners.forEach(([name, fn]) => this.sceneEl.removeEventListener(name, fn));
  },

  // ---------- helpers ----------
  getDino() {
    return this.el.components['cute-dino'];
  },

  isPlaced() {
    return this.sys.get().phase === 'placed' && this.getDino().placed;
  },

  /** Ray from a screen point (CSS pixels). Returns THREE.Ray (owned by this.raycaster, reused). */
  rayFromScreen(x, y) {
    const rect = this.sceneEl.canvas.getBoundingClientRect();
    this.ndc.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.sceneEl.camera);
    return this.raycaster.ray;
  },

  /** Intersects a screen point with the horizontal plane through the dino. Fills this.hit. */
  floorPoint(x, y) {
    const ray = this.rayFromScreen(x, y);
    this.plane.constant = -this.el.object3D.position.y;
    const hit = ray.intersectPlane(this.plane, this.hit);
    if (!hit) return false;
    return Math.hypot(hit.x, hit.z) <= this.data.maxRange;
  },

  // ---------- placement ----------
  place() {
    if (this.sys.get().phase !== 'ready') return;
    const reticle = this.data.reticle.components['surface-placement'];
    if (!reticle || !reticle.getPlacement(this.placePos)) return;
    this.sceneEl.camera.getWorldPosition(this.camPos);
    const yaw = Math.atan2(this.camPos.x - this.placePos.x, this.camPos.z - this.placePos.z); // face the user
    this.el.emit('dino:place', { x: this.placePos.x, y: this.placePos.y, z: this.placePos.z, yaw }, false);
    this.sys.dispatch('placed');
  },

  onReplace() {
    this.sys.dispatch('replace');
  },

  /** Non-AR preview: dino 1.4 m in front of the camera on an imaginary floor 1 m below it. */
  startPreview() {
    const cam = this.sceneEl.camera;
    cam.getWorldPosition(this.camPos);
    cam.getWorldDirection(this.camDir);
    this.camDir.y = 0;
    if (this.camDir.lengthSq() < 1e-4) this.camDir.set(0, 0, -1);
    this.camDir.normalize();
    const floorY = this.camPos.y - 1.0;
    const x = this.camPos.x + this.camDir.x * 1.4;
    const z = this.camPos.z + this.camDir.z * 1.4;
    this.sys.dispatch('preview-start');
    this.sceneEl.emit('preview:floor', { y: floorY }, false);
    this.el.emit('dino:place', { x, y: floorY, z, yaw: Math.atan2(this.camPos.x - x, this.camPos.z - z) }, false);
  },

  onState(e) {
    if (e.detail.next.phase === 'idle') {
      this.dragging = false;
      this.el.emit('dino:reset', {}, false);
    }
  },

  // ---------- touch gestures ----------
  onTap(e) {
    const phase = this.sys.get().phase;
    if (phase === 'ready') { this.place(); return; }
    if (!this.isPlaced()) return;
    const { x, y } = e.detail;
    const ray = this.rayFromScreen(x, y);
    if (this.getDino().hitTestRay(ray)) {
      this.el.emit('dino:poke', {}, false);
    } else if (this.floorPoint(x, y)) {
      this.el.emit('dino:walkto', { x: this.hit.x, z: this.hit.z }, false);
    }
  },

  onDragStart(e) {
    if (!this.isPlaced()) return;
    const { x, y } = e.detail;
    if (!this.getDino().hitTestRay(this.rayFromScreen(x, y))) return; // only drag when the finger started on the dino
    if (!this.floorPoint(x, y)) return;
    const p = this.el.object3D.position;
    this.grabDX = p.x - this.hit.x;
    this.grabDZ = p.z - this.hit.z;
    this.dragging = true;
    this.el.emit('dino:grab', {}, false);
  },

  onDrag(e) {
    if (!this.dragging) return;
    if (!this.floorPoint(e.detail.x, e.detail.y)) return;
    this.el.emit('dino:move', { x: this.hit.x + this.grabDX, z: this.hit.z + this.grabDZ }, false);
  },

  onDragEnd() {
    if (!this.dragging) return;
    this.dragging = false;
    this.el.emit('dino:release', {}, false);
  },

  onPinchStart() {
    if (this.isPlaced()) this.pinchBase = this.getDino().userScale;
  },

  onPinch(e) {
    if (!this.isPlaced()) return;
    const s = this.Core.pinchScale(this.pinchBase, e.detail.ratio, this.CFG.minScale, this.CFG.maxScale);
    this.el.emit('dino:setscale', { scale: s }, false);
  },

  onTwist(e) {
    if (!this.isPlaced()) return;
    // Fingers turning clockwise on screen = clockwise seen from above = negative yaw.
    this.el.emit('dino:rotate', { delta: -e.detail.delta }, false);
  },

  onZoom(e) {
    if (!this.isPlaced()) return;
    const s = this.Core.clamp(this.getDino().userScale * e.detail.factor, this.CFG.minScale, this.CFG.maxScale);
    this.el.emit('dino:setscale', { scale: s }, false);
  },

  // ---------- on-screen button fallbacks ----------
  onRoarButton() {
    if (this.isPlaced()) this.el.emit('dino:poke', {}, false);
  },

  onScaleButton(e) {
    if (!this.isPlaced()) return;
    const s = this.Core.clamp(this.getDino().userScale * e.detail.factor, this.CFG.minScale, this.CFG.maxScale);
    this.el.emit('dino:setscale', { scale: s }, false);
  },

  onRotateButton(e) {
    if (this.isPlaced()) this.el.emit('dino:rotate', { delta: e.detail.delta }, false);
  }
});
