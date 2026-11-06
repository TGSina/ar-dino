// DOM overlay controller: start screen, HUD, status text and buttons.
// It only talks to the rest of the app through events (ui:*) and the app-state system.
(() => {
  const $ = (id) => document.getElementById(id);
  const Voice = window.DinoVoice;

  async function detectAR() {
    try {
      return !!(navigator.xr && (await navigator.xr.isSessionSupported('immersive-ar')));
    } catch (e) {
      return false;
    }
  }

  function init(sceneEl) {
    const sys = sceneEl.systems['app-state'];
    const hintMs = window.APP_CONFIG.ui.hintMs;
    const el = {
      touch: $('touch-layer'), start: $('start-screen'), hud: $('hud'), status: $('status'),
      startAr: $('btn-start-ar'), preview: $('btn-preview'), place: $('btn-place'), tools: $('tools'),
      move: $('btn-move'), mute: $('btn-mute'), exit: $('btn-exit')
    };
    const animalSelects = [$('animal-select'), $('animal-select-live')];
    let hintTimer = 0;
    let noHitTest = false;

    // Taps on overlay controls must not also reach the 3D scene (WebXR "select").
    document.querySelectorAll('.btn, .animal-picker select').forEach((b) => b.addEventListener('beforexrselect', (e) => e.preventDefault()));

    const emit = (name, detail) => sceneEl.emit(name, detail || {}, false);
    window.APP_CONFIG.animals.forEach((animal) => {
      animalSelects.forEach((select) => {
        const option = document.createElement('option');
        option.value = animal.id;
        option.textContent = animal.label;
        select.appendChild(option);
      });
    });
    animalSelects.forEach((select) => {
      select.addEventListener('change', () => emit('ui:animal', { id: select.value }));
    });
    sceneEl.addEventListener('animal:changed', (e) => {
      animalSelects.forEach((select) => { select.value = e.detail.id; });
    });
    sceneEl.addEventListener('animal:load-error', () => {
      setStatus('Could not load that model. Check its file path and use a GLB model.');
    });

    // ---- buttons ----
    el.startAr.addEventListener('click', () => {
      Voice.unlock(); // audio needs a user gesture
      try {
        Promise.resolve(sceneEl.enterAR()).catch((err) => showSupport('Could not start AR: ' + (err && err.message ? err.message : err)));
      } catch (err) {
        showSupport('Could not start AR: ' + err.message);
      }
    });
    el.preview.addEventListener('click', () => { Voice.unlock(); emit('ui:preview'); });
    el.place.addEventListener('click', () => emit('ui:place'));
    $('btn-roar').addEventListener('click', () => emit('ui:roar'));
    $('btn-bigger').addEventListener('click', () => emit('ui:scale', { factor: 1.2 }));
    $('btn-smaller').addEventListener('click', () => emit('ui:scale', { factor: 1 / 1.2 }));
    $('btn-rot-left').addEventListener('click', () => emit('ui:rotate', { delta: Math.PI / 8 }));
    $('btn-rot-right').addEventListener('click', () => emit('ui:rotate', { delta: -Math.PI / 8 }));
    el.move.addEventListener('click', () => emit('ui:replace'));
    el.mute.addEventListener('click', () => {
      const muted = !Voice.isMuted();
      Voice.setMuted(muted);
      el.mute.textContent = muted ? '🔇' : '🔊';
      el.mute.setAttribute('aria-pressed', String(muted));
      el.mute.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
    });
    el.exit.addEventListener('click', () => {
      if (sys.get().mode === 'ar') sceneEl.exitVR();
      else sys.dispatch('exit');
    });

    // ---- XR session events -> app state ----
    sceneEl.addEventListener('enter-vr', () => {
      const session = sceneEl.renderer.xr.getSession && sceneEl.renderer.xr.getSession();
      if (session && session.environmentBlendMode !== 'opaque') sys.dispatch('ar-start');
    });
    sceneEl.addEventListener('exit-vr', () => sys.dispatch('exit'));
    sceneEl.addEventListener('placement:unavailable', () => { noHitTest = true; render(sys.get()); });
    sceneEl.addEventListener('app:state-changed', (e) => render(e.detail.next));

    // ---- rendering ----
    function setStatus(text) { el.status.textContent = text; }

    function showSupport(text) {
      $('support-note').textContent = text;
    }

    function render(state) {
      clearTimeout(hintTimer);
      const { phase, mode } = state;
      el.start.classList.toggle('is-hidden', phase !== 'idle');
      el.hud.classList.toggle('is-hidden', phase === 'idle');
      el.touch.classList.toggle('is-hidden', phase === 'idle');
      el.place.classList.toggle('is-hidden', phase !== 'ready');
      el.tools.classList.toggle('is-hidden', phase !== 'placed');
      el.move.classList.toggle('is-hidden', mode !== 'ar');

      if (phase === 'scanning') {
        setStatus(noHitTest
          ? 'Surface detection is not available here. Point at the floor.'
          : 'Point at the floor and move your phone slowly side to side.');
      } else if (phase === 'ready') {
        setStatus(noHitTest ? 'Approximate spot found. Tap to place the dino.' : 'Surface found! Tap to place the dino.');
      } else if (phase === 'placed') {
        setStatus(mode === 'preview'
          ? 'Preview: drag the dino, scroll or pinch to resize, tap the floor to make it walk.'
          : 'Drag the dino to move it. Pinch to resize, twist to rotate. Tap the floor to make it walk.');
        hintTimer = setTimeout(() => setStatus('Tap the dino to hear it roar.'), hintMs);
      } else {
        setStatus('');
      }
    }

    // ---- capability check ----
    detectAR().then((ok) => {
      if (ok) return;
      el.startAr.disabled = true;
      showSupport(window.isSecureContext
        ? 'AR needs Chrome on an Android phone with Google Play Services for AR. You can still try the preview.'
        : 'AR needs a secure (HTTPS) page. Open the GitHub Pages link instead of a plain http address.');
    });

    render(sys.get());
  }

  window.DinoUI = { init };
})();
