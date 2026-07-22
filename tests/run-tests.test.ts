import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import { discoverTestFiles } from '../scripts/run-tests.mjs';
import { withTestDir } from './helpers/test-dir.js';

test('discovers and sorts only TypeScript test files recursively', async () => {
  await withTestDir(async (directory) => {
    const testsDirectory = join(directory, 'tests');
    await mkdir(join(testsDirectory, 'nested', 'deeper'), { recursive: true });
    await Promise.all([
      writeFile(join(testsDirectory, 'zeta.test.ts'), ''),
      writeFile(join(testsDirectory, 'nested', 'alpha.test.ts'), ''),
      writeFile(join(testsDirectory, 'nested', 'deeper', 'beta.test.ts'), ''),
      writeFile(join(testsDirectory, 'nested', 'helper.ts'), ''),
      writeFile(join(testsDirectory, 'nested', 'ignored.test.js'), ''),
    ]);

    assert.deepEqual(await discoverTestFiles(testsDirectory), [
      join(testsDirectory, 'nested', 'alpha.test.ts'),
      join(testsDirectory, 'nested', 'deeper', 'beta.test.ts'),
      join(testsDirectory, 'zeta.test.ts'),
    ]);
  });
});
