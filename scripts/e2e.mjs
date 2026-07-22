#!/usr/bin/env node
import { join } from 'node:path';

import { AgentBrowserClient } from '../src/agent-browser.ts';
import { loadJob } from '../src/jobs.ts';
import { validateJob } from '../src/validate.ts';

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const jobId = argument('--job');
const localUrl = argument('--local-url');
if (!jobId || !localUrl) {
  throw new Error('Usage: node --import tsx scripts/e2e.mjs --job <job-id> --local-url <loopback-url>');
}

const root = process.cwd();
const job = await loadJob(root, jobId);
const report = await validateJob({
  job,
  artifactDirectory: join(root, '.pi', 'snatch', job.id),
  localUrl,
  createBrowser: (profile) => new AgentBrowserClient({
    jobId: `${job.id}-validation-${profile.name}`,
    artifactDirectory: join(root, '.pi', 'snatch', job.id, 'validation', profile.name, 'diagnostics'),
    allowLoopback: true,
  }),
});
console.log(JSON.stringify({ reportPath: `.pi/snatch/${job.id}/validation-report.json`, passed: report.passed }));
process.exitCode = report.passed ? 0 : 1;
