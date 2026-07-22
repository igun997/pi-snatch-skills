import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AgentBrowserClient,
  AgentBrowserCommandError,
  type CommandRunner,
  type RunnerCall,
} from '../src/agent-browser.js';

function createRunner(overrides: Partial<Record<string, string>> = {}): {
  runner: CommandRunner;
  calls: RunnerCall[];
} {
  const calls: RunnerCall[] = [];
  return {
    calls,
    runner: async (call) => {
      calls.push(call);
      const command = call.args.filter((arg) => arg !== '--session' && arg !== 'snatch-job').join(' ');
      return {
        exitCode: 0,
        stdout: overrides[command] ?? (command === 'get url' ? 'https://example.com/final' : '{}'),
        stderr: '',
      };
    },
  };
}

test('loads current agent-browser core guide before opening a public URL', async () => {
  const { runner, calls } = createRunner();
  const client = new AgentBrowserClient({
    jobId: 'job',
    runner,
    lookup: async () => [{ address: '93.184.216.34', family: 4 }],
  });

  await client.open('https://example.com/page');

  const commands = calls.map((call) => call.args.filter((arg) => arg !== '--session' && arg !== 'snatch-job').join(' '));
  assert.deepEqual(commands, ['skills get core --full', 'open https://example.com/page', 'get url']);
});

test('passes multiline browser introspection through stdin and parses JSON', async () => {
  const { runner, calls } = createRunner({ 'eval --stdin': '{"regions":[]}' });
  const client = new AgentBrowserClient({
    jobId: 'job',
    runner,
    lookup: async () => [{ address: '93.184.216.34', family: 4 }],
  });

  const result = await client.evalJson<{ regions: unknown[] }>('const x = 1;\nJSON.stringify({ regions: [] });');

  assert.deepEqual(result, { regions: [] });
  const evalCall = calls.at(-1);
  assert.deepEqual(evalCall?.args, ['--session', 'snatch-job', 'eval', '--stdin']);
  assert.match(evalCall?.stdin ?? '', /const x = 1/);
});

test('rejects DNS names that resolve to private addresses before browser open', async () => {
  const { runner, calls } = createRunner();
  const client = new AgentBrowserClient({
    jobId: 'job',
    runner,
    lookup: async () => [{ address: '10.0.0.2', family: 4 }],
  });

  await assert.rejects(client.open('https://example.com/page'), /non-public address/i);
  assert.equal(calls.some((call) => call.args.includes('open')), false);
});

test('rejects unsafe redirect targets before returning from open', async () => {
  const { runner } = createRunner({ 'get url': 'http://127.0.0.1/private' });
  const client = new AgentBrowserClient({
    jobId: 'job',
    runner,
    lookup: async () => [{ address: '93.184.216.34', family: 4 }],
  });

  await assert.rejects(client.open('https://example.com/page'), /public host/i);
});

test('closes an opened browser session when page work throws', async () => {
  const { runner, calls } = createRunner();
  const client = new AgentBrowserClient({
    jobId: 'job',
    runner,
    lookup: async () => [{ address: '93.184.216.34', family: 4 }],
  });

  await assert.rejects(
    client.withOpenPage('https://example.com/page', async () => {
      throw new Error('capture failed');
    }),
    /capture failed/,
  );

  assert.equal(calls.at(-1)?.args.at(-1), 'close');
});

test('surfaces close failures after successful page work', async () => {
  const runner: CommandRunner = async (call) => ({
    exitCode: call.args.at(-1) === 'close' ? 1 : 0,
    stdout: call.args.at(-2) === 'get' ? 'https://example.com/final' : '{}',
    stderr: '',
  });
  const client = new AgentBrowserClient({
    jobId: 'job',
    runner,
    lookup: async () => [{ address: '93.184.216.34', family: 4 }],
  });

  await assert.rejects(
    client.withOpenPage('https://example.com/page', async () => 'complete'),
    AgentBrowserCommandError,
  );
});

test('forwards supplied abort signals to agent-browser commands', async () => {
  const { runner, calls } = createRunner();
  const controller = new AbortController();
  const client = new AgentBrowserClient({
    jobId: 'job',
    runner,
    signal: controller.signal,
    lookup: async () => [{ address: '93.184.216.34', family: 4 }],
  });

  await client.loadCoreGuide();

  assert.equal(calls[0]?.signal, controller.signal);
});

test('redacts credential-like output from command errors', async () => {
  const runner: CommandRunner = async () => ({
    exitCode: 1,
    stdout: 'access_token=super-secret',
    stderr: 'Authorization: Bearer super-secret',
  });
  const client = new AgentBrowserClient({
    jobId: 'job',
    runner,
    lookup: async () => [{ address: '93.184.216.34', family: 4 }],
  });

  await assert.rejects(
    client.loadCoreGuide(),
    (error: unknown) => {
      assert.ok(error instanceof AgentBrowserCommandError);
      assert.doesNotMatch(error.message, /super-secret/);
      return true;
    },
  );
});
