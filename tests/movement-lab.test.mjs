import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleMovement, normalizeMovementState } from '../public/movement-lab.js';

const near = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);

test('cubic endpoints have zero velocity and the specified one-sided accelerations', () => {
  const input = { distance: .4, duration: 2 };
  const start = sampleMovement(0, input);
  near(start.position, 0); near(start.velocity, 0); near(start.acceleration, .6);
  const end = sampleMovement(2, input);
  near(end.position, .4); near(end.velocity, 0); near(end.acceleration, -.6);
});

test('cubic midpoint is half distance, peak speed 1.5 D/T, zero acceleration', () => {
  const mid = sampleMovement(1, { duration: 2, distance: .4 });
  near(mid.position, .2); near(mid.velocity, .3); near(mid.acceleration, 0);
  for (let i = 0; i <= 100; i++) assert.ok(sampleMovement(i / 50).velocity <= mid.velocity + 1e-12);
});

test('doubling duration halves velocity and quarters acceleration at matching progress', () => {
  for (const shape of ['cubic', 'quintic']) {
    const fast = sampleMovement(.25, { duration: 1, distance: .6, shape });
    const slow = sampleMovement(.5, { duration: 2, distance: .6, shape });
    near(fast.position, slow.position); near(slow.velocity, fast.velocity / 2); near(slow.acceleration, fast.acceleration / 4);
  }
});

test('rest strictly outside the interval has zero velocity and acceleration', () => {
  for (const shape of ['cubic', 'quintic']) {
    assert.deepEqual(sampleMovement(-.001, { shape }), { position: 0, velocity: 0, acceleration: 0 });
    assert.deepEqual(sampleMovement(2.001, { shape }), { position: .4, velocity: 0, acceleration: 0 });
  }
});

test('quintic joins rest with zero acceleration and has the defined midpoint speed', () => {
  for (const t of [0, 2]) {
    const point = sampleMovement(t, { shape: 'quintic' });
    near(point.position, t === 0 ? 0 : .4); near(point.velocity, 0); near(point.acceleration, 0);
  }
  const mid = sampleMovement(1, { shape: 'quintic' });
  near(mid.position, .2); near(mid.velocity, 1.875 * .4 / 2); near(mid.acceleration, 0);
});

test('analytic derivatives match independent central finite differences', () => {
  const dt = 1e-5;
  for (const shape of ['cubic', 'quintic']) for (const t of [.2, .6, 1, 1.5, 1.8]) {
    const before = sampleMovement(t - dt, { shape });
    const after = sampleMovement(t + dt, { shape });
    const point = sampleMovement(t, { shape });
    near(point.velocity, (after.position - before.position) / (2 * dt), 1e-8);
    near(point.acceleration, (after.velocity - before.velocity) / (2 * dt), 1e-8);
  }
});

test('both paths are monotonic, bounded and scale linearly with distance', () => {
  for (const shape of ['cubic', 'quintic']) {
    let prior = 0;
    for (let i = 0; i <= 100; i++) {
      const sample = sampleMovement(i / 50, { shape });
      assert.ok(sample.position >= prior - 1e-12 && sample.position <= .4 + 1e-12);
      const doubled = sampleMovement(i / 50, { shape, distance: .8 });
      for (const key of ['position', 'velocity', 'acceleration']) near(doubled[key], 2 * sample[key]);
      prior = sample.position;
    }
  }
});

test('invalid physical inputs are rejected', () => {
  for (const duration of [0, -1, NaN, Infinity, '2']) assert.throws(() => sampleMovement(0, { duration }), RangeError);
  for (const distance of [-1, NaN, Infinity, '.4']) assert.throws(() => sampleMovement(0, { distance }), RangeError);
  for (const time of [NaN, Infinity, '1']) assert.throws(() => sampleMovement(time), RangeError);
  assert.throws(() => sampleMovement(0, { shape: 'unknown' }), RangeError);
});

test('artifact state restores inputs but never resumes playback automatically', () => {
  const saved = { duration: 3, distance: .6, shape: 'quintic', time: 1.7, playing: true, assistanceOpen: true };
  const restored = normalizeMovementState(saved);
  assert.deepEqual(restored, { ...saved, playing: false });
  assert.deepEqual(normalizeMovementState(JSON.parse(JSON.stringify(restored))), restored);
  assert.equal(saved.playing, true);
});

test('malformed restore state is bounded and JSON safe', () => {
  const restored = normalizeMovementState({ duration: -10, distance: Infinity, shape: 'bad', time: 999 });
  assert.equal(restored.duration, 1); assert.equal(restored.time, 1); assert.equal(restored.distance, .4); assert.equal(restored.shape, 'cubic');
  assert.deepEqual(JSON.parse(JSON.stringify(restored)), restored);
  assert.equal(normalizeMovementState(null).duration, 2);
});
