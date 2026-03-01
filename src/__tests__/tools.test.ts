import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AgentBlueprintClient } from '../client.js';
import { handleListBlueprints } from '../tools/list-blueprints.js';
import { handleGetBlueprint } from '../tools/get-blueprint.js';
import { handleGetBusinessCase } from '../tools/get-business-case.js';
import { handleGetBusinessProfile } from '../tools/get-business-profile.js';

const mockConfig = {
  apiKey: 'ab_live_test',
  apiUrl: 'https://test.agentblueprint.ai',
};

describe('Tool handlers', () => {
  let client: AgentBlueprintClient;

  beforeEach(() => {
    client = new AgentBlueprintClient(mockConfig);
    vi.restoreAllMocks();
  });

  it('handleGetBusinessProfile returns formatted JSON', async () => {
    const data = { id: 'prof-1', companyName: 'Acme Corp', industry: 'Technology' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data, timestamp: '' }),
    }));

    const result = await handleGetBusinessProfile(client);

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(JSON.parse(result.content[0].text)).toEqual(data);
  });

  it('handleGetBusinessProfile returns error on failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: () => Promise.resolve({ error: 'No business profile found' }),
    }));

    const result = await handleGetBusinessProfile(client);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No business profile found');
  });

  it('handleListBlueprints returns formatted JSON', async () => {
    const data = [{ id: 'bp-1', title: 'Test' }];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data, timestamp: '' }),
    }));

    const result = await handleListBlueprints(client);

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(JSON.parse(result.content[0].text)).toEqual(data);
  });

  it('handleListBlueprints returns error on failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: () => Promise.resolve({ error: 'server error' }),
    }));

    const result = await handleListBlueprints(client);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('server error');
  });

  it('handleGetBlueprint passes blueprintId correctly', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { id: 'bp-1', data: {} }, timestamp: '' }),
    }));

    const result = await handleGetBlueprint(client, { blueprintId: 'bp-1' });

    expect(result.content).toHaveLength(1);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.id).toBe('bp-1');
  });

  it('handleGetBusinessCase returns business case data', async () => {
    const bcData = { id: 'bc-1', data: { executiveSummary: 'Test' } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: bcData, timestamp: '' }),
    }));

    const result = await handleGetBusinessCase(client, { blueprintId: 'bp-1' });

    expect(result.content).toHaveLength(1);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.data.executiveSummary).toBe('Test');
  });
});
