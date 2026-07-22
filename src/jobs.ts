import { randomUUID } from 'node:crypto';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { PermissionMode, SnatchJob } from './contracts.js';

const SAFE_JOB_ID = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

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

  url.hash = '';
  return url.toString();
}

/** Creates durable, origin-scoped consent metadata and persists it atomically. */
export async function createJob(options: CreateJobOptions): Promise<SnatchJob> {
  if (!SAFE_JOB_ID.test(options.id)) {
    throw new Error('Job IDs may contain only letters, numbers, hyphens, and underscores.');
  }

  if (
    options.permissionMode !== 'owned-or-authorized'
    && options.permissionMode !== 'private-learning'
  ) {
    throw new Error('A valid permission mode is required.');
  }

  const rootUrl = normalizePublicUrl(options.url);
  const consentOrigin = new URL(rootUrl).origin;
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

  const snatchRoot = join(options.root, '.pi', 'snatch');
  const jobDirectory = join(snatchRoot, options.id);
  await mkdir(snatchRoot, { recursive: true });
  await mkdir(jobDirectory);

  const jobPath = join(jobDirectory, 'job.json');
  const temporaryJobPath = join(jobDirectory, `.job-${randomUUID()}.json`);
  await writeFile(temporaryJobPath, `${JSON.stringify(job, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
  await rename(temporaryJobPath, jobPath);

  return job;
}

/** Returns whether a URL belongs to the exact origin covered by the job's consent. */
export function canCapture(job: SnatchJob, targetUrl: string): boolean {
  try {
    return new URL(normalizePublicUrl(targetUrl)).origin === job.consent.origin;
  } catch {
    return false;
  }
}
