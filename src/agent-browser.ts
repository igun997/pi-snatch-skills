import { spawn } from 'node:child_process';
import { lookup as dnsLookup } from 'node:dns/promises';
import { mkdir, writeFile } from 'node:fs/promises';
import { isIP } from 'node:net';
import { join } from 'node:path';

import { isPublicHost, normalizePublicUrl } from './jobs.js';

const MAX_RESULT_CHARS = 12_000;
const SECRET_PATTERNS = [
  /((?:access[_-]?token|api[_-]?key|password|secret|token)\s*[=:]\s*)([^&\s"']+)/gi,
  /(authorization\s*:\s*bearer\s+)(\S+)/gi,
];

export interface RunnerCall {
  executable: string;
  args: string[];
  stdin?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export type CommandRunner = (call: RunnerCall) => Promise<CommandResult>;
export type HostLookup = (
  hostname: string,
  options: { all: true; verbatim: true },
) => Promise<Array<{ address: string; family: number }>>;

export class AgentBrowserCommandError extends Error {
  constructor(
    readonly command: string,
    readonly exitCode: number,
    readonly diagnosticPath?: string,
  ) {
    super(
      `agent-browser command failed (${command}, exit ${exitCode})${
        diagnosticPath ? `; diagnostics: ${diagnosticPath}` : ''
      }`,
    );
  }
}

export interface AgentBrowserClientOptions {
  jobId: string;
  runner?: CommandRunner;
  lookup?: HostLookup;
  executable?: string;
  artifactDirectory?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

function redact(value: string): string {
  const credentialRedacted = SECRET_PATTERNS.reduce(
    (result, pattern) => result.replace(pattern, '$1[REDACTED]'),
    value,
  );
  return credentialRedacted.replace(/([?&][^=&\s]+)=([^&#\s]+)/g, '$1=[REDACTED]');
}

function compact(value: string): string {
  const safe = redact(value);
  return safe.length > MAX_RESULT_CHARS ? `${safe.slice(0, MAX_RESULT_CHARS)}\n[truncated]` : safe;
}

async function defaultRunner(call: RunnerCall): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(call.executable, call.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      signal: call.signal,
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const timeout = call.timeoutMs
      ? setTimeout(() => child.kill('SIGTERM'), call.timeoutMs)
      : undefined;

    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    child.once('error', reject);
    child.once('close', (code) => {
      if (timeout) clearTimeout(timeout);
      resolve({
        exitCode: code ?? 1,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      });
    });
    if (call.stdin) child.stdin.end(call.stdin);
    else child.stdin.end();
  });
}

export class AgentBrowserClient {
  private readonly executable: string;
  private readonly runner: CommandRunner;
  private readonly lookup: HostLookup;
  private readonly session: string;
  private readonly artifactDirectory?: string;
  private readonly timeoutMs?: number;
  private readonly signal?: AbortSignal;
  private coreGuideLoaded = false;
  private commandCount = 0;

  constructor(options: AgentBrowserClientOptions) {
    this.executable = options.executable ?? 'agent-browser';
    this.runner = options.runner ?? defaultRunner;
    this.lookup = options.lookup ?? ((hostname, lookupOptions) =>
      dnsLookup(hostname, lookupOptions) as Promise<Array<{ address: string; family: number }>>);
    this.session = `snatch-${options.jobId}`;
    this.artifactDirectory = options.artifactDirectory;
    this.timeoutMs = options.timeoutMs;
    this.signal = options.signal;
  }

  async loadCoreGuide(): Promise<void> {
    if (this.coreGuideLoaded) return;
    await this.run(['skills', 'get', 'core', '--full']);
    this.coreGuideLoaded = true;
  }

  async open(targetUrl: string): Promise<string> {
    const normalizedUrl = await this.assertResolvedPublicUrl(targetUrl);
    await this.loadCoreGuide();
    await this.run(['open', normalizedUrl]);
    const finalUrl = (await this.run(['get', 'url'])).stdout.trim();
    return this.assertResolvedPublicUrl(finalUrl);
  }

  async withOpenPage<T>(targetUrl: string, action: (client: this) => Promise<T>): Promise<T> {
    await this.open(targetUrl);
    let actionCompleted = false;
    try {
      const result = await action(this);
      actionCompleted = true;
      return result;
    } finally {
      try {
        await this.close();
      } catch (error) {
        if (actionCompleted) throw error;
        // Preserve page-work failure. Callers receive diagnostics from the primary command.
      }
    }
  }

  async setDevice(name: string): Promise<void> {
    await this.run(['set', 'device', name]);
  }

  async setViewport(width: number, height: number, deviceScaleFactor?: number): Promise<void> {
    const args = ['set', 'viewport', String(width), String(height)];
    if (deviceScaleFactor) args.push(String(deviceScaleFactor));
    await this.run(args);
  }

  async setReducedMotion(): Promise<void> {
    await this.run(['set', 'media', 'light', 'reduced-motion']);
  }

  async reload(): Promise<void> {
    await this.run(['reload']);
  }

  async waitForIdle(): Promise<void> {
    await this.run(['wait', '--load', 'networkidle']);
  }

  async screenshot(path: string, fullPage = false): Promise<void> {
    await this.run(['screenshot', ...(fullPage ? ['--full'] : []), path]);
  }

  async snapshot(interactive = false): Promise<string> {
    return (await this.run(['snapshot', ...(interactive ? ['-i'] : [])])).stdout;
  }

  async evalJson<T>(script: string): Promise<T> {
    const result = await this.run(['eval', '--stdin'], script, true);
    try {
      const value = JSON.parse(result.stdout) as unknown;
      return (typeof value === 'string' ? JSON.parse(value) : value) as T;
    } catch {
      throw new Error('agent-browser eval did not return valid JSON.');
    }
  }

  async errors(): Promise<string> {
    return (await this.run(['errors'])).stdout;
  }

  async console(): Promise<string> {
    return (await this.run(['console'])).stdout;
  }

  async networkRequests(): Promise<string> {
    return (await this.run(['network', 'requests'])).stdout;
  }

  async close(): Promise<void> {
    await this.run(['close']);
  }

  private async assertResolvedPublicUrl(value: string): Promise<string> {
    const normalizedUrl = normalizePublicUrl(value);
    const hostname = new URL(normalizedUrl).hostname.replace(/^\[|\]$/g, '');
    if (isIP(hostname)) return normalizedUrl;

    let addresses: Array<{ address: string; family: number }>;
    try {
      addresses = await this.lookup(hostname, { all: true, verbatim: true });
    } catch {
      throw new Error(`Could not resolve public host: ${hostname}`);
    }
    if (addresses.length === 0 || addresses.some(({ address }) => !isPublicHost(address))) {
      throw new Error(`Host resolves to a non-public address: ${hostname}`);
    }
    return normalizedUrl;
  }

  private async run(args: string[], stdin?: string, preserveStdout = false): Promise<{ stdout: string; stderr: string }> {
    const call: RunnerCall = {
      executable: this.executable,
      args: ['--session', this.session, ...args],
      stdin,
      signal: this.signal,
      timeoutMs: this.timeoutMs,
    };
    const result = await this.runner(call);
    const command = redact(args.join(' '));
    const diagnosticPath = await this.writeDiagnostic(command, result);
    if (result.exitCode !== 0) {
      throw new AgentBrowserCommandError(command, result.exitCode, diagnosticPath);
    }
    return { stdout: preserveStdout ? result.stdout : compact(result.stdout), stderr: compact(result.stderr) };
  }

  private async writeDiagnostic(command: string, result: CommandResult): Promise<string | undefined> {
    if (!this.artifactDirectory) return undefined;
    await mkdir(this.artifactDirectory, { recursive: true });
    const prefix = `${String(++this.commandCount).padStart(3, '0')}-${command.replace(/[^a-z0-9]+/gi, '-')}`;
    const path = join(this.artifactDirectory, `${prefix}.log`);
    await writeFile(
      path,
      `command: ${command}\nexitCode: ${result.exitCode}\n\nstdout:\n${compact(result.stdout)}\n\nstderr:\n${compact(result.stderr)}\n`,
      'utf8',
    );
    return path;
  }
}
