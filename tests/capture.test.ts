import assert from 'node:assert/strict';
import { access, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import { captureJob, type CaptureBrowser } from '../src/capture.js';
import { createJob } from '../src/jobs.js';
import { withTestDir } from './helpers/test-dir.js';

class FakeBrowser implements CaptureBrowser {
  readonly calls: string[] = [];
  closed = false;

  constructor(
    private readonly failOn?: string,
    private readonly finalUrl?: string,
  ) {}

  async open(url: string): Promise<string> {
    this.calls.push(`open:${url}`);
    return this.finalUrl ?? url;
  }
  async setDevice(name: string): Promise<void> { this.calls.push(`device:${name}`); }
  async setViewport(width: number, height: number, scale?: number): Promise<void> {
    this.calls.push(`viewport:${width}x${height}@${scale ?? 1}`);
  }
  async reload(): Promise<void> { this.calls.push('reload'); }
  async waitForIdle(): Promise<void> { this.calls.push('wait'); }
  async screenshot(path: string, fullPage?: boolean): Promise<void> {
    this.calls.push(`screenshot:${fullPage ? 'full' : 'viewport'}`);
    await writeFile(path, fullPage ? 'full' : 'viewport', 'utf8');
  }
  async snapshot(): Promise<string> { this.calls.push('snapshot'); return 'accessibility snapshot'; }
  async evalJson<T>(): Promise<T> {
    this.calls.push('facts');
    return { regions: [], animations: [] } as T;
  }
  async errors(): Promise<string> {
    this.calls.push('errors');
    if (this.failOn === 'errors') throw new Error('diagnostic failed');
    return '';
  }
  async console(): Promise<string> { this.calls.push('console'); return ''; }
  async networkRequests(): Promise<string> { this.calls.push('network'); return '[]'; }
  async close(): Promise<void> { this.calls.push('close'); this.closed = true; }
}

test('captures desktop and mobile evidence without source code or assets', async () => {
  await withTestDir(async (root) => {
    const job = await createJob({
      root,
      id: 'capture-job',
      url: 'https://example.com/page',
      permissionMode: 'private-learning',
    });
    const browsers: FakeBrowser[] = [];

    const manifest = await captureJob({
      job,
      targetUrl: 'https://example.com/page?temporary=not-persisted',
      artifactDirectory: join(root, '.pi', 'snatch', job.id),
      createBrowser: () => {
        const browser = new FakeBrowser();
        browsers.push(browser);
        return browser;
      },
    });

    assert.deepEqual(manifest.profiles.map((profile) => profile.name), ['desktop', 'mobile']);
    assert.equal(browsers.length, 2);
    assert.ok(browsers.every((browser) => browser.closed));
    assert.deepEqual(browsers[0]?.calls.slice(0, 3), [
      'open:https://example.com/page?temporary=not-persisted',
      'viewport:1440x900@1',
      'reload',
    ]);
    assert.deepEqual(browsers[1]?.calls.slice(0, 4), [
      'open:https://example.com/page?temporary=not-persisted',
      'device:iPhone 14',
      'viewport:390x844@3',
      'reload',
    ]);

    const desktop = join(root, '.pi', 'snatch', job.id, 'desktop');
    for (const file of ['page.png', 'full-page.png', 'snapshot.txt', 'facts.json', 'errors.txt', 'console.txt', 'network.json']) {
      await access(join(desktop, file));
    }
    const facts = await readFile(join(desktop, 'facts.json'), 'utf8');
    assert.equal(facts.includes('temporary=not-persisted'), false);
  });
});

test('rejects a cross-origin target before starting browsers', async () => {
  await withTestDir(async (root) => {
    const job = await createJob({
      root,
      id: 'origin-job',
      url: 'https://example.com/page',
      permissionMode: 'private-learning',
    });
    let browserCreated = false;

    await assert.rejects(
      captureJob({
        job,
        targetUrl: 'https://other.example/page',
        artifactDirectory: join(root, '.pi', 'snatch', job.id),
        createBrowser: () => {
          browserCreated = true;
          return new FakeBrowser();
        },
      }),
      /consent origin/i,
    );
    assert.equal(browserCreated, false);
  });
});

test('rejects cross-origin redirects before collecting profile artifacts', async () => {
  await withTestDir(async (root) => {
    const job = await createJob({
      root,
      id: 'redirect-job',
      url: 'https://example.com/page',
      permissionMode: 'private-learning',
    });
    const browser = new FakeBrowser(undefined, 'https://other.example/page');

    await assert.rejects(
      captureJob({
        job,
        targetUrl: 'https://example.com/page',
        artifactDirectory: join(root, '.pi', 'snatch', job.id),
        createBrowser: () => browser,
      }),
      /consent origin/i,
    );
    assert.equal(browser.closed, true);
    await assert.rejects(access(join(root, '.pi', 'snatch', job.id, 'desktop', 'facts.json')));
  });
});

test('closes every browser profile when a diagnostic fails', async () => {
  await withTestDir(async (root) => {
    const job = await createJob({
      root,
      id: 'failure-job',
      url: 'https://example.com/page',
      permissionMode: 'private-learning',
    });
    const browser = new FakeBrowser('errors');

    await assert.rejects(
      captureJob({
        job,
        targetUrl: 'https://example.com/page',
        artifactDirectory: join(root, '.pi', 'snatch', job.id),
        createBrowser: () => browser,
      }),
      /diagnostic failed/,
    );
    assert.equal(browser.closed, true);
  });
});
