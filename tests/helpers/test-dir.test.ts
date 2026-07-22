import assert from 'node:assert/strict';
import { access, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { relative } from 'node:path';
import test from 'node:test';

import { withTestDir } from './test-dir.js';

test('withTestDir creates isolated temporary directories and removes them after callbacks', async () => {
  const directories: string[] = [];

  await withTestDir(async (directory) => {
    directories.push(directory);
    assert.equal(relative(tmpdir(), directory).startsWith('pi-snatch-skills-'), true);
    await writeFile(`${directory}/artifact.txt`, 'test artifact');
  });

  await withTestDir(async (directory) => {
    directories.push(directory);
    await writeFile(`${directory}/artifact.txt`, 'another test artifact');
  });

  assert.notEqual(directories[0], directories[1]);
  await Promise.all(
    directories.map((directory) => assert.rejects(access(directory))),
  );
});

test('withTestDir removes its temporary directory when its callback throws', async () => {
  let directory = '';

  await assert.rejects(
    withTestDir(async (testDirectory) => {
      directory = testDirectory;
      throw new Error('expected callback failure');
    }),
    /expected callback failure/,
  );

  await assert.rejects(access(directory));
});
