// Bootstrap only: wires modules together. No business logic here.
(() => {
  const scene = document.querySelector('a-scene');

  function start() {
    window.DinoUI.init(scene);
    if (window.APP_CONFIG.flags.debug) {
      scene.setAttribute('stats', ''); // ?debug=1
      window.addEventListener('error', (e) => console.error('[debug] error:', e.message));
      window.addEventListener('unhandledrejection', (e) => console.error('[debug] promise:', e.reason));
    }
  }

  if (scene.hasLoaded) start();
  else scene.addEventListener('loaded', start);
})();
