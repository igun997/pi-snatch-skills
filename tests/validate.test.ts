import assert from 'node:assert/strict';
import test from 'node:test';
import { assertLocalUrl, nextRepairAttempt } from '../src/validate.js';

test('allows loopback validation URLs and caps repair attempts at three', () => {
  assert.equal(assertLocalUrl('http://localhost:3000/demo'), 'http://localhost:3000/demo');
  assert.throws(() => assertLocalUrl('https://example.com/demo'), /loopback/i);
  assert.equal(nextRepairAttempt(2), 3);
  assert.throws(() => nextRepairAttempt(3), /three/i);
});
