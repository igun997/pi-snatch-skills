import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { PNG } from 'pngjs';

import { withTestDir } from './helpers/test-dir.js';
import {
  outputDimensions,
  planVerticalTiles,
  stitchTiles,
} from '../src/full-page-stitch.js';

async function writePng(path: string, width: number, height: number, color: [number, number, number, number]): Promise<void> {
  const image = new PNG({ width, height });
  for (let offset = 0; offset < image.data.length; offset += 4) image.data.set(color, offset);
  await writeFile(path, PNG.sync.write(image));
}

test('plans bottom-up viewport tiles with 200px overlap and exact top coverage', () => {
  assert.deepEqual(planVerticalTiles({ documentHeight: 2_100, viewportHeight: 900 }), [1_200, 500, 0]);
  assert.deepEqual(planVerticalTiles({ documentHeight: 900, viewportHeight: 900 }), [0]);
});

test('scales document bounds to viewport tile pixels', () => {
  assert.deepEqual(outputDimensions({ documentWidth: 1_440, documentHeight: 8_525, viewportCssWidth: 1_440, tilePixelWidth: 1_440 }), {
    width: 1_440,
    height: 8_525,
    scale: 1,
  });
  assert.deepEqual(outputDimensions({ documentWidth: 390, documentHeight: 15_341, viewportCssWidth: 390, tilePixelWidth: 1_170 }), {
    width: 1_170,
    height: 46_023,
    scale: 3,
  });
});

test('stitches bottom-up tiles and lets upper tiles replace overlap', async () => {
  await withTestDir(async (root) => {
    const top = join(root, 'top.png');
    const bottom = join(root, 'bottom.png');
    await writePng(top, 2, 3, [255, 0, 0, 255]);
    await writePng(bottom, 2, 3, [0, 0, 255, 255]);

    const paths = await stitchTiles({
      documentWidth: 2,
      documentHeight: 5,
      viewportCssWidth: 2,
      tiles: [{ path: bottom, y: 2 }, { path: top, y: 0 }],
      outputDirectory: root,
    });

    assert.deepEqual(paths, [join(root, 'full-page.png')]);
    const image = PNG.sync.read(await readFile(paths[0]!));
    assert.deepEqual([image.width, image.height], [2, 5]);
    assert.deepEqual(Array.from(image.data.slice(0, 4)), [255, 0, 0, 255]);
    assert.deepEqual(Array.from(image.data.slice(2 * 3 * 4, 2 * 3 * 4 + 4)), [0, 0, 255, 255]);
  });
});

test('splits tall stitched output at 30000px', async () => {
  await withTestDir(async (root) => {
    const tile = join(root, 'tile.png');
    await writePng(tile, 2, 1, [0, 255, 0, 255]);

    const paths = await stitchTiles({
      documentWidth: 2,
      documentHeight: 30_001,
      viewportCssWidth: 2,
      tiles: [{ path: tile, y: 0 }],
      outputDirectory: root,
    });

    assert.deepEqual(paths, [join(root, 'full-page-1.png'), join(root, 'full-page-2.png')]);
    const [first, second] = await Promise.all(paths.map(async (path) => PNG.sync.read(await readFile(path))));
    assert.ok(first);
    assert.ok(second);
    assert.deepEqual([first.width, first.height], [2, 30_000]);
    assert.deepEqual([second.width, second.height], [2, 1]);
  });
});
