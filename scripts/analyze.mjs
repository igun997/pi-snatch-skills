#!/usr/bin/env node
import { join } from 'node:path';

import { analyzeCapturedJob } from '../src/analyze.ts';
import { loadJob } from '../src/jobs.ts';

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const jobId = argument('--job');
if (!jobId) throw new Error('Usage: node --import tsx scripts/analyze.mjs --job <job-id> [--project-root <path>]');

const root = process.cwd();
const job = await loadJob(root, jobId);
await analyzeCapturedJob({
  job,
  artifactDirectory: join(root, '.pi', 'snatch', job.id),
  projectDirectory: argument('--project-root') ?? root,
});
console.log(join('.pi', 'snatch', job.id, 'output', 'brief.json'));
