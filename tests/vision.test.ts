import assert from 'node:assert/strict';
import test from 'node:test';

import { parseVisionReview } from '../src/vision.js';

test('accepts strict vision review verdicts and rejects invalid repair advice', () => {
  assert.deepEqual(parseVisionReview('{"verdict":"fix","issues":[{"region":"hero","severity":"high","evidence":"wrap mismatch","fix":"increase width"}]}').verdict, 'fix');
  assert.throws(() => parseVisionReview('{"verdict":"ship"}'), /verdict/i);
});
