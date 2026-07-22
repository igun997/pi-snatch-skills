import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { PNG } from 'pngjs';

export const TILE_OVERLAP_CSS_PX = 200;
export const MAX_PRIMARY_DIMENSION = 30_000;
export const MAX_SECONDARY_DIMENSION = 8_000;
export const MAX_AREA = MAX_PRIMARY_DIMENSION * MAX_SECONDARY_DIMENSION;

export interface VerticalTilePlanOptions {
  documentHeight: number;
  viewportHeight: number;
  overlap?: number;
}

export interface OutputDimensionOptions {
  documentWidth: number;
  documentHeight: number;
  viewportCssWidth: number;
  tilePixelWidth: number;
}

export interface OutputDimensions {
  width: number;
  height: number;
  scale: number;
}

export interface ScreenshotTile {
  path: string;
  /** Document-relative CSS-pixel y-coordinate reported after scroll. */
  y: number;
}

export interface StitchTilesOptions {
  documentWidth: number;
  documentHeight: number;
  viewportCssWidth: number;
  tiles: ScreenshotTile[];
  outputDirectory: string;
}

interface OutputSegment {
  path: string;
  top: number;
  width: number;
  height: number;
}

export function planVerticalTiles(options: VerticalTilePlanOptions): number[] {
  const documentHeight = Math.max(0, Math.ceil(options.documentHeight));
  const viewportHeight = Math.max(1, Math.ceil(options.viewportHeight));
  const overlap = Math.min(Math.max(0, options.overlap ?? TILE_OVERLAP_CSS_PX), viewportHeight - 1);
  const stride = viewportHeight - overlap;
  const bottom = Math.max(0, documentHeight - viewportHeight);
  const positions: number[] = [];

  for (let y = bottom; y > 0; y -= stride) positions.push(y);
  positions.push(0);
  return [...new Set(positions)];
}

export function outputDimensions(options: OutputDimensionOptions): OutputDimensions {
  if (options.viewportCssWidth <= 0 || options.tilePixelWidth <= 0) {
    throw new Error('Viewport and tile widths must be positive.');
  }
  const scale = options.tilePixelWidth / options.viewportCssWidth;
  return {
    scale,
    width: Math.round(options.documentWidth * scale),
    height: Math.round(options.documentHeight * scale),
  };
}

function outputSegments(width: number, height: number, outputDirectory: string): OutputSegment[] {
  const requiresSplit = height > MAX_PRIMARY_DIMENSION || width > MAX_PRIMARY_DIMENSION || width * height > MAX_AREA;
  const maxWidth = requiresSplit ? (width > height ? MAX_PRIMARY_DIMENSION : MAX_SECONDARY_DIMENSION) : width;
  const maxHeight = requiresSplit ? (width > height ? MAX_SECONDARY_DIMENSION : MAX_PRIMARY_DIMENSION) : height;
  const segments: OutputSegment[] = [];
  const rows = Math.ceil(height / maxHeight);
  const columns = Math.ceil(width / maxWidth);

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if (column !== 0) throw new Error('Horizontal full-page splitting is not supported.');
      const segmentHeight = Math.min(maxHeight, height - row * maxHeight);
      const segmentWidth = Math.min(maxWidth, width - column * maxWidth);
      const suffix = rows * columns === 1 ? '' : `-${segments.length + 1}`;
      segments.push({
        path: join(outputDirectory, `full-page${suffix}.png`),
        top: row * maxHeight,
        width: segmentWidth,
        height: segmentHeight,
      });
    }
  }
  return segments;
}

function blitIntersecting(source: PNG, target: PNG, sourceTop: number, segmentTop: number): void {
  const sourceBottom = sourceTop + source.height;
  const segmentBottom = segmentTop + target.height;
  const top = Math.max(sourceTop, segmentTop);
  const bottom = Math.min(sourceBottom, segmentBottom);
  if (bottom <= top) return;

  PNG.bitblt(
    source,
    target,
    0,
    top - sourceTop,
    Math.min(source.width, target.width),
    bottom - top,
    0,
    top - segmentTop,
  );
}

export async function stitchTiles(options: StitchTilesOptions): Promise<string[]> {
  if (options.tiles.length === 0) throw new Error('At least one screenshot tile is required.');
  await mkdir(options.outputDirectory, { recursive: true });

  const firstTile = PNG.sync.read(await readFile(options.tiles[0]!.path));
  const dimensions = outputDimensions({
    documentWidth: options.documentWidth,
    documentHeight: options.documentHeight,
    viewportCssWidth: options.viewportCssWidth,
    tilePixelWidth: firstTile.width,
  });
  const segments = outputSegments(dimensions.width, dimensions.height, options.outputDirectory);
  const images = await Promise.all(options.tiles.map(async (tile) => ({
    tile,
    image: PNG.sync.read(await readFile(tile.path)),
  })));

  await Promise.all(segments.map(async (segment) => {
    const output = new PNG({ width: segment.width, height: segment.height });
    for (const { tile, image } of images) {
      blitIntersecting(image, output, Math.round(tile.y * dimensions.scale), segment.top);
    }
    await writeFile(segment.path, PNG.sync.write(output));
  }));

  return segments.map((segment) => segment.path);
}
