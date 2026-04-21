import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AgentBlueprintClient } from '../client.js';

const mockConfig = {
  apiKey: 'ab_live_test1234567890',
  apiUrl: 'https://test.agentblueprint.ai',
};

describe('AgentBlueprintClient generation methods', () => {
  let client: AgentBlueprintClient;

  beforeEach(() => {
    client = new AgentBlueprintClient(mockConfig);
    vi.restoreAllMocks();
  });

  it('createBusinessProfile posts to the v1 business-profile endpoint and preserves customerOrgId', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: { id: 'profile-1', companyName: 'Acme', isNew: true },
        timestamp: '',
      }),
    }));

    await client.createBusinessProfile({ companyName: 'Acme' }, '11111111-1111-1111-1111-111111111111');

    expect(fetch).toHaveBeenCalledWith(
      'https://test.agentblueprint.ai/api/v1/business-profile?customerOrgId=11111111-1111-1111-1111-111111111111',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ fields: { companyName: 'Acme' } }),
      }),
    );
  });

  it('generateUseCases posts to the new v1 route', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: { useCases: [{ id: 'uc-1' }], generationMetadata: null, debugInfo: null },
        timestamp: '',
      }),
    }));

    await client.generateUseCases({ count: 2, guidanceText: 'Focus on service ops' });

    expect(fetch).toHaveBeenCalledWith(
      'https://test.agentblueprint.ai/api/v1/generate/use-cases',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ count: 2, guidanceText: 'Focus on service ops' }),
      }),
    );
  });

  it('triggerBlueprintGeneration posts to the new v1 route', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { auditId: 'audit-1' }, timestamp: '' }),
    }));

    await client.triggerBlueprintGeneration({ useCaseId: 'uc-1', platform: 'vendor_agnostic' });

    expect(fetch).toHaveBeenCalledWith(
      'https://test.agentblueprint.ai/api/v1/generate/blueprint',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ useCaseId: 'uc-1', platform: 'vendor_agnostic' }),
      }),
    );
  });

  it('getBlueprintGenerationStatus hits the status endpoint and preserves customerOrgId', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: { kind: 'blueprint', auditId: 'audit-1', status: 'completed', blueprintId: 'bp-1' },
        timestamp: '',
      }),
    }));

    await client.getBlueprintGenerationStatus('audit-1', '11111111-1111-1111-1111-111111111111');

    expect(fetch).toHaveBeenCalledWith(
      'https://test.agentblueprint.ai/api/v1/generate/blueprint/status/audit-1?customerOrgId=11111111-1111-1111-1111-111111111111',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('triggerFullPipeline posts to the new v1 route', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { jobId: 'job-1' }, timestamp: '' }),
    }));

    await client.triggerFullPipeline({
      businessProfileId: 'profile-1',
      specialInstructions: 'Bias for customer support',
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://test.agentblueprint.ai/api/v1/generate/full-pipeline',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          businessProfileId: 'profile-1',
          specialInstructions: 'Bias for customer support',
        }),
      }),
    );
  });

  it('getFullPipelineStatus hits the status endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: { kind: 'full_pipeline', jobId: 'job-1', status: 'completed' },
        timestamp: '',
      }),
    }));

    await client.getFullPipelineStatus('job-1');

    expect(fetch).toHaveBeenCalledWith(
      'https://test.agentblueprint.ai/api/v1/generate/full-pipeline/status/job-1',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});
