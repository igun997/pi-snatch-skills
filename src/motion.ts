export const MOTION_SAMPLE_COUNT = 5;

export type MotionKind = 'reveal' | 'zoom' | 'translate' | 'sticky' | 'video-progress';

export interface MotionRegion {
  tag: string;
  role: string | null;
  box: { x: number; y: number; width: number; height: number };
  styles: Record<string, string>;
}

export interface MotionVideo {
  currentTime: number;
  duration: number | null;
  paused: boolean;
}

export interface MotionFacts {
  regions?: MotionRegion[];
  videos?: MotionVideo[];
}

export interface MotionSample {
  index: number;
  scrollY: number;
  facts: MotionFacts;
}

export interface MotionObservation {
  profile: string;
  kind: MotionKind;
  target: string;
  from: { scrollY: number; value: number | string };
  to: { scrollY: number; value: number | string };
  confidence: 'high' | 'medium';
}

export function planMotionSamplePositions(documentHeight: number, viewportHeight: number): number[] {
  const maximum = Math.max(0, Math.round(documentHeight - viewportHeight));
  if (maximum === 0) return [0];
  return [...new Set(Array.from({ length: MOTION_SAMPLE_COUNT }, (_value, index) =>
    Math.round((maximum * index) / (MOTION_SAMPLE_COUNT - 1)),
  ))];
}

function numberStyle(region: MotionRegion, property: string): number | null {
  const value = Number(region.styles[property]);
  return Number.isFinite(value) ? value : null;
}

function transformValues(value: string | undefined): { scale: number; x: number; y: number } | null {
  if (!value || value === 'none') return { scale: 1, x: 0, y: 0 };
  const match = /^matrix\(([^)]+)\)$/.exec(value);
  if (!match) return null;
  const values = match[1]?.split(',').map((part) => Number(part.trim()));
  if (!values || values.length !== 6 || values.some((part) => !Number.isFinite(part))) return null;
  const [a, b, _c, _d, x, y] = values as [number, number, number, number, number, number];
  return { scale: Math.sqrt((a ** 2) + (b ** 2)), x, y };
}

function targetFor(region: MotionRegion, index: number): string {
  return `${region.tag}${region.role ? `[role=${region.role}]` : ''}#${index + 1}`;
}

function observation(
  profile: string,
  kind: MotionKind,
  target: string,
  from: MotionSample,
  to: MotionSample,
  fromValue: number | string,
  toValue: number | string,
  confidence: MotionObservation['confidence'],
): MotionObservation {
  return {
    profile,
    kind,
    target,
    from: { scrollY: from.scrollY, value: fromValue },
    to: { scrollY: to.scrollY, value: toValue },
    confidence,
  };
}

export function deriveMotionObservations(input: { profile: string; samples: MotionSample[] }): MotionObservation[] {
  const observations: MotionObservation[] = [];
  for (let sampleIndex = 1; sampleIndex < input.samples.length; sampleIndex += 1) {
    const from = input.samples[sampleIndex - 1]!;
    const to = input.samples[sampleIndex]!;
    const fromRegions = from.facts.regions ?? [];
    const toRegions = to.facts.regions ?? [];
    const length = Math.min(fromRegions.length, toRegions.length);
    for (let regionIndex = 0; regionIndex < length; regionIndex += 1) {
      const before = fromRegions[regionIndex]!;
      const after = toRegions[regionIndex]!;
      if (before.tag !== after.tag || before.role !== after.role) continue;
      const target = targetFor(before, regionIndex);
      const opacityBefore = numberStyle(before, 'opacity');
      const opacityAfter = numberStyle(after, 'opacity');
      if (opacityBefore !== null && opacityAfter !== null && Math.abs(opacityAfter - opacityBefore) >= 0.05) {
        observations.push(observation(input.profile, 'reveal', target, from, to, opacityBefore, opacityAfter, 'high'));
      }
      const transformBefore = transformValues(before.styles.transform);
      const transformAfter = transformValues(after.styles.transform);
      if (transformBefore && transformAfter) {
        if (Math.abs(transformAfter.scale - transformBefore.scale) >= 0.015) {
          observations.push(observation(input.profile, 'zoom', target, from, to, transformBefore.scale, transformAfter.scale, 'high'));
        }
        const translated = Math.hypot(transformAfter.x - transformBefore.x, transformAfter.y - transformBefore.y);
        if (translated >= 8) {
          observations.push(observation(input.profile, 'translate', target, from, to, `${transformBefore.x},${transformBefore.y}`, `${transformAfter.x},${transformAfter.y}`, 'high'));
        }
      }
      const sticky = ['sticky', 'fixed'].includes(before.styles.position ?? '') && ['sticky', 'fixed'].includes(after.styles.position ?? '');
      if (sticky && Math.abs(after.box.y - before.box.y) <= 4 && Math.abs(to.scrollY - from.scrollY) >= 100) {
        observations.push(observation(input.profile, 'sticky', target, from, to, before.box.y, after.box.y, 'medium'));
      }
    }
    const fromVideos = from.facts.videos ?? [];
    const toVideos = to.facts.videos ?? [];
    for (let videoIndex = 0; videoIndex < Math.min(fromVideos.length, toVideos.length); videoIndex += 1) {
      const before = fromVideos[videoIndex]!;
      const after = toVideos[videoIndex]!;
      if (Math.abs(after.currentTime - before.currentTime) >= 0.05) {
        observations.push(observation(input.profile, 'video-progress', `video#${videoIndex + 1}`, from, to, before.currentTime, after.currentTime, before.paused && after.paused ? 'high' : 'medium'));
      }
    }
  }
  return observations;
}
