import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

const cloneDirectory = join(process.cwd(), 'examples', 'javapixa-clone');

test('ships self-contained responsive static reference rebuild', async () => {
  const [html, css, script, readme] = await Promise.all([
    readFile(join(cloneDirectory, 'index.html'), 'utf8'),
    readFile(join(cloneDirectory, 'styles.css'), 'utf8'),
    readFile(join(cloneDirectory, 'app.js'), 'utf8'),
    readFile(join(cloneDirectory, 'README.md'), 'utf8'),
  ]);

  assert.match(html, /<main/);
  assert.match(html, /data-menu-toggle/);
  assert.match(css, /@media \(max-width: 720px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(script, /menuToggle/);
  assert.match(readme, /No target source code, assets, or copied copy/);
  assert.doesNotMatch(`${html}\n${css}\n${script}`, /https?:\/\//);
  assert.doesNotMatch(`${html}\n${css}\n${script}`, /javapixa/i);
});
