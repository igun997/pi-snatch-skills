#!/usr/bin/env node
// Run with: node --import tsx scripts/capture.mjs --job <artifact-dir> --target-url <url>
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { AgentBrowserClient } from '../src/agent-browser.ts';
import { captureJob } from '../src/capture.ts';

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const artifactDirectory = argument('--job');
const targetUrl = argument('--target-url');
if (!artifactDirectory || !targetUrl) {
  throw new Error('Usage: node --import tsx scripts/capture.mjs --job <artifact-dir> --target-url <url>');
}

const directory = resolve(artifactDirectory);
const job = JSON.parse(await readFile(`${directory}/job.json`, 'utf8'));
const manifest = await captureJob({
  job,
  targetUrl,
  artifactDirectory: directory,
  createBrowser: (profile) =>
    new AgentBrowserClient({
      jobId: `${job.id}-${profile.name}`,
      artifactDirectory: `${directory}/${profile.name}`,
    }),
});
console.log(JSON.stringify(manifest));
