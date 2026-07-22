import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { PNG } from 'pngjs';

import type { SnatchJob } from '../src/contracts.js';
import { assertLocalUrl, nextRepairAttempt, validateJob } from '../src/validate.js';
import { withTestDir } from './helpers/test-dir.js';

test('allows loopback validation URLs and caps repair attempts at three', () => {
  assert.equal(assertLocalUrl('http://localhost:3000/demo'), 'http://localhost:3000/demo');
  assert.throws(() => assertLocalUrl('https://example.com/demo'), /loopback/i);
  assert.equal(nextRepairAttempt(2), 3);
  assert.throws(() => nextRepairAttempt(3), /three/i);
});

test('validates desktop, mobile, and reduced-motion local profiles', async () => {
  await withTestDir(async (root) => {
    const artifactDirectory = join(root, '.pi', 'snatch', 'validation-job');
    const baseline = new PNG({ width: 1, height: 1 });
    baseline.data.set([0, 0, 0, 255]);
    for (const profile of ['desktop', 'mobile']) {
      await mkdir(join(artifactDirectory, profile), { recursive: true });
      await writeFile(join(artifactDirectory, profile, 'page.png'), PNG.sync.write(baseline));
    }
    const visited: string[] = [];
    const job: SnatchJob = { id: 'validation-job', rootUrl: 'https://example.com/', status: 'captured', consent: { origin: 'https://example.com', permissionMode: 'owned-or-authorized', createdAt: '2026-07-22T00:00:00.000Z' } };
    const report = await validateJob({
      job,
      artifactDirectory,
      localUrl: 'http://localhost:3000/',
      createBrowser: (profile) => ({
        open: async (url) => url,
        setViewport: async () => {},
        setDevice: async () => {},
        setReducedMotion: async () => { visited.push(`${profile.name}:reduced`); },
        waitForIdle: async () => {},
        screenshot: async (path) => { await writeFile(path, PNG.sync.write(baseline)); },
        snapshot: async () => 'local snapshot',
        errors: async () => '',
        console: async () => '',
        networkRequests: async () => '[]',
        close: async () => {},
      }),
    });
    assert.equal(report.passed, true);
    assert.equal(visited.includes('reduced-motion:reduced'), true);
    assert.equal(report.findings.length, 0);
  });
});

test('rejects destructive validation scenarios before browser use', async () => {
  await assert.rejects(
    validateJob({
      job: { id: 'blocked', rootUrl: 'https://example.com/', status: 'captured', consent: { origin: 'https://example.com', permissionMode: 'owned-or-authorized', createdAt: '2026-07-22T00:00:00.000Z' } },
      artifactDirectory: '/tmp/unused',
      localUrl: 'http://localhost:3000/',
      scenarios: [{ action: 'click', target: '#submit', label: 'Submit order' }],
      createBrowser: () => { throw new Error('must not open'); },
    }),
    /forbidden/i,
  );
});
