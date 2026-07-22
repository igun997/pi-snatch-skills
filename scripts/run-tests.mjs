import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

/**
 * Returns every TypeScript node:test file below a test directory in a stable order.
 *
 * @param {string} testsDirectory
 * @returns {Promise<string[]>}
 */
export async function discoverTestFiles(testsDirectory) {
  const entries = await readdir(testsDirectory, { withFileTypes: true });
  const paths = await Promise.all(entries.map(async (entry) => {
    const entryPath = join(testsDirectory, entry.name);

    if (entry.isDirectory()) {
      return discoverTestFiles(entryPath);
    }

    return entry.isFile() && entry.name.endsWith('.test.ts') ? [entryPath] : [];
  }));

  return paths.flat().sort();
}

async function runTests() {
  const testFiles = await discoverTestFiles(join(process.cwd(), 'tests'));

  if (testFiles.length === 0) {
    throw new Error('No TypeScript test files found under tests/.');
  }

  const child = spawn(process.execPath, ['--import', 'tsx', '--test', ...testFiles], {
    stdio: 'inherit',
  });
  const { code, signal } = await new Promise((resolveResult, rejectResult) => {
    child.once('error', rejectResult);
    child.once('close', (exitCode, exitSignal) => {
      resolveResult({ code: exitCode, signal: exitSignal });
    });
  });

  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exitCode = code ?? 1;
}

const executedPath = process.argv[1];
if (executedPath && resolve(executedPath) === fileURLToPath(import.meta.url)) {
  await runTests();
}
