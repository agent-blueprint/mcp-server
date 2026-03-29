import { describe, it, expect, vi } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';

import { parseDownloadArgs } from '../download.js';

const exec = promisify(execFile);
const CLI_PATH = join(import.meta.dirname, '../../dist/cli.js');

describe('parseDownloadArgs', () => {
  it('parses positional blueprint ID', () => {
    const result = parseDownloadArgs(['abc-123']);
    expect(result.blueprintId).toBe('abc-123');
    expect(result.dir).toBe('.agent-blueprint');
  });

  it('parses --org flag', () => {
    const result = parseDownloadArgs(['abc-123', '--org', 'org-456']);
    expect(result.blueprintId).toBe('abc-123');
    expect(result.customerOrgId).toBe('org-456');
  });

  it('parses --blueprint flag alongside --org', () => {
    const result = parseDownloadArgs(['--blueprint', 'bp-789', '--org', 'org-456', '--dir', '/tmp/out']);
    expect(result.blueprintId).toBe('bp-789');
    expect(result.customerOrgId).toBe('org-456');
    expect(result.dir).toBe('/tmp/out');
  });

  it('parses --list flag', () => {
    const result = parseDownloadArgs(['--list']);
    expect(result.list).toBe(true);
    expect(result.blueprintId).toBeUndefined();
  });

  it('--blueprint takes priority over positional', () => {
    const result = parseDownloadArgs(['--blueprint', 'bp-flag', 'bp-positional']);
    expect(result.blueprintId).toBe('bp-flag');
  });

  it('defaults dir to .agent-blueprint', () => {
    const result = parseDownloadArgs([]);
    expect(result.dir).toBe('.agent-blueprint');
    expect(result.list).toBe(false);
  });

  it('parses --no-mcp flag', () => {
    const result = parseDownloadArgs(['abc-123', '--no-mcp']);
    expect(result.noMcp).toBe(true);
  });

  it('noMcp defaults to falsy', () => {
    const result = parseDownloadArgs(['abc-123']);
    expect(result.noMcp).toBeFalsy();
  });

  it('parses --sn-instance, --sn-user, --sn-pass flags', () => {
    const result = parseDownloadArgs([
      'abc-123', '--platform', 'servicenow',
      '--sn-instance', 'dev99', '--sn-user', 'admin', '--sn-pass', 'secret',
    ]);
    expect(result.snInstance).toBe('dev99');
    expect(result.snUser).toBe('admin');
    expect(result.snPass).toBe('secret');
  });

  it('sn credential flags default to undefined', () => {
    const result = parseDownloadArgs(['abc-123']);
    expect(result.snInstance).toBeUndefined();
    expect(result.snUser).toBeUndefined();
    expect(result.snPass).toBeUndefined();
  });
});

describe('CLI binary', () => {
  it('shows help with --help', async () => {
    const { stderr } = await exec('node', [CLI_PATH, '--help']);
    expect(stderr).toContain('Agent Blueprint CLI');
    expect(stderr).toContain('agentblueprint login');
    expect(stderr).toContain('agentblueprint list');
    expect(stderr).toContain('agentblueprint get');
    expect(stderr).toContain('agentblueprint download');
  });

  it('shows version with --version', async () => {
    const { stdout } = await exec('node', [CLI_PATH, '--version']);
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('starts MCP server with no arguments on piped stdin (non-TTY)', async () => {
    // When stdin is piped (as in execFile), no-args triggers MCP mode.
    // Without a token, it errors with missing API key.
    try {
      await exec('node', [CLI_PATH], {
        env: { ...process.env, AGENT_BLUEPRINT_API_KEY: '', HOME: '/tmp/nonexistent-cli-test' },
      });
      expect.fail('should have exited with error');
    } catch (err: unknown) {
      const error = err as { stderr: string; code: number };
      expect(error.stderr).toContain('Missing API key');
    }
  });

  it('errors on unknown command', async () => {
    try {
      await exec('node', [CLI_PATH, 'foobar']);
      expect.fail('should have exited with error');
    } catch (err: unknown) {
      const error = err as { stderr: string; code: number };
      expect(error.stderr).toContain('Unknown command');
      expect(error.code).toBe(1);
    }
  });

  it('errors on get without type', async () => {
    try {
      await exec('node', [CLI_PATH, 'get']);
      expect.fail('should have exited with error');
    } catch (err: unknown) {
      const error = err as { stderr: string; code: number };
      expect(error.stderr).toContain('Missing artifact type');
    }
  });

  it('errors on get with unknown type', async () => {
    try {
      await exec('node', [CLI_PATH, 'get', 'foobar', 'some-id', '--token', 'ab_live_fake']);
      expect.fail('should have exited with error');
    } catch (err: unknown) {
      const error = err as { stderr: string; code: number };
      expect(error.stderr).toContain('Unknown type');
    }
  });

  it('errors on get blueprint without ID', async () => {
    try {
      await exec('node', [CLI_PATH, 'get', 'blueprint', '--token', 'ab_live_fake']);
      expect.fail('should have exited with error');
    } catch (err: unknown) {
      const error = err as { stderr: string; code: number };
      expect(error.stderr).toContain('Missing blueprint ID');
    }
  });

  it('errors on get implementation-spec without ID', async () => {
    try {
      await exec('node', [CLI_PATH, 'get', 'implementation-spec', '--token', 'ab_live_fake']);
      expect.fail('should have exited with error');
    } catch (err: unknown) {
      const error = err as { stderr: string; code: number };
      expect(error.stderr).toContain('Missing blueprint ID');
    }
  });

  it('errors on list without token', async () => {
    try {
      await exec('node', [CLI_PATH, 'list'], {
        env: { ...process.env, AGENT_BLUEPRINT_API_KEY: '', HOME: '/tmp/nonexistent-cli-test' },
      });
      expect.fail('should have exited with error');
    } catch (err: unknown) {
      const error = err as { stderr: string; code: number };
      expect(error.stderr).toContain('Missing API key');
    }
  });

  it('help includes implementation-spec and serve', async () => {
    const { stderr } = await exec('node', [CLI_PATH, '--help']);
    expect(stderr).toContain('implementation-spec');
    expect(stderr).toContain('When stdin is piped');
  });
});
