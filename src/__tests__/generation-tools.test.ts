import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AgentBlueprintClient } from '../client.js';
import { handleCreateBusinessProfile } from '../tools/create-business-profile.js';
import { handleGenerateUseCases } from '../tools/generate-use-cases.js';
import { handleGenerateBlueprint } from '../tools/generate-blueprint.js';
import { handleTriggerFullPipeline } from '../tools/trigger-full-pipeline.js';
import { handleGetGenerationStatus } from '../tools/get-generation-status.js';

const mockConfig = {
  apiKey: 'ab_live_test',
  apiUrl: 'https://test.agentblueprint.ai',
};

describe('Generation tool handlers', () => {
  let client: AgentBlueprintClient;

  beforeEach(() => {
    client = new AgentBlueprintClient(mockConfig);
    vi.restoreAllMocks();
  });

  it('handleCreateBusinessProfile formats create-or-upsert results', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          id: 'profile-1',
          companyName: 'Acme Health',
          isNew: true,
          aiReadinessScore: 58,
        },
        timestamp: '',
      }),
    }));

    const result = await handleCreateBusinessProfile(client, { fields: { companyName: 'Acme Health' } });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('Business profile created.');
    expect(result.content[0].text).toContain('profile-1');
  });

  it('handleGenerateUseCases returns JSON with a count and next-step hint', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          useCases: [
            { id: 'uc-1', title: 'AI Triage' },
            { id: 'uc-2', title: 'AI Summaries' },
          ],
          generationMetadata: null,
          debugInfo: null,
        },
        timestamp: '',
      }),
    }));

    const result = await handleGenerateUseCases(client, { count: 2 });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.useCaseCount).toBe(2);
    expect(parsed.hint).toContain('generate_blueprint');
  });

  it('handleGenerateBlueprint returns the auditId and polling instruction', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { auditId: 'audit-1' }, timestamp: '' }),
    }));

    const result = await handleGenerateBlueprint(client, { useCaseId: 'uc-1' });

    expect(result.content[0].text).toContain('Blueprint generation started.');
    expect(result.content[0].text).toContain('audit-1');
  });

  it('handleTriggerFullPipeline returns the jobId and polling instruction', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { jobId: 'job-1' }, timestamp: '' }),
    }));

    const result = await handleTriggerFullPipeline(client, { businessProfileId: 'profile-1' });

    expect(result.content[0].text).toContain('Full pipeline started.');
    expect(result.content[0].text).toContain('job-1');
  });

  it('handleGetGenerationStatus normalizes blueprint polling responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          kind: 'blueprint',
          auditId: 'audit-1',
          status: 'completed',
          blueprintId: 'bp-1',
          progressPercent: 100,
          stage: 'done',
          stageLabel: 'Done',
          error: null,
          entityRoute: '/blueprints/bp-1',
          entityTitle: 'Blueprint',
          updatedAt: '2026-04-21T00:00:00.000Z',
          completedAt: '2026-04-21T00:00:00.000Z',
        },
        timestamp: '',
      }),
    }));

    const result = await handleGetGenerationStatus(client, { auditId: 'audit-1' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.kind).toBe('blueprint');
    expect(parsed.hint).toContain('download_blueprint');
  });

  it('handleGetGenerationStatus normalizes full-pipeline polling responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          kind: 'full_pipeline',
          jobId: 'job-1',
          status: 'completed',
          generatedArtifactIds: {
            readinessId: 'read-1',
            useCaseIds: ['uc-1'],
            selectedUseCaseId: 'uc-1',
            blueprintId: 'bp-1',
            businessCaseId: 'bc-1',
            implementationPlanId: 'ip-1',
          },
          progressPercent: 100,
          currentStep: 'Done',
          error: null,
          businessProfileId: 'profile-1',
          platform: 'vendor_agnostic',
          strategicInitiativeId: null,
          startedAt: '2026-04-21T00:00:00.000Z',
          completedAt: '2026-04-21T00:00:00.000Z',
          createdAt: '2026-04-21T00:00:00.000Z',
          updatedAt: '2026-04-21T00:00:00.000Z',
        },
        timestamp: '',
      }),
    }));

    const result = await handleGetGenerationStatus(client, { jobId: 'job-1' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.kind).toBe('full_pipeline');
    expect(parsed.generatedArtifactIds.blueprintId).toBe('bp-1');
    expect(parsed.hint).toContain('download_blueprint');
  });

  it('returns a validation error when get_generation_status receives both IDs', async () => {
    const result = await handleGetGenerationStatus(client, { auditId: 'audit-1', jobId: 'job-1' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('exactly one');
  });

  it('formats 403 approval failures clearly', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: () => Promise.resolve({ error: 'AI generation requires an upgraded account. Contact support to unlock this feature.' }),
    }));

    const result = await handleGenerateUseCases(client, {});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Approval required (403)');
  });

  it('formats 429 rate limits clearly', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      json: () => Promise.resolve({ error: 'Rate limit exceeded. Maximum 5 use-case generations per hour.' }),
    }));

    const result = await handleGenerateUseCases(client, {});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Rate limit exceeded (429)');
  });
});
