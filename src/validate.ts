import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { compareScreenshots, type Mask } from './compare.js';
import { BROWSER_INTROSPECTION_SCRIPT } from './browser-introspection.js';
import type { CaptureProfile, SnatchJob, ValidationFinding, ValidationReport } from './contracts.js';

export interface ValidationBrowser {
  open(url: string): Promise<string>;
  setDevice(name: string): Promise<void>;
  setViewport(width: number, height: number, scale?: number): Promise<void>;
  setReducedMotion(): Promise<void>;
  waitForIdle(): Promise<void>;
  wait(ms: number): Promise<void>;
  scrollTo(y: number): Promise<number>;
  evalJson(script: string): Promise<unknown>;
  screenshot(path: string): Promise<void>;
  snapshot(): Promise<string>;
  errors(): Promise<string>;
  console(): Promise<string>;
  networkRequests(): Promise<string>;
  close(): Promise<void>;
  focus?(target: string): Promise<void>;
  hover?(target: string): Promise<void>;
  press?(key: string): Promise<void>;
  click?(target: string): Promise<void>;
}

export interface SafeScenario {
  action: 'focus' | 'hover' | 'press' | 'click';
  target: string;
  label?: string;
}

export interface ValidateJobOptions {
  job: SnatchJob;
  artifactDirectory: string;
  localUrl: string;
  createBrowser: (profile: CaptureProfile) => ValidationBrowser;
  masks?: Mask[];
  scenarios?: SafeScenario[];
}

export const VALIDATION_PROFILES: CaptureProfile[] = [
  { name: 'desktop', width: 1440, height: 900, deviceScaleFactor: 1 },
  { name: 'mobile', device: 'iPhone 14', width: 390, height: 844, deviceScaleFactor: 3 },
  { name: 'reduced-motion', width: 1440, height: 900, deviceScaleFactor: 1 },
];

const FORBIDDEN_SCENARIO = /\b(submit|delete|pay|logout|sign\s*out|purchase)\b/i;

interface MotionManifest {
  samples: Array<{ index: number; scrollY: number }>;
}

type MotionRuntimeFacts = {
  animations?: Array<{ playState?: string; iterations?: number | string | null }>;
  videos?: Array<{ paused?: boolean }>;
  media?: { reducedMotion?: boolean };
};

async function readMotionManifest(artifactDirectory: string, profile: string): Promise<MotionManifest | null> {
  try {
    const value = JSON.parse(await readFile(join(artifactDirectory, profile, 'motion', 'motion.json'), 'utf8')) as Partial<MotionManifest>;
    if (!Array.isArray(value.samples) || !value.samples.every((sample) => Number.isInteger(sample.index) && Number.isFinite(sample.scrollY))) {
      throw new Error(`Motion manifest is invalid for ${profile}.`);
    }
    return { samples: value.samples };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

async function validateMotionStates(
  options: ValidateJobOptions,
  profile: CaptureProfile,
  browser: ValidationBrowser,
): Promise<ValidationFinding[]> {
  const manifest = await readMotionManifest(options.artifactDirectory, profile.name);
  if (!manifest) return [];
  const profileDirectory = join(options.artifactDirectory, 'validation', profile.name, 'motion');
  await mkdir(profileDirectory, { recursive: true });
  const findings: ValidationFinding[] = [];
  for (const sample of manifest.samples) {
    await browser.scrollTo(sample.scrollY);
    await browser.wait(300);
    const filename = `scroll-${String(sample.index).padStart(2, '0')}.png`;
    const candidatePath = join(profileDirectory, filename);
    await browser.screenshot(candidatePath);
    const comparison = await compareScreenshots({
      baselinePath: join(options.artifactDirectory, profile.name, 'motion', filename),
      candidatePath,
      outputDirectory: join(profileDirectory, 'comparison', `scroll-${String(sample.index).padStart(2, '0')}`),
      masks: options.masks,
    });
    if (comparison.mismatchedPixels > 0) {
      findings.push({
        code: 'motion-visual-mismatch',
        message: `Local motion state differs at scroll position ${sample.scrollY}.`,
        artifactPath: join('validation', profile.name, 'motion', 'comparison', `scroll-${String(sample.index).padStart(2, '0')}`, 'diff.png'),
      });
    }
  }
  return findings;
}

function reducedMotionFindings(facts: MotionRuntimeFacts): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  if (facts.media?.reducedMotion !== true) {
    findings.push({ code: 'reduced-motion-not-applied', message: 'Local browser did not expose reduced-motion preference.' });
  }
  if ((facts.animations ?? []).some((animation) => animation.playState === 'running' && (animation.iterations === 'infinite' || animation.iterations === Infinity))) {
    findings.push({ code: 'reduced-motion-infinite-animation', message: 'Local rebuild keeps an infinite animation running under reduced motion.' });
  }
  if ((facts.videos ?? []).some((video) => video.paused === false)) {
    findings.push({ code: 'reduced-motion-active-video', message: 'Local rebuild plays video under reduced motion.' });
  }
  return findings;
}

export function assertLocalUrl(value: string): string {
  const url = new URL(value);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('Validation URL must use loopback host.');
  }
  return url.toString();
}

