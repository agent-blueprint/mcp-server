import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { loadConfig } from '../config.js';

describe('loadConfig', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('loads API key from token override', () => {
    const config = loadConfig('ab_live_test123');
    expect(config.apiKey).toBe('ab_live_test123');
    expect(config.apiUrl).toBe('https://app.agentblueprint.ai');
  });

  it('loads API key from environment', () => {
    process.env.AGENT_BLUEPRINT_API_KEY = 'ab_live_envkey';
    const config = loadConfig();
    expect(config.apiKey).toBe('ab_live_envkey');
  });

  it('uses custom API URL from environment', () => {
    process.env.AGENT_BLUEPRINT_API_KEY = 'ab_live_test';
    process.env.AGENT_BLUEPRINT_API_URL = 'http://localhost:3000';
    const config = loadConfig();
    expect(config.apiUrl).toBe('http://localhost:3000');
  });

  it('throws when no API key provided', () => {
    delete process.env.AGENT_BLUEPRINT_API_KEY;
    expect(() => loadConfig()).toThrow('Missing API key');
  });

  it('token override takes precedence over env', () => {
    process.env.AGENT_BLUEPRINT_API_KEY = 'ab_live_env';
    const config = loadConfig('ab_live_override');
    expect(config.apiKey).toBe('ab_live_override');
  });
});
