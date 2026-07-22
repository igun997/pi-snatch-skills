#!/usr/bin/env node
import { compareScreenshots } from '../src/compare.ts';

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const baselinePath = argument('--baseline');
const candidatePath = argument('--candidate');
const outputDirectory = argument('--output');
if (!baselinePath || !candidatePath || !outputDirectory) {
  throw new Error('Usage: node --import tsx scripts/compare.mjs --baseline <png> --candidate <png> --output <directory>');
}

const report = await compareScreenshots({ baselinePath, candidatePath, outputDirectory });
console.log(JSON.stringify({ reportPath: `${outputDirectory}/comparison.json`, mismatchedPixels: report.mismatchedPixels }));
