import assert from 'node:assert/strict';
import test from 'node:test';

import { detectIconCandidates } from '../src/icon-vendors.js';

test('detects supported icon vendors from safe metadata', () => {
  const icons = detectIconCandidates([
    { tag: 'i', classTokens: ['fa-solid', 'fa-arrow-right'], attributes: {} },
    { tag: 'span', classTokens: ['material-symbols-rounded'], attributes: { text: 'menu' } },
    { tag: 'svg', classTokens: ['lucide', 'lucide-search'], attributes: { 'data-lucide': 'search' } },
    { tag: 'svg', classTokens: ['heroicon-outline-home'], attributes: {} },
    { tag: 'i', classTokens: ['bi', 'bi-search'], attributes: {} },
    { tag: 'i', classTokens: ['ti', 'ti-brand-github'], attributes: {} },
  ]);

  assert.deepEqual(icons, [
    { vendor: 'Bootstrap Icons', iconName: 'search', confidence: 'high' },
    { vendor: 'Font Awesome', iconName: 'arrow-right', confidence: 'high' },
    { vendor: 'Heroicons', iconName: 'home', confidence: 'high' },
    { vendor: 'Lucide', iconName: 'search', confidence: 'high' },
    { vendor: 'Material Symbols', iconName: 'menu', confidence: 'high' },
    { vendor: 'Tabler Icons', iconName: 'brand-github', confidence: 'high' },
  ]);
});

test('deduplicates icon detections and leaves generic SVGs unknown', () => {
  const icons = detectIconCandidates([
    { tag: 'svg', classTokens: ['lucide-search'], attributes: {} },
    { tag: 'svg', classTokens: ['lucide-search'], attributes: {} },
    { tag: 'svg', classTokens: ['unrelated'], attributes: {} },
    { tag: 'span', classTokens: ['font-awesome-looking'], attributes: {} },
  ]);

  assert.deepEqual(icons, [
    { vendor: 'Lucide', iconName: 'search', confidence: 'high' },
    { vendor: 'unknown', iconName: null, confidence: 'low' },
  ]);
});
