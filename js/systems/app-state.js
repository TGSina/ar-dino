// Shared app state (phase + mode). The reducer is pure and lives in js/core/dino-core.js.
// Emits 'app:state-changed' { prev, next, action } on the scene.
AFRAME.registerSystem('app-state', {
  init() {
    this.state = window.DinoCore.initialAppState();
  },

  dispatch(action) {
    const prev = this.state;
    const next = window.DinoCore.reduceApp(prev, action);
    if (next === prev) return;
    this.state = next;
    this.sceneEl.emit('app:state-changed', { prev, next, action }, false);
  },

  get() {
    return this.state;
  }
});
