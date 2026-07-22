import assert from 'node:assert/strict';
import { access, mkdir, readFile, symlink } from 'node:fs/promises';
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

test('rejects loopback, private, link-local, and reserved public URL hosts', () => {
  for (const url of [
    'http://localhost/',
    'http://preview.localhost/',
    'http://127.0.0.1/',
    'http://10.0.0.1/',
    'http://169.254.169.254/latest/meta-data/',
    'http://192.168.1.1/',
    'http://[::1]/',
    'http://[fe80::1]/',
    'http://[fc00::1]/',
  ]) {
    assert.throws(() => normalizePublicUrl(url), /public host/i);
  }
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
    assert.deepEqual(JSON.parse(jobJson), job);
  });
});

test('removes query values from persisted job metadata', async () => {
  await withTestDir(async (root) => {
    const job = await createJob({
      root,
      id: 'query-job',
      url: 'https://example.com/page?access_token=secret-value#ignored',
      permissionMode: 'private-learning',
    });

    assert.equal(job.rootUrl, 'https://example.com/page');
    const jobJson = await readFile(join(root, '.pi', 'snatch', 'query-job', 'job.json'), 'utf8');
    assert.equal(jobJson.includes('access_token'), false);
    assert.equal(jobJson.includes('secret-value'), false);
  });
});

test('rejects traversal job IDs without creating paths outside the artifact root', async () => {
  await withTestDir(async (root) => {
    const escapedDirectory = join(root, '.pi', 'escape');

    await assert.rejects(
      createJob({
        root,
        id: '../escape',
        url: 'https://example.com/page',
        permissionMode: 'private-learning',
      }),
      /Job IDs/i,
    );

    await assert.rejects(access(escapedDirectory));
  });
});

test('rejects symlinked artifact roots without writing outside project', async () => {
  await withTestDir(async (root) => {
    const outside = join(root, 'outside');
    const piDirectory = join(root, '.pi');
    await mkdir(outside);
    await mkdir(piDirectory);
    await symlink(outside, join(piDirectory, 'snatch'));

    await assert.rejects(
      createJob({
        root,
        id: 'outside-job',
        url: 'https://example.com/page',
        permissionMode: 'private-learning',
      }),
      /symlink/i,
    );

    await assert.rejects(access(join(outside, 'outside-job')));
  });
});

test('rejects duplicate job IDs instead of overwriting existing job metadata', async () => {
  await withTestDir(async (root) => {
    await createJob({
      root,
      id: 'existing-job',
      url: 'https://example.com/first',
      permissionMode: 'private-learning',
    });

    await assert.rejects(
      createJob({
        root,
        id: 'existing-job',
        url: 'https://example.com/second',
        permissionMode: 'owned-or-authorized',
      }),
      /already exists/i,
    );

    const jobJson = await readFile(join(root, '.pi', 'snatch', 'existing-job', 'job.json'), 'utf8');
    assert.equal(jobJson.includes('/second'), false);
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
