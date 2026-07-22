import assert from 'node:assert/strict';
import test from 'node:test';
import { canAttemptRepair, restoreJobState } from '../src/extension-state.js';

test('restores valid extension job details and caps repairs', () => {
  const state = restoreJobState({ jobId: 'demo', origin: 'https://example.com', attempts: 3 });
  assert.equal(state?.jobId, 'demo');
  assert.equal(canAttemptRepair(state!), false);
  assert.equal(restoreJobState({ jobId: 'demo' }), undefined);
});
