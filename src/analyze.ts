import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { detectIconCandidates, type DetectedIcon, type IconCandidate } from './icon-vendors.js';

export type Framework = 'next' | 'sveltekit' | 'vue' | 'static';

type PackageJson = { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
type Region = { tag: string; role: string | null; styles: Record<string, string> };
type Motion = { target: string | null; duration: number | null; delay: number | null; easing: string | null; iterations: number | null };

export interface DesignBrief {
  framework: Framework;
  components: Array<{ name: string; occurrences: number }>;
  tokens: { colors: string[]; fontFamilies: string[]; spacing: string[] };
  motion: Motion[];
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
  await writeFile(join(outputDirectory, 'motion-spec.json'), `${JSON.stringify(brief.motion, null, 2)}\n`);
  await writeFile(
    join(outputDirectory, 'provenance.md'),
    `# Provenance\n\nOrigin: ${provenance.origin}\nPermission mode: ${provenance.permissionMode}\n\nNo source assets or code were reused.\n`,
  );
}

export function analyzeDesignFacts(input: {
  framework: Framework;
  profiles: Array<{ name: string; regions: Region[]; animations: Motion[]; icons?: IconCandidate[] }>;
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
    icons,
  };
}
