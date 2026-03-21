import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AgentBlueprintClient } from '../client.js';
import { handleListBlueprints } from '../tools/list-blueprints.js';
import { handleGetBlueprint } from '../tools/get-blueprint.js';
import { handleGetBusinessCase } from '../tools/get-business-case.js';
import { handleGetImplementationPlan } from '../tools/get-implementation-plan.js';
import { handleGetBusinessProfile } from '../tools/get-business-profile.js';
import { handleDownloadBlueprint } from '../tools/download-blueprint.js';

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

  it('handleGetBlueprint returns summary (not full data)', async () => {
    const blueprintData = {
      id: 'bp-1',
      version: 1,
      lifecycleStatus: 'generated',
      useCaseId: null,
      createdAt: '',
      updatedAt: '',
      data: {
        title: 'Test Blueprint',
        executiveSummary: 'A great blueprint',
        agenticPattern: 'Supervisor',
        enhancedDigitalTeam: [
          {
            name: 'Agent 1',
            role: 'Does things',
            agentRole: 'Worker',
            enhancedTools: [
              { name: 'Tool1', sampleOutput: 'very large data here...' },
            ],
          },
        ],
        platformRecommendation: {
          primaryPlatform: { name: 'ServiceNow' },
        },
        phases: [
          { name: 'Pilot', durationWeeks: 4 },
        ],
      },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: blueprintData, timestamp: '' }),
    }));

    const result = await handleGetBlueprint(client, { blueprintId: 'bp-1' });

    expect(result.content).toHaveLength(1);
    const parsed = JSON.parse(result.content[0].text);

    // Should have summary fields
    expect(parsed.id).toBe('bp-1');
    expect(parsed.title).toBe('Test Blueprint');
    expect(parsed.executiveSummary).toBe('A great blueprint');
    expect(parsed.platform).toBe('ServiceNow');
    expect(parsed.agentCount).toBe(1);
    expect(parsed.agents).toHaveLength(1);
    expect(parsed.agents[0].name).toBe('Agent 1');
    expect(parsed.hint).toContain('download_blueprint');

    // Should NOT have full data blob
    expect(parsed.data).toBeUndefined();
    expect(parsed.enhancedDigitalTeam).toBeUndefined();
  });

  it('handleGetBlueprint falls back to instructions.role when top-level role is missing', async () => {
    const blueprintData = {
      id: 'bp-2',
      version: 1,
      lifecycleStatus: 'generated',
      useCaseId: null,
      createdAt: '',
      updatedAt: '',
      data: {
        title: 'Fallback Test',
        enhancedDigitalTeam: [
          {
            name: 'Orchestrator',
            agentRole: 'Manager',
            instructions: { role: 'Coordinate the pipeline end-to-end' },
          },
          {
            name: 'Scanner',
            agentRole: 'Worker',
            // no role, no instructions — should fall back to ''
          },
        ],
      },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: blueprintData, timestamp: '' }),
    }));

    const result = await handleGetBlueprint(client, { blueprintId: 'bp-2' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.agents[0].role).toBe('Coordinate the pipeline end-to-end');
    expect(parsed.agents[1].role).toBe('');
  });

  it('handleGetBusinessCase returns summary (not full data)', async () => {
    const bcData = {
      id: 'bc-1',
      version: 1,
      blueprintId: 'bp-1',
      createdAt: '',
      updatedAt: '',
      data: {
        executiveSummary: {
          purpose: 'Automate things',
          ask: { investmentAmount: '$200K', timeline: '6 months' },
        },
        benefits: {
          quantifiedROI: {
            roi: '285%',
            npv: '$450K',
            paybackPeriod: '8 months',
            pilotROI: { pilotCost: '$50K', pilotROI: '60%' },
            sensitivity: { conservative: {}, realistic: {}, optimistic: {} },
            fiveYearProjection: [{}, {}, {}, {}, {}],
          },
        },
        recommendation: { summary: 'Proceed with pilot' },
      },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: bcData, timestamp: '' }),
    }));

    const result = await handleGetBusinessCase(client, { blueprintId: 'bp-1' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.id).toBe('bc-1');
    expect(parsed.roi.roi).toBe('285%');
    expect(parsed.pilotEconomics.pilotCost).toBe('$50K');
    expect(parsed.recommendation.summary).toBe('Proceed with pilot');
    expect(parsed.hint).toContain('download_blueprint');

    // Should NOT have raw data blob
    expect(parsed.data).toBeUndefined();
    // Should NOT have full sensitivity/projection
    expect(parsed.sensitivity).toBeUndefined();
    expect(parsed.fiveYearProjection).toBeUndefined();
  });

  it('handleGetImplementationPlan returns summary (not full data)', async () => {
    const planData = {
      id: 'ip-1',
      version: 1,
      blueprintId: 'bp-1',
      createdAt: '',
      updatedAt: '',
      data: {
        projectOverview: {
          projectName: 'Test Project',
          executiveSummary: 'Deploy agents',
          scope: 'All departments',
        },
        epics: [
          {
            name: 'Setup',
            phase: 'Phase 1',
            priority: 'P0',
            estimatedDuration: '2 weeks',
            stories: [{ title: 'S1' }, { title: 'S2' }, { title: 'S3' }],
          },
          {
            name: 'Build',
            phase: 'Phase 2',
            priority: 'P1',
            stories: [{ title: 'S4' }],
          },
        ],
        resources: {
          timeline: { totalDuration: '6 months' },
        },
        agentSpecifications: [{ name: 'Agent1' }, { name: 'Agent2' }],
      },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: planData, timestamp: '' }),
    }));

    const result = await handleGetImplementationPlan(client, { blueprintId: 'bp-1' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.id).toBe('ip-1');
    expect(parsed.projectOverview.projectName).toBe('Test Project');
    expect(parsed.epicCount).toBe(2);
    expect(parsed.epics[0].name).toBe('Setup');
    expect(parsed.epics[0].storyCount).toBe(3);
    expect(parsed.epics[1].storyCount).toBe(1);
    expect(parsed.timeline.totalDuration).toBe('6 months');
    expect(parsed.agentSpecificationCount).toBe(2);
    expect(parsed.hint).toContain('download_blueprint');

    // Should NOT have full stories
    expect(parsed.data).toBeUndefined();
    expect(parsed.epics[0].stories).toBeUndefined();
  });
});