export function nextRepairAttempt(current: number): number {
  if (current >= 3) throw new Error('Repair loop limit is three attempts.');
  return current + 1;
}

function assertSafeScenarios(scenarios: SafeScenario[]): void {
  for (const scenario of scenarios) {
    if (!scenario.target.trim() || !['focus', 'hover', 'press', 'click'].includes(scenario.action)) {
      throw new Error('Validation scenario is invalid.');
    }
    if (FORBIDDEN_SCENARIO.test(`${scenario.label ?? ''} ${scenario.target}`)) {
      throw new Error('Validation scenario is forbidden.');
    }
  }
}

async function runScenario(browser: ValidationBrowser, scenario: SafeScenario): Promise<void> {
  const method = browser[scenario.action];
  if (!method) throw new Error(`Browser does not support validation action: ${scenario.action}`);
  await method.call(browser, scenario.target);
}

function failedLocalRequests(raw: string, localUrl: string): ValidationFinding[] {
  let requests: unknown;
  try { requests = JSON.parse(raw); } catch { return []; }
  if (!Array.isArray(requests)) return [];
  const localOrigin = new URL(localUrl).origin;
  return requests.flatMap((request) => {
    if (!request || typeof request !== 'object') return [];
    const item = request as { url?: unknown; status?: unknown };
    if (typeof item.url !== 'string' || typeof item.status !== 'number') return [];
    try {
      return new URL(item.url).origin === localOrigin && item.status >= 400
        ? [{ code: 'failed-local-request', message: `Local request failed with ${item.status}.` }]
        : [];
    } catch { return []; }
  });
}

async function validateProfile(options: ValidateJobOptions, profile: CaptureProfile, localUrl: string): Promise<ValidationFinding[]> {
  const browser = options.createBrowser(profile);
  const profileDirectory = join(options.artifactDirectory, 'validation', profile.name);
  await mkdir(profileDirectory, { recursive: true });
  try {
    const finalUrl = await browser.open(localUrl);
    if (new URL(finalUrl).origin !== new URL(localUrl).origin) throw new Error('Validation browser left local origin.');
    if (profile.device) await browser.setDevice(profile.device);
    await browser.setViewport(profile.width ?? 1440, profile.height ?? 900, profile.deviceScaleFactor);
    if (profile.name === 'reduced-motion') await browser.setReducedMotion();
    await browser.waitForIdle();
    for (const scenario of options.scenarios ?? []) await runScenario(browser, scenario);
    const screenshotPath = join(profileDirectory, 'page.png');
    await browser.screenshot(screenshotPath);
    const [snapshot, errors, consoleOutput, network] = await Promise.all([
      browser.snapshot(), browser.errors(), browser.console(), browser.networkRequests(),
    ]);
    await Promise.all([
      writeFile(join(profileDirectory, 'snapshot.txt'), snapshot),
      writeFile(join(profileDirectory, 'errors.txt'), errors),
      writeFile(join(profileDirectory, 'console.txt'), consoleOutput),
      writeFile(join(profileDirectory, 'network.json'), network),
    ]);
    const motionFindings = profile.name === 'reduced-motion'
      ? reducedMotionFindings(await browser.evalJson(BROWSER_INTROSPECTION_SCRIPT) as MotionRuntimeFacts)
      : await validateMotionStates(options, profile, browser);
    const findings = [...motionFindings, ...failedLocalRequests(network, localUrl)];
    if (errors.trim()) findings.push({ code: 'console-errors', message: 'Local app emitted browser errors.', artifactPath: join('validation', profile.name, 'errors.txt') });
    const comparison = await compareScreenshots({
      baselinePath: join(options.artifactDirectory, profile.name === 'reduced-motion' ? 'desktop' : profile.name, 'page.png'),
      candidatePath: screenshotPath,
      outputDirectory: join(profileDirectory, 'comparison'),
      masks: options.masks,
    });
    if (comparison.mismatchedPixels > 0) findings.push({ code: 'visual-mismatch', message: 'Local screenshot differs from approved baseline.', artifactPath: join('validation', profile.name, 'comparison', 'diff.png') });
    return findings;
  } finally {
    await browser.close();
  }
}

export async function validateJob(options: ValidateJobOptions): Promise<ValidationReport> {
  const localUrl = assertLocalUrl(options.localUrl);
  assertSafeScenarios(options.scenarios ?? []);
  const findings = (await Promise.all(VALIDATION_PROFILES.map((profile) => validateProfile(options, profile, localUrl)))).flat();
  const report: ValidationReport = { jobId: options.job.id, validatedAt: new Date().toISOString(), passed: findings.length === 0, findings };
  await writeFile(join(options.artifactDirectory, 'validation-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}
