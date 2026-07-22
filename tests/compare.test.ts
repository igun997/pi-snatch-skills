import assert from 'node:assert/strict';
import test from 'node:test';

import { comparePixels } from '../src/compare.js';

test('counts changed RGBA pixels and honors masks', () => {
  const baseline = new Uint8Array([0, 0, 0, 255, 0, 0, 0, 255]);
  const candidate = new Uint8Array([255, 0, 0, 255, 0, 0, 0, 255]);
  assert.equal(comparePixels(baseline, candidate, 2, 1, []).mismatchedPixels, 1);
  assert.equal(comparePixels(baseline, candidate, 2, 1, [{ x: 0, y: 0, width: 1, height: 1 }]).mismatchedPixels, 0);
});
