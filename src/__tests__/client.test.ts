import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AgentBlueprintClient } from '../client.js';
import { ApiError } from '../errors.js';

const mockConfig = {
  apiKey: 'ab_live_test1234567890',
  apiUrl: 'https://test.agentblueprint.ai',
};

describe('AgentBlueprintClient', () => {
  let client: AgentBlueprintClient;

  beforeEach(() => {
    client = new AgentBlueprintClient(mockConfig);
    vi.restoreAllMocks();
  });

  it('listBlueprints sends correct request', async () => {
    const mockData = [
      { id: 'bp-1', title: 'Test BP', version: 1, platform: 'general', agentCount: 2 },
    ];

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: mockData, timestamp: new Date().toISOString() }),
    }));

    const result = await client.listBlueprints();

    expect(result).toEqual(mockData);
    expect(fetch).toHaveBeenCalledWith(
      'https://test.agentblueprint.ai/api/v1/blueprints',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'Bearer ab_live_test1234567890',
        }),
      })
    );
  });

  it('getBlueprint encodes ID in URL', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { id: 'bp-1' }, timestamp: '' }),
    }));

    await client.getBlueprint('bp-1');

    expect(fetch).toHaveBeenCalledWith(
      'https://test.agentblueprint.ai/api/v1/blueprints/bp-1',
      expect.anything()
    );
  });

  it('throws ApiError on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: () => Promise.resolve({ error: 'Invalid token' }),
    }));

    await expect(client.listBlueprints()).rejects.toThrow(ApiError);
    await expect(client.listBlueprints()).rejects.toThrow('Invalid token');
  });

  it('getBusinessCase calls correct endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { id: 'bc-1' }, timestamp: '' }),
    }));

    await client.getBusinessCase('bp-1');

    expect(fetch).toHaveBeenCalledWith(
      'https://test.agentblueprint.ai/api/v1/blueprints/bp-1/business-case',
      expect.anything()
    );
  });

  it('getImplementationPlan calls correct endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { id: 'ip-1' }, timestamp: '' }),
    }));

    await client.getImplementationPlan('bp-1');

    expect(fetch).toHaveBeenCalledWith(
      'https://test.agentblueprint.ai/api/v1/blueprints/bp-1/implementation-plan',
      expect.anything()
    );
  });

  it('getUseCase calls correct endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { id: 'uc-1' }, timestamp: '' }),
    }));

    await client.getUseCase('bp-1');

    expect(fetch).toHaveBeenCalledWith(
      'https://test.agentblueprint.ai/api/v1/blueprints/bp-1/use-case',
      expect.anything()
    );
  });

  it('getImplementationSpec calls correct endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: { blueprintId: 'bp-1', filename: 'test.zip', metadata: {} },
        timestamp: '',
      }),
    }));

    await client.getImplementationSpec('bp-1');

    expect(fetch).toHaveBeenCalledWith(
      'https://test.agentblueprint.ai/api/v1/blueprints/bp-1/implementation-spec',
      expect.anything()
    );
  });
});
