import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'node:path';

const MAX_ASSETS = 500;
const MAX_BYTES = 250 * 1024 * 1024;
const MAX_DEPTH = 4;

export interface CloneJob { consent: { origin: string; permissionMode: string } }
export interface FetchResult { ok: boolean; status: number; body: string | Uint8Array; contentType?: string }
export type CloneFetcher = (url: string) => Promise<FetchResult>;
export interface MirrorAsset { source: string; path: string; bytes: number; sha256: string; status: number }
export interface MirrorManifest { origin: string; targetUrl: string; assets: MirrorAsset[]; failures: Array<{ path: string; status: number }>; }
export interface FullCloneOptions { root: string; artifactDirectory: string; job: CloneJob; targetUrl: string; outputDirectory?: string; fetcher?: CloneFetcher }

const publicUrl = (value: string, base: string) => {
  try { const url = new URL(value, base); return ['http:', 'https:'].includes(url.protocol) ? url : null; } catch { return null; }
};

export function discoverSameOriginAssets(content: string, base: string): string[] {
  const origin = new URL(base).origin;
  const found = new Set<string>();
  const pattern = /(?:src|href)\s*=\s*["']([^"']+)|url\(\s*["']?([^'"\s)]+)|(?:import|from)\s*["']([^"']+)["']/gi;
  for (const match of content.matchAll(pattern)) {
    const raw = match[1] ?? match[2] ?? match[3];
    if (!raw || raw.startsWith('#') || raw.startsWith('data:')) continue;
    const url = publicUrl(raw, base);
    if (!url || url.origin !== origin) continue;
    url.hash = '';
    found.add(url.toString());
  }
  return [...found];
}

export function localAssetPath(source: string): string {
  const url = new URL(source);
  const name = basename(url.pathname).replace(/[^a-zA-Z0-9._-]/g, '_') || 'index';
  const hash = createHash('sha256').update(source).digest('hex').slice(0, 12);
  return join('assets', `${hash}-${name}`);
}

function outputFor(options: FullCloneOptions): string {
  if (!options.outputDirectory) return join(options.artifactDirectory, 'mirror');
  const root = resolve(options.root);
  const output = resolve(root, options.outputDirectory);
  if (relative(root, output).startsWith('..')) throw new Error('Full clone output must stay inside project root.');
  return output;
}

function rewrite(content: string, sourceUrl: string, filePath: string, output: string, mappings: Map<string, string>): string {
  return content.replace(/https?:\/\/[^'"\s)]+|(?:\/(?!\/)|\.\.?\/)[^'"\s)]+/g, (raw) => {
    const resolved = publicUrl(raw, sourceUrl)?.toString();
    const target = resolved ? mappings.get(resolved) : undefined;
    return target ? relative(dirname(filePath), join(output, target)).replace(/\\/g, '/') : raw;
  }).replace(/\s+integrity=["'][^"']+["']/gi, '');
}

const defaultFetcher: CloneFetcher = async (url) => {
  const response = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0', referer: new URL(url).origin } });
  const contentType = response.headers.get('content-type') ?? undefined;
  const body = /(?:text\/|javascript|json|xml)/i.test(contentType ?? '')
    ? await response.text()
    : new Uint8Array(await response.arrayBuffer());
  return { ok: response.ok, status: response.status, body, contentType };
};

export async function cloneAuthorizedSite(options: FullCloneOptions): Promise<{ outputDirectory: string; manifest: MirrorManifest }> {
  if (options.job.consent.permissionMode !== 'owned-or-authorized') throw new Error('Full clone requires owned-or-authorized consent.');
  const target = publicUrl(options.targetUrl, options.job.consent.origin);
  if (!target || target.origin !== options.job.consent.origin) throw new Error('Full clone target is outside recorded consent origin.');
  const outputDirectory = outputFor(options);
  await mkdir(outputDirectory, { recursive: true });
  const fetcher = options.fetcher ?? defaultFetcher;
  const queue: Array<{ url: string; depth: number }> = [{ url: target.toString(), depth: 0 }];
  const seen = new Set<string>();
  const content = new Map<string, { body: string | Uint8Array; status: number; contentType?: string }>();
  const mappings = new Map<string, string>();
  let bytes = 0;
  const failures: MirrorManifest['failures'] = [];
  while (queue.length) {
    const next = queue.shift(); if (!next || seen.has(next.url)) continue;
    if (seen.size >= MAX_ASSETS || next.depth > MAX_DEPTH) break;
    seen.add(next.url);
    const response = await fetcher(next.url);
    if (!response.ok) { failures.push({ path: new URL(next.url).pathname, status: response.status }); continue; }
    const bodyBytes = typeof response.body === 'string' ? Buffer.byteLength(response.body) : response.body.byteLength;
    bytes += bodyBytes; if (bytes > MAX_BYTES) throw new Error('Full clone exceeded byte limit.');
    content.set(next.url, response);
    mappings.set(next.url, next.url === target.toString() ? 'index.html' : localAssetPath(next.url));
    if (typeof response.body === 'string' && /(?:text\/|javascript|json)/i.test(response.contentType ?? '') || typeof response.body === 'string') {
      for (const asset of discoverSameOriginAssets(String(response.body), next.url)) queue.push({ url: asset, depth: next.depth + 1 });
    }
  }
  const assets: MirrorAsset[] = [];
  for (const [url, response] of content) {
    const path = mappings.get(url)!;
    const destination = join(outputDirectory, path);
    await mkdir(dirname(destination), { recursive: true });
    const body = response.body;
    const text = typeof body === 'string' ? rewrite(body, url, destination, outputDirectory, mappings) : body;
    const buffer = typeof text === 'string' ? Buffer.from(text) : Buffer.from(text);
    await writeFile(destination, buffer);
    assets.push({ source: new URL(url).pathname, path, bytes: buffer.length, sha256: createHash('sha256').update(buffer).digest('hex'), status: response.status });
  }
  const manifest: MirrorManifest = { origin: options.job.consent.origin, targetUrl: target.pathname, assets, failures };
  await writeFile(join(outputDirectory, 'mirror-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return { outputDirectory, manifest };
}
