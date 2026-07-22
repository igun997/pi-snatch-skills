import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

export interface Mask { x: number; y: number; width: number; height: number }

export interface ScreenshotComparisonOptions {
  baselinePath: string;
  candidatePath: string;
  outputDirectory: string;
  masks?: Mask[];
  threshold?: number;
}

export interface ScreenshotComparisonReport {
  baselinePath: string;
  candidatePath: string;
  diffPath: string;
  mismatchedPixels: number;
  mismatchRatio: number;
  masks: Mask[];
  threshold: number;
}

export function comparePixels(
  baseline: Uint8Array,
  candidate: Uint8Array,
  width: number,
  height: number,
  masks: Mask[],
): { mismatchedPixels: number; mismatchRatio: number } {
  if (baseline.length !== candidate.length || baseline.length !== width * height * 4) {
    throw new Error('Screenshot dimensions differ.');
  }
  let mismatchedPixels = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (masks.some((mask) => x >= mask.x && x < mask.x + mask.width && y >= mask.y && y < mask.y + mask.height)) continue;
    const offset = (y * width + x) * 4;
    if ([0, 1, 2, 3].some((channel) => baseline[offset + channel] !== candidate[offset + channel])) mismatchedPixels++;
  }
  return { mismatchedPixels, mismatchRatio: mismatchedPixels / (width * height) };
}

function applyMasks(image: PNG, masks: Mask[]): void {
  for (const mask of masks) {
    for (let y = Math.max(0, mask.y); y < Math.min(image.height, mask.y + mask.height); y++) {
      for (let x = Math.max(0, mask.x); x < Math.min(image.width, mask.x + mask.width); x++) {
        const offset = (y * image.width + x) * 4;
        image.data.fill(0, offset, offset + 4);
      }
    }
  }
}

export async function compareScreenshots(options: ScreenshotComparisonOptions): Promise<ScreenshotComparisonReport> {
  const baseline = PNG.sync.read(await readFile(options.baselinePath));
  const candidate = PNG.sync.read(await readFile(options.candidatePath));
  if (baseline.width !== candidate.width || baseline.height !== candidate.height) {
    throw new Error('Screenshot dimensions differ.');
  }
  const masks = options.masks ?? [];
  const baselineData = new PNG({ width: baseline.width, height: baseline.height, fill: true });
  const candidateData = new PNG({ width: candidate.width, height: candidate.height, fill: true });
  baselineData.data.set(baseline.data);
  candidateData.data.set(candidate.data);
  applyMasks(baselineData, masks);
  applyMasks(candidateData, masks);
  const diff = new PNG({ width: baseline.width, height: baseline.height });
  const threshold = options.threshold ?? 0.1;
  const mismatchedPixels = pixelmatch(baselineData.data, candidateData.data, diff.data, baseline.width, baseline.height, { threshold });
  await mkdir(options.outputDirectory, { recursive: true });
  const diffPath = join(options.outputDirectory, 'diff.png');
  const report: ScreenshotComparisonReport = {
    baselinePath: options.baselinePath,
    candidatePath: options.candidatePath,
    diffPath,
    mismatchedPixels,
    mismatchRatio: mismatchedPixels / (baseline.width * baseline.height),
    masks,
    threshold,
  };
  await Promise.all([
    writeFile(diffPath, PNG.sync.write(diff)),
    writeFile(join(options.outputDirectory, 'comparison.json'), `${JSON.stringify(report, null, 2)}\n`),
  ]);
  return report;
}
