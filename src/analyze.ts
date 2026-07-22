import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { detectIconCandidates, type DetectedIcon, type IconCandidate } from './icon-vendors.js';
import { deriveMotionObservations, type MotionObservation, type MotionSample } from './motion.js';

export type Framework = 'next' | 'sveltekit' | 'vue' | 'static';

type PackageJson = { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
type Region = { tag: string; role: string | null; styles: Record<string, string> };
type Motion = { target: string | null; duration: number | null; delay: number | null; easing: string | null; iterations: number | null };

export interface DesignBrief {
  framework: Framework;
  components: Array<{ name: string; occurrences: number }>;
  tokens: { colors: string[]; fontFamilies: string[]; spacing: string[] };
  motion: Motion[];
  motionObservations: MotionObservation[];
  icons: DetectedIcon[];
}

export function detectFramework(packageJson: PackageJson): Framework {
  const packages = { ...packageJson.devDependencies, ...packageJson.dependencies };
  if (packages.next) return 'next';
  if (packages['@sveltejs/kit']) return 'sveltekit';
  if (packages.vue) return 'vue';
  return 'static';
}

const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const unique = (values: string[]) => [...new Set(values.filter(Boolean))].sort();

export async function writeDesignBrief(
  outputDirectory: string,
  brief: DesignBrief,
  provenance: { origin: string; permissionMode: string },
): Promise<void> {
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(join(outputDirectory, 'brief.json'), `${JSON.stringify(brief, null, 2)}\n`);
  await writeFile(
    join(outputDirectory, 'motion-spec.json'),
    `${JSON.stringify({ cssAnimations: brief.motion, scrollEffects: brief.motionObservations }, null, 2)}\n`,
  );
  await writeFile(
    join(outputDirectory, 'provenance.md'),
    `# Provenance\n\nOrigin: ${provenance.origin}\nPermission mode: ${provenance.permissionMode}\n\nNo source assets or code were reused.\n`,
  );
}

export interface AnalyzeCapturedJobOptions {
  artifactDirectory: string;
  projectDirectory: string;
  job: { id: string; consent: { origin: string; permissionMode: string } };
}

async function readPackageJson(projectDirectory: string): Promise<PackageJson> {
  try {
    return JSON.parse(await readFile(join(projectDirectory, 'package.json'), 'utf8')) as PackageJson;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw new Error('Project package.json is invalid.');
  }
}

export async function analyzeCapturedJob(options: AnalyzeCapturedJobOptions): Promise<DesignBrief> {
  const profiles = [] as Array<{ name: string; regions: Region[]; animations: Motion[]; icons: IconCandidate[]; motionSamples: MotionSample[] }>;
  for (const name of ['desktop', 'mobile']) {
    try {
      const fact = JSON.parse(await readFile(join(options.artifactDirectory, name, 'facts.json'), 'utf8')) as Partial<{ regions: Region[]; animations: Motion[]; icons: IconCandidate[] }>;
      let motionSamples: MotionSample[] = [];
      try {
        const motion = JSON.parse(await readFile(join(options.artifactDirectory, name, 'motion', 'motion.json'), 'utf8')) as Partial<{ samples: MotionSample[] }>;
        motionSamples = Array.isArray(motion.samples) ? motion.samples : [];
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error(`Motion capture facts are invalid for ${name}.`);
      }
      profiles.push({
        name,
        regions: Array.isArray(fact.regions) ? fact.regions : [],
        animations: Array.isArray(fact.animations) ? fact.animations : [],
        icons: Array.isArray(fact.icons) ? fact.icons : [],
        motionSamples,
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error(`Capture facts are invalid for ${name}.`);
    }
  }
  if (profiles.length === 0) throw new Error('No capture facts available for analysis.');
  const brief = analyzeDesignFacts({ framework: detectFramework(await readPackageJson(options.projectDirectory)), profiles });
  await writeDesignBrief(join(options.artifactDirectory, 'output'), brief, options.job.consent);
  return brief;
}

export function analyzeDesignFacts(input: {
  framework: Framework;
  profiles: Array<{ name: string; regions: Region[]; animations: Motion[]; icons?: IconCandidate[]; motionSamples?: MotionSample[] }>;
}): DesignBrief {
  const regions = input.profiles.flatMap((profile) => profile.regions);
  const counts = new Map<string, number>();
  for (const region of regions) {
    const key = `${region.tag}|${region.role ?? ''}|${region.styles.display ?? ''}|${region.styles.color ?? ''}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const components = [...counts.entries()]
    .filter(([, occurrences]) => occurrences >= 2)
    .map(([key, occurrences]) => ({ name: titleCase(key.split('|')[0] ?? 'component'), occurrences }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const styles = regions.map((region) => region.styles);
  const motion = input.profiles.flatMap((profile) => profile.animations).map(({ target, duration, delay, easing, iterations }) => ({ target, duration, delay, easing, iterations }));
  const motionObservations = input.profiles.flatMap((profile) => deriveMotionObservations({
    profile: profile.name,
    samples: profile.motionSamples ?? [],
  }));
  const icons = detectIconCandidates(input.profiles.flatMap((profile) => profile.icons ?? []));
  return {
    framework: input.framework,
    components,
    tokens: {
      colors: unique(styles.map((style) => style.color ?? '')),
      fontFamilies: unique(styles.map((style) => style.fontFamily ?? '')),
      spacing: unique(styles.flatMap((style) => [style.gap ?? '', style.paddingTop ?? '', style.marginTop ?? ''])),
    },
    motion,
    motionObservations,
    icons,
  };
}
