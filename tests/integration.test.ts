import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import test from 'node:test';
import { PNG } from 'pngjs';

import { analyzeCapturedJob } from '../src/analyze.js';
import { captureJob, type CaptureBrowser } from '../src/capture.js';
import { createJob } from '../src/jobs.js';
import { validateJob, type ValidationBrowser } from '../src/validate.js';
import { withTestDir } from './helpers/test-dir.js';

function screenshot(color: number): Buffer {
  const image = new PNG({ width: 1, height: 1 });
  image.data.set([color, 0, 0, 255]);
  return PNG.sync.write(image);
}

function captureBrowser(): CaptureBrowser {
  return {
    open: async (url) => url,
    setDevice: async () => {}, setViewport: async () => {}, reload: async () => {}, waitForIdle: async () => {},
    screenshot: async (path) => { await writeFile(path, screenshot(0)); },
    snapshot: async () => 'safe snapshot',
    evalJson: async <T>() => ({ regions: [{ tag: 'main', role: null, styles: { color: 'rgb(0, 0, 0)' } }], animations: [] }) as T,
    errors: async () => '', console: async () => '', networkRequests: async () => '[]', close: async () => {},
  };
}

function validationBrowser(color: number): ValidationBrowser {
  return {
    open: async (url) => url,
    setDevice: async () => {}, setViewport: async () => {}, setReducedMotion: async () => {}, waitForIdle: async () => {},
    screenshot: async (path) => { await writeFile(path, screenshot(color)); },
    snapshot: async () => 'local snapshot',
    errors: async () => '', console: async () => '', networkRequests: async () => '[]', close: async () => {},
  };
}

test('runs consented capture, analysis, local validation, and visual diff workflow', async () => {
  await withTestDir(async (root) => {
    const job = await createJob({ root, id: 'fixture', url: 'https://example.com/', permissionMode: 'owned-or-authorized' });
    const artifactDirectory = `${root}/.pi/snatch/${job.id}`;
    await captureJob({ job, targetUrl: 'https://example.com/', artifactDirectory, createBrowser: captureBrowser });
    const brief = await analyzeCapturedJob({ job, artifactDirectory, projectDirectory: root });
    assert.equal(brief.framework, 'static');

    const passed = await validateJob({ job, artifactDirectory, localUrl: 'http://localhost:3000/', createBrowser: () => validationBrowser(0) });
    assert.equal(passed.passed, true);

    const failed = await validateJob({ job, artifactDirectory, localUrl: 'http://localhost:3000/', createBrowser: () => validationBrowser(255) });
    assert.equal(failed.passed, false);
    assert.equal(failed.findings.some((finding) => finding.code === 'visual-mismatch'), true);
  });
});
