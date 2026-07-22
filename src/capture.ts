import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

import { BROWSER_INTROSPECTION_SCRIPT } from './browser-introspection.js';
import type { CaptureArtifact, CaptureManifest, CaptureProfile, SnatchJob } from './contracts.js';
import { canCapture } from './jobs.js';

export interface CaptureBrowser {
  open(url: string): Promise<string>;
  setDevice(name: string): Promise<void>;
  setViewport(width: number, height: number, scale?: number): Promise<void>;
  reload(): Promise<void>;
  waitForIdle(): Promise<void>;
  screenshot(path: string, fullPage?: boolean): Promise<void>;
  snapshot(interactive?: boolean): Promise<string>;
  evalJson<T>(script: string): Promise<T>;
  errors(): Promise<string>;
  console(): Promise<string>;
  networkRequests(): Promise<string>;
  close(): Promise<void>;
}

export interface CaptureOptions {
  job: SnatchJob;
  targetUrl: string;
  artifactDirectory: string;
  createBrowser: (profile: CaptureProfile) => CaptureBrowser;
}

export const DEFAULT_CAPTURE_PROFILES: CaptureProfile[] = [
  { name: 'desktop', width: 1440, height: 900, deviceScaleFactor: 1 },
  { name: 'mobile', device: 'iPhone 14', width: 390, height: 844, deviceScaleFactor: 3 },
];

async function writeText(path: string, value: string): Promise<CaptureArtifact> {
  await writeFile(path, value, 'utf8');
  return artifactFor(path, 'text/plain');
}

async function writeJson(path: string, value: unknown): Promise<CaptureArtifact> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return artifactFor(path, 'application/json');
}

async function artifactFor(path: string, mediaType: string): Promise<CaptureArtifact> {
  const content = await readFile(path);
  return {
    path,
    mediaType,
    sha256: createHash('sha256').update(content).digest('hex'),
  };
}

async function captureProfile(
  job: SnatchJob,
  profile: CaptureProfile,
  targetUrl: string,
  artifactDirectory: string,
  createBrowser: (profile: CaptureProfile) => CaptureBrowser,
): Promise<CaptureArtifact[]> {
  const browser = createBrowser(profile);
  const profileDirectory = join(artifactDirectory, profile.name);
  await mkdir(profileDirectory, { recursive: true });
  let captureCompleted = false;

  try {
    const finalUrl = await browser.open(targetUrl);
    if (!canCapture(job, finalUrl)) {
      throw new Error('Capture redirect is outside the recorded consent origin.');
    }
    if (profile.device) await browser.setDevice(profile.device);
    await browser.setViewport(profile.width ?? 1440, profile.height ?? 900, profile.deviceScaleFactor);
    await browser.reload();
    await browser.waitForIdle();

    const pagePath = join(profileDirectory, 'page.png');
    const fullPagePath = join(profileDirectory, 'full-page.png');
    await browser.screenshot(pagePath);
    await browser.screenshot(fullPagePath, true);

    const [snapshot, facts, errors, consoleOutput, network] = await Promise.all([
      browser.snapshot(),
      browser.evalJson<unknown>(BROWSER_INTROSPECTION_SCRIPT),
      browser.errors(),
      browser.console(),
      browser.networkRequests(),
    ]);
    captureCompleted = true;

    return [
      await artifactFor(pagePath, 'image/png'),
      await artifactFor(fullPagePath, 'image/png'),
      await writeText(join(profileDirectory, 'snapshot.txt'), snapshot),
      await writeJson(join(profileDirectory, 'facts.json'), facts),
      await writeText(join(profileDirectory, 'errors.txt'), errors),
      await writeText(join(profileDirectory, 'console.txt'), consoleOutput),
      await writeText(join(profileDirectory, 'network.json'), network),
    ];
  } finally {
    try {
      await browser.close();
    } catch (error) {
      if (captureCompleted) throw error;
    }
  }
}

export async function captureJob(options: CaptureOptions): Promise<CaptureManifest> {
  if (!canCapture(options.job, options.targetUrl)) {
    throw new Error('Capture target is outside the recorded consent origin.');
  }

  const artifacts = (
    await Promise.all(
      DEFAULT_CAPTURE_PROFILES.map((profile) =>
        captureProfile(options.job, profile, options.targetUrl, options.artifactDirectory, options.createBrowser),
      ),
    )
  ).flat();
  const manifest: CaptureManifest = {
    jobId: options.job.id,
    createdAt: new Date().toISOString(),
    profiles: DEFAULT_CAPTURE_PROFILES,
    artifacts: artifacts.map((artifact) => ({
      ...artifact,
      path: relative(options.artifactDirectory, artifact.path),
    })),
  };
  await writeJson(join(options.artifactDirectory, 'capture-manifest.json'), manifest);
  return manifest;
}
