import assert from 'node:assert/strict';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import { analyzeCapturedJob, analyzeDesignFacts, detectFramework, writeDesignBrief } from '../src/analyze.js';
import { withTestDir } from './helpers/test-dir.js';

test('detects supported frameworks with static fallback', () => {
  assert.equal(detectFramework({ dependencies: { next: '15' } }), 'next');
  assert.equal(detectFramework({ devDependencies: { '@sveltejs/kit': '2' } }), 'sveltekit');
  assert.equal(detectFramework({ dependencies: { vue: '3' } }), 'vue');
  assert.equal(detectFramework({}), 'static');
});

test('derives repeated component candidates, tokens, and observed motion only', () => {
  const brief = analyzeDesignFacts({
    framework: 'next',
    profiles: [{
      name: 'desktop',
      regions: [
        { tag: 'section', role: null, styles: { color: 'rgb(1, 2, 3)', fontFamily: 'Inter', gap: '16px' } },
        { tag: 'section', role: null, styles: { color: 'rgb(1, 2, 3)', fontFamily: 'Inter', gap: '16px' } },
      ],
      animations: [{ target: 'section', duration: 240, delay: 0, easing: 'ease-out', iterations: 1 }],
    }],
  });

  assert.deepEqual(brief.components, [{ name: 'Section', occurrences: 2 }]);
  assert.deepEqual(brief.tokens.colors, ['rgb(1, 2, 3)']);
  assert.deepEqual(brief.tokens.fontFamilies, ['Inter']);
  assert.deepEqual(brief.motion, [{ target: 'section', duration: 240, delay: 0, easing: 'ease-out', iterations: 1 }]);
  assert.equal(JSON.stringify(brief).includes('src='), false);
});

test('aggregates sorted deduplicated icon findings from capture profiles', () => {
  const brief = analyzeDesignFacts({
    framework: 'static',
    profiles: [
      {
        name: 'desktop',
        regions: [],
        animations: [],
        icons: [
          { tag: 'i', classTokens: ['fa-solid', 'fa-arrow-right'], attributes: {} },
          { tag: 'svg', classTokens: ['unrelated'], attributes: {} },
        ],
      },
      {
        name: 'mobile',
        regions: [],
        animations: [],
        icons: [
          { tag: 'i', classTokens: ['fa-solid', 'fa-arrow-right'], attributes: {} },
          { tag: 'svg', classTokens: ['lucide-menu'], attributes: {} },
        ],
      },
    ],
  });

  assert.deepEqual(brief.icons, [
    { vendor: 'Font Awesome', iconName: 'arrow-right', confidence: 'high' },
    { vendor: 'Lucide', iconName: 'menu', confidence: 'high' },
    { vendor: 'unknown', iconName: null, confidence: 'low' },
  ]);
});

test('writes rebuild-safe brief, motion spec, and provenance without source URLs', async () => {
  await withTestDir(async (root) => {
    const brief = analyzeDesignFacts({ framework: 'static', profiles: [{ name: 'desktop', regions: [], animations: [] }] });
    await writeDesignBrief(root, brief, { origin: 'https://example.com', permissionMode: 'private-learning' });
    await access(join(root, 'brief.json'));
    await access(join(root, 'motion-spec.json'));
    const provenance = await readFile(join(root, 'provenance.md'), 'utf8');
    assert.match(provenance, /private-learning/);
    assert.equal(provenance.includes('https://example.com/page'), false);
  });
});

test('analyzes persisted derived facts and writes brief artifacts', async () => {
  await withTestDir(async (root) => {
    const artifactDirectory = join(root, '.pi', 'snatch', 'demo');
    await mkdir(join(artifactDirectory, 'desktop'), { recursive: true });
    await writeFile(
      join(artifactDirectory, 'desktop', 'facts.json'),
      JSON.stringify({ regions: [{ tag: 'main', role: null, styles: { color: 'rgb(0, 0, 0)' } }], animations: [] }),
    );
    const brief = await analyzeCapturedJob({
      artifactDirectory,
      projectDirectory: root,
      job: { id: 'demo', consent: { origin: 'https://example.com', permissionMode: 'owned-or-authorized' } },
    });
    assert.equal(brief.framework, 'static');
    await access(join(artifactDirectory, 'output', 'brief.json'));
  });
});
