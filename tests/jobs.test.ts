import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import type { PermissionMode } from '../src/contracts.js';
import { canCapture, createJob, normalizePublicUrl } from '../src/jobs.js';
import { withTestDir } from './helpers/test-dir.js';

test('normalizes public HTTPS URLs by canonicalizing host/default port and removing fragments', () => {
  assert.equal(
    normalizePublicUrl('https://EXAMPLE.com:443/path#hash'),
    'https://example.com/path',
  );
});

test('preserves query strings while removing fragments', () => {
  assert.equal(
    normalizePublicUrl('https://example.com/page?view=full&theme=dark#section'),
    'https://example.com/page?view=full&theme=dark',
  );
});

test('rejects non-public URL schemes and embedded credentials', () => {
  assert.throws(() => normalizePublicUrl('file:///etc/passwd'));
  assert.throws(() => normalizePublicUrl('https://user:secret@example.com/page'));
});

test('creates a consented job beneath the artifact root without page content', async () => {
  await withTestDir(async (root) => {
    const job = await createJob({
      root,
      id: 'example-job',
      url: 'https://example.com/page',
      permissionMode: 'private-learning',
    });

    assert.equal(job.id, 'example-job');
    assert.equal(job.rootUrl, 'https://example.com/page');
    assert.equal(job.consent.origin, 'https://example.com');
    assert.equal(job.consent.permissionMode, 'private-learning');
    assert.ok(job.consent.createdAt);

    const jobJson = await readFile(join(root, '.pi', 'snatch', 'example-job', 'job.json'), 'utf8');
    assert.equal(jobJson.includes('<html'), false);
    assert.equal(jobJson.includes('page body'), false);
  });
});

test('rejects invalid permission modes before creating a job directory', async () => {
  await withTestDir(async (root) => {
    const jobDirectory = join(root, '.pi', 'snatch', 'invalid-permission-mode');

    await assert.rejects(
      createJob({
        root,
        id: 'invalid-permission-mode',
        url: 'https://example.com/page',
        permissionMode: 'unauthorized' as PermissionMode,
      }),
      /permission mode/i,
    );

    await assert.rejects(access(jobDirectory));
  });
});

test('captures only URLs on the job consent origin', async () => {
  await withTestDir(async (root) => {
    const job = await createJob({
      root,
      id: 'same-origin-job',
      url: 'https://example.com/page',
      permissionMode: 'private-learning',
    });

    assert.equal(canCapture(job, 'https://example.com/other'), true);
    assert.equal(canCapture(job, 'https://other.example/page'), false);
    assert.equal(canCapture(job, 'https://user:secret@example.com/other'), false);
  });
});
