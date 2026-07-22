import assert from 'node:assert/strict';
import test from 'node:test';

import { BROWSER_INTROSPECTION_SCRIPT } from '../src/browser-introspection.js';

test('collects bounded safe icon metadata without source markup', () => {
  assert.match(BROWSER_INTROSPECTION_SCRIPT, /const iconCandidates/);
  assert.match(BROWSER_INTROSPECTION_SCRIPT, /slice\(0, 200\)/);
  assert.match(BROWSER_INTROSPECTION_SCRIPT, /classTokens/);
  assert.match(BROWSER_INTROSPECTION_SCRIPT, /data-lucide/);
  assert.doesNotMatch(BROWSER_INTROSPECTION_SCRIPT, /outerHTML|innerHTML|pathData|document\.cookie|localStorage/);
});
