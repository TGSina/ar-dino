// Surface ("plane") detection via WebXR hit-test + a pulsing reticle.
// ARCore tracks real-world planes; hit-test asks "where does the ray from the screen centre hit one?".
// Only near-horizontal hits count (floors, tables), so the dino never spawns on walls.
// If hit-test is unavailable the reticle falls back to an approximate spot in front of the camera.
// Put this on a hidden entity. Other code reads the result with getPlacement(outVec3).
AFRAME.registerComponent('surface-placement', {
  schema: { minUp: { default: 0.8 } }, // how upright the surface normal must be (1 = perfectly horizontal)

  init() {
    const THREE = AFRAME.THREE;
    this.sys = this.el.sceneEl.systems['app-state'];
    this.source = null;
    this.session = null;
    this.found = false;
    this.hitUnavailable = false;
    this.mat4 = new THREE.Matrix4();
    this.camPos = new THREE.Vector3();
    this.camDir = new THREE.Vector3();

    // Reticle visuals: ring + dot lying flat in the local XZ plane
    const ringGeo = new THREE.RingGeometry(0.12, 0.15, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const dotGeo = new THREE.CircleGeometry(0.025, 16);
    dotGeo.rotateX(-Math.PI / 2);
    this.mat = new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthTest: false });
    this.geos = [ringGeo, dotGeo];
    this.group = new THREE.Group();
    const ring = new THREE.Mesh(ringGeo, this.mat);
    const dot = new THREE.Mesh(dotGeo, this.mat);
    ring.renderOrder = dot.renderOrder = 999;
    this.group.add(ring, dot);
    this.el.setObject3D('reticle', this.group);
    this.el.object3D.visible = false;

    this.onEnter = this.onEnter.bind(this);
    this.onExit = this.onExit.bind(this);
    this.el.sceneEl.addEventListener('enter-vr', this.onEnter);
    this.el.sceneEl.addEventListener('exit-vr', this.onExit);
  },

  remove() {
    this.el.sceneEl.removeEventListener('enter-vr', this.onEnter);
    this.el.sceneEl.removeEventListener('exit-vr', this.onExit);
    this.releaseSource();
    this.el.removeObject3D('reticle');
    this.geos.forEach((g) => g.dispose());
    this.mat.dispose();
  },

  onEnter() {
    const sceneEl = this.el.sceneEl;
    const xr = sceneEl.renderer.xr;
    const session = xr.getSession && xr.getSession();
    if (!session || session.environmentBlendMode === 'opaque') return; // not an AR session
    this.session = session;
    this.hitUnavailable = false;
    session.requestReferenceSpace('viewer')
      .then((space) => session.requestHitTestSource({ space }))
      .then((source) => {
        if (this.session !== session) { source.cancel(); return; } // session ended while waiting
        this.source = source;
      })
      .catch((err) => {
        console.warn('WebXR hit-test unavailable, using approximate placement', err);
        this.hitUnavailable = true;
        sceneEl.emit('placement:unavailable', {}, false);
      });
    session.addEventListener('end', () => this.releaseSource(), { once: true });
  },

  onExit() {
    this.releaseSource();
  },

  releaseSource() {
    if (this.source) {
      try { this.source.cancel(); } catch (e) { /* already gone */ }
      this.source = null;
    }
    this.session = null;
    this.found = false;
    this.el.object3D.visible = false;
  },

  /** Copies the current reticle position into outVec3. Returns false if no surface is targeted. */
  getPlacement(outVec3) {
    if (!this.found) return false;
    outVec3.copy(this.el.object3D.position);
    return true;
  },

  tick(time) {
    const phase = this.sys.get().phase;
    const obj = this.el.object3D;
    if (phase !== 'scanning' && phase !== 'ready') {
      if (obj.visible) obj.visible = false;
      return;
    }

    const sceneEl = this.el.sceneEl;
    const xr = sceneEl.renderer.xr;
    let found = false;

    if (this.source) {
      const frame = sceneEl.frame || (xr.getFrame && xr.getFrame());
      const refSpace = xr.getReferenceSpace();
      if (frame && refSpace) {
        const results = frame.getHitTestResults(this.source);
        for (let i = 0; i < results.length; i++) {
          const pose = results[i].getPose(refSpace);
          if (!pose) continue;
          this.mat4.fromArray(pose.transform.matrix);
          if (this.mat4.elements[5] < this.data.minUp) continue; // skip walls and steep slopes
          this.mat4.decompose(obj.position, obj.quaternion, obj.scale);
          found = true;
          break;
        }
      }
    } else if (this.hitUnavailable) {
      found = this.updateFallback();
    }

    if (found !== this.found) {
      this.found = found;
      obj.visible = found;
      this.sys.dispatch(found ? 'surface-found' : 'surface-lost');
    }
    if (found) this.group.scale.setScalar(1 + 0.07 * Math.sin(time / 220));
  },

  // Approximation: 1.5 m ahead of the camera, 1.2 m below it.
  updateFallback() {
    const cam = this.el.sceneEl.camera;
    if (!cam) return false;
    cam.getWorldPosition(this.camPos);
    cam.getWorldDirection(this.camDir);
    this.camDir.y = 0;
    if (this.camDir.lengthSq() < 1e-4) this.camDir.set(0, 0, -1);
    this.camDir.normalize();
    const obj = this.el.object3D;
    obj.position.set(this.camPos.x + this.camDir.x * 1.5, this.camPos.y - 1.2, this.camPos.z + this.camDir.z * 1.5);
    obj.quaternion.identity();
    return true;
  }
});
