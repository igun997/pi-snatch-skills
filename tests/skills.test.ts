import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const skills = ['snatch-website', 'rebuild-components', 'motion-forensics', 'visual-e2e'];
test('ships safe progressive-disclosure skills', async () => {
  for (const skill of skills) {
    const content = await readFile(`skills/${skill}/SKILL.md`, 'utf8');
    assert.match(content, /^---\nname: /);
    assert.match(content, /Use when/);
    assert.ok(content.split('\n').length < 100);
    assert.doesNotMatch(content, /may reuse source/i);
  }
});
