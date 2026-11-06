import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const C = require('../js/core/dino-core.js');
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

test('shortestAngle wraps across +-PI', () => {
  near(C.shortestAngle(3, -3), 2 * Math.PI - 6);
  near(C.shortestAngle(-3, 3), 6 - 2 * Math.PI);
  near(C.shortestAngle(0, 1), 1);
  near(C.shortestAngle(0, 7 * Math.PI), Math.PI); // 7PI == PI (mod 2PI); range is (-PI, PI]
});

test('stepAngle never overshoots and takes the short way', () => {
  near(C.stepAngle(0, 1, 0.25), 0.25);
  near(C.stepAngle(0, 0.1, 0.25), 0.1);
  assert.ok(C.stepAngle(3, -3, 0.2) > 3); // short way is across PI, not back through 0
});

test('pinchScale clamps', () => {
  assert.equal(C.pinchScale(1, 10, 0.25, 4), 4);
  assert.equal(C.pinchScale(1, 0.01, 0.25, 4), 0.25);
  assert.equal(C.pinchScale(2, 1.5, 0.25, 4), 3);
});

test('isTap needs short time and little movement', () => {
  assert.ok(C.isTap(100, 3, 280, 10));
  assert.ok(!C.isTap(400, 3, 280, 10));
  assert.ok(!C.isTap(100, 30, 280, 10));
});

test('pickWanderTarget stays inside the ring', () => {
  for (let i = 0; i < 200; i++) {
    const t = C.pickWanderTarget(1, -2, 0.2, 0.7, Math.random(), Math.random());
    const d = Math.hypot(t.x - 1, t.z + 2);
    assert.ok(d >= 0.2 - 1e-9 && d <= 0.7 + 1e-9);
  }
});

test('yawToTarget: +Z is forward', () => {
  near(C.yawToTarget(0, 1), 0);
  near(C.yawToTarget(1, 0), Math.PI / 2);
});

test('chooseNextBehavior: valid names, specials never repeat', () => {
  const valid = new Set(['walk', 'look', 'grumble', 'roar']);
  for (let i = 0; i <= 100; i++) {
    const r = i / 100;
    for (const prev of ['', 'walk', 'look', 'grumble', 'roar']) {
      const next = C.chooseNextBehavior(prev, r);
      assert.ok(valid.has(next));
      if (prev !== 'walk') assert.notEqual(next, prev === '' ? '__none__' : prev);
    }
  }
});

test('voicePitch: bigger dino = deeper voice, always clamped', () => {
  assert.ok(C.voicePitch(4) < C.voicePitch(1));
  assert.ok(C.voicePitch(0.25) > C.voicePitch(1));
  assert.ok(C.voicePitch(1000) >= 0.55 && C.voicePitch(0.0001) <= 1.6);
});

test('easeOutBack endpoints', () => {
  near(C.easeOutBack(0), 0);
  near(C.easeOutBack(1), 1);
  assert.ok(C.easeOutBack(0.8) > 1); // overshoot
});

test('app state machine: AR flow', () => {
  let s = C.initialAppState();
  assert.equal(s.phase, 'idle');
  s = C.reduceApp(s, 'placed');           // ignored while idle
  assert.equal(s.phase, 'idle');
  s = C.reduceApp(s, 'ar-start');
  assert.deepEqual(s, { phase: 'scanning', mode: 'ar' });
  s = C.reduceApp(s, 'surface-found');
  assert.equal(s.phase, 'ready');
  s = C.reduceApp(s, 'surface-lost');
  assert.equal(s.phase, 'scanning');
  s = C.reduceApp(s, 'surface-found');
  s = C.reduceApp(s, 'placed');
  assert.equal(s.phase, 'placed');
  s = C.reduceApp(s, 'replace');
  assert.equal(s.phase, 'scanning');
  s = C.reduceApp(s, 'exit');
  assert.deepEqual(s, { phase: 'idle', mode: null });
});

test('app state machine: preview skips scanning and cannot "replace"', () => {
  let s = C.reduceApp(C.initialAppState(), 'preview-start');
  assert.deepEqual(s, { phase: 'placed', mode: 'preview' });
  const same = C.reduceApp(s, 'replace');
  assert.equal(same, s);
});

test('reduceApp returns the same object for unknown actions', () => {
  const s = C.initialAppState();
  assert.equal(C.reduceApp(s, 'nope'), s);
});
