// A procedural, cartoon dinosaur (no model files) with a walk cycle, wandering AI, blinking,
// roaring, hopping and a blob shadow. Facing direction is local +Z. Units: meters, radians.
// Listens on its own entity for: dino:place, dino:move, dino:walkto, dino:rotate, dino:setscale,
// dino:poke, dino:grab, dino:release, dino:reset. Emits: dino:roared.
(() => {
  const THREE = AFRAME.THREE;
  const Core = window.DinoCore;
  const Voice = window.DinoVoice;
  const CFG = window.APP_CONFIG.dino;

  const buildDino = window.AnimalModels.dino.build;
  const TAIL_BASE_X = window.AnimalModels.dino.TAIL_BASE_X;

  AFRAME.registerComponent('cute-dino', {
    schema: {
      walkSpeed: { default: CFG.walkSpeed },
      turnSpeed: { default: CFG.turnSpeed },
      wanderRadius: { default: CFG.wanderRadius },
      wander: { default: true },
      hitRadius: { default: CFG.hitRadius },
      hitCenterY: { default: CFG.hitCenterY }
    },

    init() {
      this.rig = buildDino();
      this.el.setObject3D('dino', this.rig.model);
      this.el.setObject3D('dino-shadow', this.rig.shadow);
      this.el.object3D.visible = false;
      this.importedModelEl = this.el.querySelector('#imported-model');
      this.activeAnimal = null;
      this.onImportedModelLoaded = this.onImportedModelLoaded.bind(this);
      this.onImportedModelError = this.onImportedModelError.bind(this);
      this.importedModelEl.addEventListener('model-loaded', this.onImportedModelLoaded);
      this.importedModelEl.addEventListener('model-error', this.onImportedModelError);

      this.placed = false;
      this.userScale = CFG.startScale;
      this.yaw = 0;
      this.home = { x: 0, z: 0 };
      this.target = { x: 0, z: 0 };
      this.mode = 'idle';
      this.modeT = 0;
      this.modeDur = 1;
      this.lastKind = '';
      this.userWalk = false;
      this.t = 0;
      this.phase = 0;
      this.stepIdx = 0;
      this.walk = 0;
      this.roarAmt = 0;
      this.heldAmt = 0;
      this.lookYaw = 0;
      this.pop = 1;
      this.hopY = 0;
      this.hopV = 0;
      this.lift = 0;
      this.blinkT = 2;
      this.blinkAmt = 0;
      this.center = new THREE.Vector3(); // reused by hitTestRay (no per-call allocation)

      this.handlers = {
        'dino:place': this.onPlace.bind(this),
        'dino:move': this.onMove.bind(this),
        'dino:walkto': this.onWalkTo.bind(this),
        'dino:rotate': this.onRotate.bind(this),
        'dino:setscale': this.onSetScale.bind(this),
        'dino:poke': this.onPoke.bind(this),
        'dino:grab': this.onGrab.bind(this),
        'dino:release': this.onRelease.bind(this),
        'dino:reset': this.onReset.bind(this)
      };
      Object.keys(this.handlers).forEach((n) => this.el.addEventListener(n, this.handlers[n]));
      this.onAnimalSelected = this.onAnimalSelected.bind(this);
      this.el.sceneEl.addEventListener('ui:animal', this.onAnimalSelected);
      this.applyAnimal(window.APP_CONFIG.animals[0].id);
      this.applyScale();
    },

    remove() {
      Object.keys(this.handlers).forEach((n) => this.el.removeEventListener(n, this.handlers[n]));
      this.el.sceneEl.removeEventListener('ui:animal', this.onAnimalSelected);
      this.importedModelEl.removeEventListener('model-loaded', this.onImportedModelLoaded);
      this.importedModelEl.removeEventListener('model-error', this.onImportedModelError);
      this.el.removeObject3D('dino');
      this.el.removeObject3D('dino-shadow');
      this.rig.own.geos.forEach((g) => g.dispose());
      this.rig.own.mats.forEach((m) => m.dispose());
    },

    // ---------- public helpers (used by dino-controller) ----------
    /** True if a world-space ray passes near the dino (generous sphere; cheaper than mesh raycasting). */
    hitTestRay(ray) {
      const p = this.el.object3D.position;
      this.center.set(p.x, p.y + this.data.hitCenterY * this.userScale, p.z);
      const minR = ray.origin.distanceTo(this.center) * 0.05; // keep it tappable when far away
      const r = Math.max(this.data.hitRadius * this.userScale, minR);
      return ray.distanceSqToPoint(this.center) <= r * r;
    },

    voicePitch() {
      return Core.voicePitch(this.userScale);
    },

    applyAnimal(id) {
      const animal = window.APP_CONFIG.animals.find((item) => item.id === id);
      if (!animal) return;
      this.activeAnimal = animal;
      Voice.setRoarSource(animal.roar);
      if (animal.model === 'procedural') {
        this.importedModelEl.removeAttribute('gltf-model');
        this.importedModelEl.object3D.visible = false;
        this.rig.model.visible = true;
      } else {
        this.rig.model.visible = false;
        this.importedModelEl.object3D.visible = false;
        this.importedModelEl.setAttribute('gltf-model', animal.model);
      }
      this.el.sceneEl.emit('animal:changed', { id: animal.id, label: animal.label }, false);
    },

    onAnimalSelected(e) {
      this.applyAnimal(e.detail.id);
    },

    onImportedModelLoaded() {
      if (this.activeAnimal && this.activeAnimal.model !== 'procedural') {
        this.importedModelEl.object3D.visible = true;
      }
    },

    onImportedModelError() {
      if (!this.activeAnimal || this.activeAnimal.model === 'procedural') return;
      const failedId = this.activeAnimal.id;
      this.applyAnimal(window.APP_CONFIG.animals[0].id);
      this.el.sceneEl.emit('animal:load-error', { id: failedId }, false);
    },

    // ---------- event handlers ----------
    onPlace(e) {
      const d = e.detail;
      this.el.object3D.position.set(d.x, d.y, d.z);
      this.yaw = d.yaw || 0;
      this.home.x = this.target.x = d.x;
      this.home.z = this.target.z = d.z;
      this.placed = true;
      this.el.object3D.visible = true;
      this.pop = 0;
      this.userWalk = false;
      this.startRoar();
    },

    onReset() {
      this.placed = false;
      this.el.object3D.visible = false;
      this.setMode('idle', 1);
    },

    onMove(e) {
      const p = this.el.object3D.position;
      p.x = e.detail.x;
      p.z = e.detail.z;
      this.home.x = this.target.x = p.x;
      this.home.z = this.target.z = p.z;
    },

    onWalkTo(e) {
      this.target.x = this.home.x = e.detail.x;
      this.target.z = this.home.z = e.detail.z;
      this.userWalk = true;
      this.setMode('walk', 20);
      Voice.squeak(this.voicePitch());
    },

    onRotate(e) {
      this.yaw += e.detail.delta;
      if (this.mode !== 'held') this.setMode('idle', 2);
    },

    onSetScale(e) {
      this.userScale = Core.clamp(e.detail.scale, CFG.minScale, CFG.maxScale);
      this.applyScale();
    },

    onPoke() {
      if (this.mode !== 'held') this.startRoar();
    },

    onGrab() {
      this.setMode('held', 1e9);
      Voice.squeak(this.voicePitch() * 1.2);
    },

    onRelease() {
      this.hopV = 0.6;
      this.setMode('idle', 1.2);
    },

    // ---------- behavior ----------
    applyScale() {
      this.el.object3D.scale.setScalar(this.userScale);
    },

    setMode(mode, dur) {
      this.mode = mode;
      this.modeT = 0;
      this.modeDur = dur;
    },

    startRoar() {
      this.setMode('roar', 1.1);
      this.hopV = 1.5;
      Voice.roar(this.voicePitch());
      this.el.emit('dino:roared', {}, false);
    },

    startWander() {
      const R = Math.max(0.3, this.data.wanderRadius * (0.5 + 0.5 * this.userScale));
      const t = Core.pickWanderTarget(this.home.x, this.home.z, R * 0.35, R, Math.random(), Math.random());
      this.target.x = t.x;
      this.target.z = t.z;
      this.userWalk = false;
      this.setMode('walk', 12);
    },

    nextBehavior() {
      if (!this.data.wander) { this.setMode('idle', 2); return; }
      const next = Core.chooseNextBehavior(this.lastKind, Math.random());
      this.lastKind = next;
      if (next === 'walk') this.startWander();
      else if (next === 'look') this.setMode('look', 2.2);
      else if (next === 'grumble') { this.setMode('grumble', 1.2); Voice.grumble(this.voicePitch()); }
      else this.startRoar();
    },

    updateWalk(dt) {
      const p = this.el.object3D.position;
      const dx = this.target.x - p.x;
      const dz = this.target.z - p.z;
      const dist = Math.hypot(dx, dz);
      const step = this.data.walkSpeed * this.userScale * dt;
      if (dist <= Math.max(step, 0.02 * this.userScale) || this.modeT > this.modeDur) {
        if (this.userWalk) { this.hopV = 1.0; Voice.squeak(this.voicePitch()); }
        this.userWalk = false;
        this.setMode('idle', 0.7 + Math.random() * 1.3);
        return;
      }
      const desired = Core.yawToTarget(dx, dz);
      this.yaw = Core.stepAngle(this.yaw, desired, this.data.turnSpeed * dt);
      // Turn first, then walk: looks natural and avoids sliding sideways.
      if (Math.abs(Core.shortestAngle(this.yaw, desired)) < 0.7) {
        p.x += Math.sin(this.yaw) * step;
        p.z += Math.cos(this.yaw) * step;
      }
    },

    tick(time, timeDelta) {
      if (!this.placed) return;
      const dt = Math.min(timeDelta / 1000, 0.1);
      this.t += dt;
      this.modeT += dt;
      if (this.mode === 'walk') this.updateWalk(dt);
      else if (this.mode !== 'held' && this.modeT >= this.modeDur) this.nextBehavior();
      this.animate(dt);
    },

    // ---------- animation (allocation-free) ----------
    animate(dt) {
      const r = this.rig;
      const t = this.t;
      const k = Math.min(1, dt * 8);

      this.walk += ((this.mode === 'walk' ? 1 : 0) - this.walk) * k;
      this.roarAmt += ((this.mode === 'roar' ? 1 : 0) - this.roarAmt) * Math.min(1, dt * 10);
      this.heldAmt += ((this.mode === 'held' ? 1 : 0) - this.heldAmt) * k;
      this.phase += dt * CFG.stepRate * this.walk;
      const w = this.walk;
      const roar = this.roarAmt;
      const held = this.heldAmt;

      // footsteps (feet pass under the hips every half cycle)
      const idx = Math.floor(this.phase / Math.PI);
      if (idx !== this.stepIdx) {
        this.stepIdx = idx;
        if (w > 0.6) Voice.stomp(this.voicePitch());
      }

      const swing = Math.sin(this.phase);
      r.legs[0].rotation.x = swing * 0.55 * w + Math.sin(t * 28) * 0.6 * held;
      r.legs[1].rotation.x = -swing * 0.55 * w + Math.sin(t * 28 + 1.5) * 0.6 * held;

      // body: bob, waddle, lean back when roaring, shake when grumbling
      r.upper.position.y = Math.sin(t * 2.2) * 0.004 + Math.abs(Math.cos(this.phase)) * 0.025 * w;
      r.upper.rotation.z = swing * 0.09 * w;
      r.upper.rotation.y = swing * 0.06 * w;
      r.upper.rotation.x = -0.08 * roar;

      // head
      const lookTarget = this.mode === 'look' ? Math.sin(this.modeT * 2.4) * 0.8 : 0;
      this.lookYaw += (lookTarget - this.lookYaw) * Math.min(1, dt * 6);
      r.head.rotation.y = this.lookYaw + swing * 0.08 * w;
      r.head.rotation.x = -0.55 * roar + Math.sin(this.phase * 2) * 0.05 * w + (this.mode === 'look' ? Math.sin(this.modeT * 3) * 0.08 : 0) + 0.25 * held;

      // mouth opens on roar
      r.mouth.scale.set(0.001 + 0.055 * roar, 0.001 + 0.045 * roar, 0.03);

      // blinking (+ squint when roaring)
      this.blinkT -= dt;
      if (this.blinkT <= 0) { this.blinkT = 2 + Math.random() * 3; this.blinkAmt = 1; }
      this.blinkAmt = Math.max(0, this.blinkAmt - dt * 7);
      const lid = this.blinkAmt > 0 ? Math.sin(this.blinkAmt * Math.PI) : 0;
      const eyeY = (1 - 0.9 * lid) * (1 - 0.5 * roar);
      r.eyes[0].scale.y = eyeY;
      r.eyes[1].scale.y = eyeY;

      // tail wave: faster when walking and when excited
      const wag = 3 + 5 * w + 6 * roar;
      for (let i = 0; i < r.tail.length; i++) {
        r.tail[i].rotation.y = Math.sin(t * wag - i * 0.9) * (0.22 + 0.2 * w) * (0.7 + 0.3 * i);
        r.tail[i].rotation.x = TAIL_BASE_X[i] + Math.sin(t * wag * 0.5 - i) * 0.05;
      }

      // tiny arms: swing when walking, raise when roaring, flail when held
      for (let i = 0; i < 2; i++) {
        const a = r.arms[i];
        a.rotation.x = Math.sin(this.phase + (i ? 0 : Math.PI)) * 0.6 * w;
        a.rotation.z = a.userData.side * (0.45 + 0.6 * roar + Math.sin(t * 20 + i) * 0.5 * held);
      }

      // hop physics + lift while held
      if (this.hopV !== 0 || this.hopY > 0) {
        this.hopV -= 7 * dt;
        this.hopY += this.hopV * dt;
        if (this.hopY <= 0) { this.hopY = 0; this.hopV = 0; }
      }
      this.lift += ((this.mode === 'held' ? 0.12 : 0) - this.lift) * Math.min(1, dt * 10);
      r.model.position.y = this.hopY + this.lift;

      // pop-in (spawn) + roar/grumble shake
      if (this.pop < 1) this.pop = Math.min(1, this.pop + dt / 0.6);
      const pop = Core.easeOutBack(this.pop);
      const pulse = Math.sin(t * 34) * 0.025 * roar + (this.mode === 'grumble' ? Math.sin(t * 30) * 0.02 : 0);
      r.model.scale.set(pop * (1 + pulse), pop * (1 - pulse), pop * (1 + pulse));

      // shadow shrinks and fades as the dino leaves the ground
      const lifted = this.hopY + this.lift;
      const ss = pop / (1 + lifted * 4);
      r.shadow.scale.set(ss, 1, 1.25 * ss);
      r.shadow.material.opacity = 0.28 / (1 + lifted * 3);

      this.el.object3D.rotation.y = this.yaw;
    }
  });
})();
