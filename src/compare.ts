export interface Mask { x: number; y: number; width: number; height: number }

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
