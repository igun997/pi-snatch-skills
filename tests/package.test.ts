import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const packageJsonUrl = new URL('../package.json', import.meta.url);
const packageLockUrl = new URL('../package-lock.json', import.meta.url);

test('declares Pi extension and skill directories', async () => {
  const pkg = JSON.parse(await readFile(packageJsonUrl, 'utf8')) as {
    name?: string;
    pi?: { extensions?: string[]; skills?: string[] };
  };

  assert.equal(pkg.name, 'pi-snatch-skills');
  assert.deepEqual(pkg.pi?.extensions, ['./extensions']);
  assert.deepEqual(pkg.pi?.skills, ['./skills']);
});

test('keeps the lockfile root package name in sync', async () => {
  const [pkg, lockfile] = await Promise.all([
    readFile(packageJsonUrl, 'utf8').then((content) => JSON.parse(content) as { name?: string }),
    readFile(packageLockUrl, 'utf8').then(
      (content) => JSON.parse(content) as { packages?: { '': { name?: string } } },
    ),
  ]);

  assert.equal(lockfile.packages?.[''].name, pkg.name);
});

test('uses the deterministic Node test launcher', async () => {
  const pkg = JSON.parse(await readFile(packageJsonUrl, 'utf8')) as {
    scripts?: { test?: string };
  };

  assert.equal(pkg.scripts?.test, 'node scripts/run-tests.mjs');
});
