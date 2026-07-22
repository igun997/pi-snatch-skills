import { randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { isIP } from 'node:net';
import { join } from 'node:path';

import type { JobStatus, PermissionMode, SnatchJob } from './contracts.js';

const SAFE_JOB_ID = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

export function isPublicHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost')) return false;

  if (isIP(host) === 4) {
    const [a, b] = host.split('.').map(Number);
    if (a === undefined || b === undefined) return false;
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && (b === 0 || b === 168)) return false;
    if (a === 198 && (b === 18 || b === 19)) return false;
    return true;
  }

  if (isIP(host) === 6) {
    return !(
      host === '::' ||
      host === '::1' ||
      host.startsWith('fc') ||
      host.startsWith('fd') ||
      /^fe[89ab]/.test(host) ||
      host.includes('::ffff:')
    );
  }

  return true;
}

async function ensureRealDirectory(path: string): Promise<void> {
  try {
    const stat = await lstat(path);
    if (stat.isSymbolicLink()) {
      throw new Error(`Artifact path may not be a symlink: ${path}`);
    }
    if (!stat.isDirectory()) {
      throw new Error(`Artifact path must be a directory: ${path}`);
    }
    return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  await mkdir(path);
  const stat = await lstat(path);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error(`Artifact path must be a real directory: ${path}`);
  }
}

async function assertExistingRealDirectory(path: string): Promise<void> {
  const stat = await lstat(path);
  if (stat.isSymbolicLink()) throw new Error(`Artifact path may not be a symlink: ${path}`);
  if (!stat.isDirectory()) throw new Error(`Artifact path must be a real directory: ${path}`);
}

async function createNewRealDirectory(path: string): Promise<void> {
  try {
    const stat = await lstat(path);
    if (stat.isSymbolicLink()) {
      throw new Error(`Artifact path may not be a symlink: ${path}`);
    }
    throw new Error(`Artifact job directory already exists: ${path}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  await mkdir(path);
  const stat = await lstat(path);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error(`Artifact path must be a real directory: ${path}`);
  }
}

export interface CreateJobOptions {
  root: string;
  id: string;
  url: string;
  permissionMode: PermissionMode;
}

/**
 * Converts a publicly fetchable URL into its persisted form.
 *
 * Query strings are retained verbatim (apart from URL-standard serialization), while
 * fragments are discarded because they never participate in an HTTP request.
 */
export function normalizePublicUrl(value: string): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error('A valid http or https URL is required.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http and https URLs are permitted.');
  }

  if (url.username || url.password) {
    throw new Error('URLs with embedded credentials are not permitted.');
  }

  if (!isPublicHost(url.hostname)) {
    throw new Error('Only public hosts are permitted.');
  }

  url.hash = '';
  return url.toString();
}

/** Creates durable, origin-scoped consent metadata and persists it atomically. */
function assertSafeJobId(id: string): void {
  if (!SAFE_JOB_ID.test(id)) {
    throw new Error('Job IDs may contain only letters, numbers, hyphens, and underscores.');
  }
}

export async function createJob(options: CreateJobOptions): Promise<SnatchJob> {
  assertSafeJobId(options.id);

  if (
    options.permissionMode !== 'owned-or-authorized'
    && options.permissionMode !== 'private-learning'
  ) {
    throw new Error('A valid permission mode is required.');
  }

  const normalizedUrl = normalizePublicUrl(options.url);
  const storedUrl = new URL(normalizedUrl);
  storedUrl.search = '';
  const rootUrl = storedUrl.toString();
  const consentOrigin = storedUrl.origin;
  const job: SnatchJob = {
    id: options.id,
    rootUrl,
    status: 'created',
    consent: {
      origin: consentOrigin,
      permissionMode: options.permissionMode,
      createdAt: new Date().toISOString(),
    },
  };

  const piRoot = join(options.root, '.pi');
  const snatchRoot = join(piRoot, 'snatch');
  const jobDirectory = join(snatchRoot, options.id);
  await ensureRealDirectory(piRoot);
  await ensureRealDirectory(snatchRoot);
  await createNewRealDirectory(jobDirectory);

  const jobPath = join(jobDirectory, 'job.json');
  const temporaryJobPath = join(jobDirectory, `.job-${randomUUID()}.json`);
  await writeFile(temporaryJobPath, `${JSON.stringify(job, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
  await rename(temporaryJobPath, jobPath);

  return job;
}

/** Loads and validates durable job metadata without traversing outside its artifact directory. */
export async function loadJob(root: string, id: string): Promise<SnatchJob> {
  assertSafeJobId(id);
  const piDirectory = join(root, '.pi');
  const snatchDirectory = join(piDirectory, 'snatch');
  const jobDirectory = join(snatchDirectory, id);
  await assertExistingRealDirectory(piDirectory);
  await assertExistingRealDirectory(snatchDirectory);
  await assertExistingRealDirectory(jobDirectory);

  const parsed: unknown = JSON.parse(await readFile(join(jobDirectory, 'job.json'), 'utf8'));
  if (!parsed || typeof parsed !== 'object') throw new Error('Stored job metadata is invalid.');
  const job = parsed as Partial<SnatchJob>;
  if (
    job.id !== id ||
    typeof job.rootUrl !== 'string' ||
    !job.consent ||
    typeof job.consent.origin !== 'string' ||
    (job.consent.permissionMode !== 'owned-or-authorized' && job.consent.permissionMode !== 'private-learning') ||
    !['created', 'capturing', 'captured', 'mirroring', 'mirrored', 'validated', 'failed'].includes(job.status ?? '')
  ) {
    throw new Error('Stored job metadata is invalid.');
  }
  const rootUrl = normalizePublicUrl(job.rootUrl);
  if (new URL(rootUrl).origin !== job.consent.origin || new URL(rootUrl).search) {
    throw new Error('Stored job metadata has invalid consent origin.');
  }
  return job as SnatchJob;
}

/** Atomically updates only a job's lifecycle status. */
export async function updateJobStatus(root: string, id: string, status: JobStatus): Promise<SnatchJob> {
  const job = await loadJob(root, id);
  const next: SnatchJob = { ...job, status };
  const directory = join(root, '.pi', 'snatch', id);
  const temporary = join(directory, `.job-${randomUUID()}.json`);
  await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  await rename(temporary, join(directory, 'job.json'));
  return next;
}

/** Returns whether a URL belongs to the exact origin covered by the job's consent. */
export function canCapture(job: SnatchJob, targetUrl: string): boolean {
  try {
    return new URL(normalizePublicUrl(targetUrl)).origin === job.consent.origin;
  } catch {
    return false;
  }
}
