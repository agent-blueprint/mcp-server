import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseSetupArgs } from '../setup.js';

describe('parseSetupArgs', () => {
  it('parses --token flag', () => {
    const result = parseSetupArgs(['--token', 'ab_live_xxx']);
    expect(result.token).toBe('ab_live_xxx');
  });

  it('parses --api-url flag', () => {
    const result = parseSetupArgs(['--api-url', 'https://custom.api']);
    expect(result.apiUrl).toBe('https://custom.api');
  });

  it('parses --token-only flag', () => {
    const result = parseSetupArgs(['--token', 'x', '--token-only']);
    expect(result.tokenOnly).toBe(true);
  });

  it('parses all ServiceNow flags', () => {
    const result = parseSetupArgs([
      '--token', 'abc',
      '--sn-instance', 'ven07944',
      '--sn-user', 'admin',
      '--sn-pass', 'secret',
    ]);
    expect(result.snInstance).toBe('ven07944');
    expect(result.snUser).toBe('admin');
    expect(result.snPass).toBe('secret');
  });

  it('returns empty object for no args', () => {
    const result = parseSetupArgs([]);
    expect(result.token).toBeUndefined();
    expect(result.snInstance).toBeUndefined();
    expect(result.tokenOnly).toBeUndefined();
  });
});

describe('isServiceNowConfigured', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns true when SN_INSTANCE and SN_PASS are set', async () => {
    process.env.SN_INSTANCE = 'ven07944';
    process.env.SN_PASS = 'secret';

    const { isServiceNowConfigured } = await import('../mcp-setup.js');
    expect(await isServiceNowConfigured()).toBe(true);
  });

  it('returns false when SN_INSTANCE is missing', async () => {
    delete process.env.SN_INSTANCE;
    delete process.env.SN_PASS;

    // Mock the execFile to simulate npm root -g failing (no config file)
    vi.mock('node:child_process', () => ({
      execFile: vi.fn(),
    }));
    vi.mock('node:util', () => ({
      promisify: () => vi.fn().mockRejectedValue(new Error('not found')),
    }));

    const { isServiceNowConfigured } = await import('../mcp-setup.js');
    expect(await isServiceNowConfigured()).toBe(false);
  });
});
