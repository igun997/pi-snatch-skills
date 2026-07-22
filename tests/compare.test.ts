import assert from 'node:assert/strict';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { PNG } from 'pngjs';

import { comparePixels, compareScreenshots } from '../src/compare.js';
import { withTestDir } from './helpers/test-dir.js';

test('counts changed RGBA pixels and honors masks', () => {
  const baseline = new Uint8Array([0, 0, 0, 255, 0, 0, 0, 255]);
  const candidate = new Uint8Array([255, 0, 0, 255, 0, 0, 0, 255]);
  assert.equal(comparePixels(baseline, candidate, 2, 1, []).mismatchedPixels, 1);
  assert.equal(comparePixels(baseline, candidate, 2, 1, [{ x: 0, y: 0, width: 1, height: 1 }]).mismatchedPixels, 0);
});

test('writes visual diff and comparison report for PNG screenshots', async () => {
  await withTestDir(async (root) => {
    const baseline = new PNG({ width: 1, height: 1 });
    baseline.data.set([0, 0, 0, 255]);
    const candidate = new PNG({ width: 1, height: 1 });
    candidate.data.set([255, 0, 0, 255]);
    const baselinePath = join(root, 'baseline.png');
    const candidatePath = join(root, 'candidate.png');
    const outputDirectory = join(root, 'comparison');
    await mkdir(outputDirectory);
    await writeFile(baselinePath, PNG.sync.write(baseline));
    await writeFile(candidatePath, PNG.sync.write(candidate));

    const report = await compareScreenshots({ baselinePath, candidatePath, outputDirectory, masks: [] });
    assert.equal(report.mismatchedPixels, 1);
    assert.equal(report.mismatchRatio, 1);
    await access(join(outputDirectory, 'diff.png'));
    assert.equal((await readFile(join(outputDirectory, 'comparison.json'), 'utf8')).includes('mismatchedPixels'), true);
  });
});
