import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { join, resolve } from 'node:path';
import test from 'node:test';

import { createJob } from '../src/jobs.js';
import { withTestDir } from './helpers/test-dir.js';

const execFile = promisify(execFileCallback);
const analyzeScript = resolve('scripts/analyze.mjs');
const tsxLoader = resolve('node_modules/tsx/dist/loader.mjs');

test('analysis CLI prints only generated brief path', async () => {
  await withTestDir(async (root) => {
    await createJob({ root, id: 'cli-job', url: 'https://example.com/', permissionMode: 'private-learning' });
    const factsDirectory = join(root, '.pi', 'snatch', 'cli-job', 'desktop');
    await mkdir(factsDirectory, { recursive: true });
    await writeFile(join(factsDirectory, 'facts.json'), JSON.stringify({ regions: [], animations: [] }));

    const { stdout } = await execFile(process.execPath, ['--import', tsxLoader, analyzeScript, '--job', 'cli-job'], { cwd: root });
    const outputPath = stdout.trim();
    assert.equal(outputPath, '.pi/snatch/cli-job/output/brief.json');
  });
});
