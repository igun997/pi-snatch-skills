import assert from 'node:assert/strict';
import test from 'node:test';

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import snatchDesignExtension from '../extensions/snatch-design.js';

test('registers consent command, status command, capture, and validation tools', () => {
  const commands: string[] = [];
  const tools: string[] = [];
  const api = {
    registerCommand: (name: string) => { commands.push(name); },
    registerTool: (definition: { name: string }) => { tools.push(definition.name); },
    on: () => {},
  } as unknown as ExtensionAPI;

  snatchDesignExtension(api);

  assert.deepEqual(commands, ['snatch', 'snatch-status']);
  assert.deepEqual(tools, ['snatch_status', 'snatch_capture', 'snatch_validate']);
});
