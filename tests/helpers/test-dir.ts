import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function withTestDir<T>(callback: (directory: string) => T | Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), 'pi-snatch-skills-'));

  try {
    return await callback(directory);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}
