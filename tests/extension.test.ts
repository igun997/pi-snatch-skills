import assert from 'node:assert/strict';
import test from 'node:test';

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import snatchDesignExtension, { buildRebuildContinuation } from '../extensions/snatch-design.js';
import { withTestDir } from './helpers/test-dir.js';

test('registers consent command, status command, capture, validation, and full-clone tools', () => {
  const commands: string[] = [];
  const tools: string[] = [];
  const renderers: string[] = [];
  const api = {
    registerCommand: (name: string) => { commands.push(name); },
    registerTool: (definition: { name: string }) => { tools.push(definition.name); },
    registerEntryRenderer: (name: string) => { renderers.push(name); },
    on: () => {},
  } as unknown as ExtensionAPI;

  snatchDesignExtension(api);

  assert.deepEqual(commands, ['snatch', 'snatch-status', 'snatch-full-clone']);
  assert.deepEqual(tools, ['snatch_status', 'snatch_capture', 'snatch_full_clone', 'snatch_validate']);
  assert.deepEqual(renderers, ['snatch-progress']);
});

test('build continuation requires screenshot-led visual design QA', () => {
  const prompt = buildRebuildContinuation('.pi/snatch/job/output/brief.json');
  assert.match(prompt, /screenshots/i);
  assert.match(prompt, /PRODUCT\.md/);
  assert.match(prompt, /DESIGN\.md/);
  assert.match(prompt, /desktop.*mobile/i);
  assert.match(prompt, /visual QA/i);
});

test('/snatch asks what to do after recording consent', async () => {
  await withTestDir(async (cwd) => {
    const handlers = new Map<string, (args: string, ctx: any) => Promise<void>>();
    const api = {
      registerCommand: (name: string, definition: { handler: (args: string, ctx: any) => Promise<void> }) => handlers.set(name, definition.handler),
      registerTool: () => {}, registerEntryRenderer: () => {}, on: () => {},
    } as unknown as ExtensionAPI;
    snatchDesignExtension(api);
    const prompts: string[] = [];
    await handlers.get('snatch')?.('https://example.com', {
      cwd, hasUI: true,
      ui: {
        select: async (prompt: string) => { prompts.push(prompt); return prompts.length === 1 ? 'owned-or-authorized' : undefined; },
        confirm: async () => true,
        notify: () => {},
      },
    });
    assert.deepEqual(prompts, ['Permission mode:', 'Action after consent:']);
  });
});
