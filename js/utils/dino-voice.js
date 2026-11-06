// Synthesized dinosaur voice (Web Audio). No audio files, no licenses, works offline.
// Must be unlocked by a user gesture: DinoVoice.unlock() is called from the Start buttons.
// pitch: 1 = normal, <1 = deeper (big dino), >1 = squeakier (tiny dino).
(() => {
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let muted = false;
  let roarAudio = null;

  function ensure() {
    if (muted) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(comp);
      comp.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // Schedules [[secondsFromT0, value], ...] on an AudioParam.
  function ramp(param, t0, points) {
    param.setValueAtTime(points[0][1], t0 + points[0][0]);
    for (let i = 1; i < points.length; i++) param.linearRampToValueAtTime(points[i][1], t0 + points[i][0]);
  }

  function noise(c, t, dur, freq, q, peak) {
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = q;
    const g = c.createGain();
    ramp(g.gain, t, [[0, 0], [0.03, peak], [dur * 0.6, peak * 0.6], [dur, 0]]);
    src.connect(bp);
    bp.connect(g);
    g.connect(master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  /** "RAWR!": swept sawtooth + growl wobble + vowel formants (ah -> oh) + breath noise. */
  function synthesizedRoar(pitch = 1) {
    const c = ensure();
    if (!c) return;
    const t = c.currentTime + 0.01;
    const dur = 0.95;

    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    ramp(osc.frequency, t, [[0, 230 * pitch], [0.1, 430 * pitch], [0.4, 300 * pitch], [dur, 110 * pitch]]);

    const lfo = c.createOscillator(); // growl
    lfo.frequency.value = 30;
    const lfoGain = c.createGain();
    lfoGain.gain.value = 28 * pitch;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    const f1 = c.createBiquadFilter();
    f1.type = 'bandpass';
    f1.Q.value = 4;
    ramp(f1.frequency, t, [[0, 500], [0.15, 900], [dur, 420]]);
    const f2 = c.createBiquadFilter();
    f2.type = 'bandpass';
    f2.Q.value = 5;
    ramp(f2.frequency, t, [[0, 1200], [0.15, 1500], [dur, 800]]);

    const g = c.createGain();
    ramp(g.gain, t, [[0, 0], [0.04, 3.2], [0.55, 2.4], [dur, 0]]);

    osc.connect(f1);
    osc.connect(f2);
    f1.connect(g);
    f2.connect(g);
    g.connect(master);

    osc.start(t);
    lfo.start(t);
    osc.stop(t + dur + 0.05);
    lfo.stop(t + dur + 0.05);
    noise(c, t, dur * 0.8, 1800, 0.8, 0.22);
  }

  function roar(pitch = 1) {
    if (muted) return;
    if (!roarAudio) {
      synthesizedRoar(pitch);
      return;
    }
    roarAudio.currentTime = 0;
    roarAudio.playbackRate = Math.min(1.6, Math.max(0.55, pitch));
    const playback = roarAudio.play();
    if (playback && playback.catch) playback.catch(() => synthesizedRoar(pitch));
  }

  function setRoarSource(src) {
    if (roarAudio) {
      roarAudio.pause();
      roarAudio = null;
    }
    if (src) {
      roarAudio = new Audio(src);
      roarAudio.preload = 'auto';
      roarAudio.volume = 0.85;
    }
  }

  /** Tiny happy chirp. */
  function squeak(pitch = 1) {
    const c = ensure();
    if (!c) return;
    const t = c.currentTime + 0.01;
    const dur = 0.2;
    const osc = c.createOscillator();
    osc.type = 'triangle';
    ramp(osc.frequency, t, [[0, 900 * pitch], [0.07, 1700 * pitch], [dur, 1100 * pitch]]);
    const g = c.createGain();
    ramp(g.gain, t, [[0, 0], [0.02, 0.5], [dur, 0]]);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /** Tummy rumble. */
  function grumble(pitch = 1) {
    const c = ensure();
    if (!c) return;
    const t = c.currentTime + 0.01;
    const dur = 1.0;
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    ramp(osc.frequency, t, [[0, 80 * pitch], [0.5, 55 * pitch], [dur, 70 * pitch]]);
    const lfo = c.createOscillator();
    lfo.frequency.value = 14;
    const lfoGain = c.createGain();
    lfoGain.gain.value = 12;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 320;
    const g = c.createGain();
    ramp(g.gain, t, [[0, 0], [0.1, 0.9], [0.8, 0.7], [dur, 0]]);
    osc.connect(lp);
    lp.connect(g);
    g.connect(master);
    osc.start(t);
    lfo.start(t);
    osc.stop(t + dur + 0.05);
    lfo.stop(t + dur + 0.05);
  }

  /** Soft footstep. */
  function stomp(pitch = 1) {
    const c = ensure();
    if (!c) return;
    const t = c.currentTime;
    const dur = 0.09;
    const osc = c.createOscillator();
    osc.type = 'sine';
    ramp(osc.frequency, t, [[0, 140 * pitch], [dur, 50 * pitch]]);
    const g = c.createGain();
    ramp(g.gain, t, [[0, 0.25], [dur, 0]]);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  window.DinoVoice = {
    unlock() { ensure(); },
    roar, squeak, grumble, stomp,
    setMuted(value) {
      muted = !!value;
      if (muted && roarAudio) roarAudio.pause();
    },
    setRoarSource,
    isMuted() { return muted; }
  };
})();
