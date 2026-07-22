import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const packageJsonUrl = new URL('../package.json', import.meta.url);

test('declares Pi extension and skill directories', async () => {
  const pkg = JSON.parse(await readFile(packageJsonUrl, 'utf8')) as {
    name?: string;
    pi?: { extensions?: string[]; skills?: string[] };
  };

  assert.equal(pkg.name, 'pi-snatch-skills');
  assert.deepEqual(pkg.pi?.extensions, ['./extensions']);
  assert.deepEqual(pkg.pi?.skills, ['./skills']);
});
