import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import { cloneAuthorizedSite, discoverSameOriginAssets, localAssetPath } from '../src/full-clone.js';
import { withTestDir } from './helpers/test-dir.js';

const origin = 'https://example.com';

test('discovers only same-origin HTML, CSS, and module assets', () => {
  const urls = discoverSameOriginAssets(
    '<img src="/image.png"><script src="https://example.com/app.js"></script><a href="https://outside.test/">off</a><link href="/style.css">',
    `${origin}/page`,
  );
  assert.deepEqual(urls, [`${origin}/image.png`, `${origin}/app.js`, `${origin}/style.css`]);
  assert.equal(localAssetPath(`${origin}/images/logo.png?variant=wide`), localAssetPath(`${origin}/images/logo.png?variant=wide`));
  assert.notEqual(localAssetPath(`${origin}/a/logo.png`), localAssetPath(`${origin}/b/logo.png`));
});

test('mirrors authorized same-origin assets and rewrites local references', async () => {
  const source = new Map([
    [`${origin}/`, '<html><head><link href="/style.css"></head><body><img src="/image.png"><script src="/app.js"></script></body></html>'],
    [`${origin}/style.css`, 'body { background: url("/image.png"); }'],
    [`${origin}/app.js`, 'import "./chunk.js";'],
    [`${origin}/chunk.js`, 'console.log("ready")'],
    [`${origin}/image.png`, 'image-bytes'],
  ]);
  await withTestDir(async (root) => {
    const result = await cloneAuthorizedSite({
      root,
      artifactDirectory: join(root, '.pi', 'snatch', 'job'),
      job: { consent: { origin, permissionMode: 'owned-or-authorized' } },
      targetUrl: `${origin}/`,
      fetcher: async (url) => ({ ok: source.has(url), status: source.has(url) ? 200 : 404, body: source.get(url) ?? '' }),
    });
    assert.equal(result.manifest.failures.length, 0);
    assert.equal(result.manifest.assets.length, 5);
    const html = await readFile(join(result.outputDirectory, 'index.html'), 'utf8');
    assert.equal(html.includes(origin), false);
    assert.equal(html.includes('/style.css'), false);
    assert.equal(html.includes('/image.png'), false);
  });
});

test('rejects learning jobs, cross-origin targets, and output paths outside project', async () => {
  await withTestDir(async (root) => {
    const options = { root, artifactDirectory: join(root, '.pi', 'snatch', 'job'), targetUrl: `${origin}/`, fetcher: async () => ({ ok: true, status: 200, body: '' }) };
    await assert.rejects(cloneAuthorizedSite({ ...options, job: { consent: { origin, permissionMode: 'private-learning' } } }), /owned-or-authorized/i);
    await assert.rejects(cloneAuthorizedSite({ ...options, job: { consent: { origin, permissionMode: 'owned-or-authorized' } }, targetUrl: 'https://outside.test/' }), /consent origin/i);
    await assert.rejects(cloneAuthorizedSite({ ...options, job: { consent: { origin, permissionMode: 'owned-or-authorized' } }, outputDirectory: '../outside' }), /project root/i);
  });
});
