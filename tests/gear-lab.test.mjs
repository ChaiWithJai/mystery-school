import test from 'node:test';
import assert from 'node:assert/strict';
import { gearRatio } from '../public/gear-lab.js';

test('a 20-tooth driver turns a 10-tooth follower twice', () => {
  assert.equal(gearRatio(20, 10), 2);
});

test('equal tooth counts give equal turns', () => {
  assert.equal(gearRatio(20, 20), 1);
});

test('a 40-tooth follower makes half a turn per pedal turn', () => {
  assert.equal(gearRatio(20, 40), 0.5);
});

test('zero, fractional, and maximum slider turns retain the expected ratio', () => {
  for (const [teeth, expected] of [[10, [0, 1.5, 6]], [20, [0, 0.75, 3]], [40, [0, 0.375, 1.5]]]) {
    assert.deepEqual([0, 0.75, 3].map(turns => turns * gearRatio(20, teeth)), expected);
  }
});

test('tooth counts must be positive whole numbers', () => {
  for (const invalid of [0, -10, 2.5, NaN, Infinity, '20', null, undefined]) {
    assert.throws(() => gearRatio(invalid, 20), RangeError);
    assert.throws(() => gearRatio(20, invalid), RangeError);
  }
});
