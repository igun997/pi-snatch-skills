import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

import { BROWSER_INTROSPECTION_SCRIPT } from './browser-introspection.js';
import type { CaptureArtifact, CaptureManifest, CaptureProfile, SnatchJob } from './contracts.js';
import { planVerticalTiles, stitchTiles } from './full-page-stitch.js';
import { canCapture } from './jobs.js';
import { planMotionSamplePositions, type MotionFacts, type MotionSample } from './motion.js';

export interface CaptureBrowser {
  open(url: string): Promise<string>;
  setDevice(name: string): Promise<void>;
  setViewport(width: number, height: number, scale?: number): Promise<void>;
  reload(): Promise<void>;
  waitForIdle(): Promise<void>;
  wait(ms: number): Promise<void>;
  scroll(delta: number): Promise<void>;
  scrollToTop(): Promise<void>;
  documentHeight(): Promise<number>;
  documentSize(): Promise<{ width: number; height: number; viewportWidth: number }>;
  scrollTo(y: number): Promise<number>;
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

export async function settleAndScroll(browser: Pick<CaptureBrowser, 'wait' | 'scroll' | 'scrollToTop' | 'documentHeight'>): Promise<void> {
  await browser.wait(8000);
  let height = await browser.documentHeight();
  for (let step = 0; step < 60; step += 1) {
    await browser.scroll(700);
    await browser.wait(500);
    const next = await browser.documentHeight();
    if (next <= height) break;
    height = next;
  }
  await browser.scrollToTop();
  await browser.wait(1000);
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

async function removeStaleFullPageArtifacts(profileDirectory: string): Promise<void> {
  const entries = await readdir(profileDirectory);
  await Promise.all(entries
    .filter((entry) => /^full-page(?:-\d+)?\.png$/.test(entry))
    .map((entry) => rm(join(profileDirectory, entry), { force: true })));
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
  await removeStaleFullPageArtifacts(profileDirectory);
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
    await settleAndScroll(browser);

    const documentSize = await browser.documentSize();
    const motionDirectory = join(profileDirectory, 'motion');
    const motionSamples: MotionSample[] = [];
    const motionArtifacts: CaptureArtifact[] = [];
    await mkdir(motionDirectory, { recursive: true });
    for (const [index, y] of planMotionSamplePositions(documentSize.height, profile.height ?? 900).entries()) {
      const scrollY = await browser.scrollTo(y);
      await browser.wait(300);
      const screenshotPath = join(motionDirectory, `scroll-${String(index).padStart(2, '0')}.png`);
      await browser.screenshot(screenshotPath);
      motionSamples.push({
        index,
        scrollY,
        facts: await browser.evalJson<MotionFacts>(BROWSER_INTROSPECTION_SCRIPT),
      });
      motionArtifacts.push(await artifactFor(screenshotPath, 'image/png'));
    }
    motionArtifacts.push(await writeJson(join(motionDirectory, 'motion.json'), { samples: motionSamples }));

    const pagePath = join(profileDirectory, 'page.png');
    await browser.scrollTo(0);
    await browser.wait(150);
    await browser.screenshot(pagePath);

    const tileDirectory = join(profileDirectory, 'full-page-tiles');
    const fullPagePaths: string[] = [];
    await mkdir(tileDirectory, { recursive: true });
    try {
      const tiles = [];
      for (const [index, y] of planVerticalTiles({
        documentHeight: documentSize.height,
        viewportHeight: profile.height ?? 900,
      }).entries()) {
        const actualY = await browser.scrollTo(y);
        await browser.wait(150);
        const path = join(tileDirectory, `${String(index).padStart(4, '0')}.png`);
        await browser.screenshot(path);
        tiles.push({ path, y: actualY });
      }
      fullPagePaths.push(...await stitchTiles({
        documentWidth: documentSize.width,
        documentHeight: documentSize.height,
        viewportCssWidth: documentSize.viewportWidth,
        tiles,
        outputDirectory: profileDirectory,
      }));
    } finally {
      await rm(tileDirectory, { recursive: true, force: true });
    }

    await browser.scrollTo(0);
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
      ...motionArtifacts,
      ...await Promise.all(fullPagePaths.map((path) => artifactFor(path, 'image/png'))),
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