describe('handleDownloadBlueprint', () => {
  let client: AgentBlueprintClient;

  beforeEach(() => {
    client = new AgentBlueprintClient(mockConfig);
    vi.restoreAllMocks();
  });

  it('returns file manifest with all skill files', async () => {
    const fetchMock = vi.fn()
      // getBlueprint
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          timestamp: '',
          data: {
            id: 'bp-1',
            version: 1,
            lifecycleStatus: 'generated',
            useCaseId: null,
            createdAt: '',
            updatedAt: '',
            data: {
              title: 'My Test Blueprint',
              executiveSummary: 'Test exec summary',
              enhancedDigitalTeam: [
                { name: 'Agent 1', role: 'Worker' },
              ],
            },
          },
        }),
      })
      // getBusinessCase
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          timestamp: '',
          data: { id: 'bc-1', version: 1, blueprintId: 'bp-1', createdAt: '', updatedAt: '', data: {} },
        }),
      })
      // getImplementationPlan
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          timestamp: '',
          data: { id: 'ip-1', version: 1, blueprintId: 'bp-1', createdAt: '', updatedAt: '', data: {} },
        }),
      })
      // getUseCase
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          timestamp: '',
          data: { title: 'Test Use Case' },
        }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const result = await handleDownloadBlueprint(client, { blueprintId: 'bp-1' });

    expect(result.isError).toBeUndefined();
    expect(result.content).toHaveLength(2);

    const manifest = JSON.parse(result.content[0].text);
    expect(result.content[1].text).toContain('Read GETTING-STARTED.md');

    expect(manifest.directory).toBe('my-test-blueprint');
    expect(manifest.installHint).toContain('.agent-blueprint/');
    expect(manifest.files).toHaveLength(13);

    const filePaths = manifest.files.map((f: { path: string }) => f.path);
    expect(filePaths).toContain('SKILL.md');
    expect(filePaths).toContain('references/agent-specifications.md');
    expect(filePaths).toContain('references/financial-case.md');
    expect(filePaths).toContain('scripts/validate-spec.sh');
    expect(filePaths).toContain('implementation-state.yaml');

    // SKILL.md should have frontmatter
    const skillFile = manifest.files.find((f: { path: string }) => f.path === 'SKILL.md');
    expect(skillFile.content).toContain('---');
    expect(skillFile.content).toContain('name: my-test-blueprint');
  });

  it('handles missing artifacts gracefully', async () => {
    const fetchMock = vi.fn()
      // getBlueprint
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          timestamp: '',
          data: {
            id: 'bp-1',
            version: 1,
            lifecycleStatus: 'generated',
            useCaseId: null,
            createdAt: '',
            updatedAt: '',
            data: {
              title: 'Minimal Blueprint',
              enhancedDigitalTeam: [{ name: 'Agent 1', role: 'Worker' }],
            },
          },
        }),
      })
      // getBusinessCase - 404
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Not found' }),
      })
      // getImplementationPlan - 404
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Not found' }),
      })
      // getUseCase - 404
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Not found' }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const result = await handleDownloadBlueprint(client, { blueprintId: 'bp-1' });

    expect(result.isError).toBeUndefined();
    const manifest = JSON.parse(result.content[0].text);
    expect(manifest.files).toHaveLength(13);
  });

  it('returns error when blueprint fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: () => Promise.resolve({ error: 'Blueprint not found' }),
    }));

    const result = await handleDownloadBlueprint(client, { blueprintId: 'bad-id' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Blueprint not found');
  });
});
