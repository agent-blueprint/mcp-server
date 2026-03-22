import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AgentBlueprintClient } from '../client.js';
import { handleListBlueprints } from '../tools/list-blueprints.js';
import { handleGetBlueprint } from '../tools/get-blueprint.js';
import { handleGetBusinessCase } from '../tools/get-business-case.js';
import { handleGetImplementationPlan } from '../tools/get-implementation-plan.js';
import { handleGetBusinessProfile } from '../tools/get-business-profile.js';
import { handleDownloadBlueprint } from '../tools/download-blueprint.js';
import { handleSyncImplementationState } from '../tools/sync-implementation-state.js';
import { handleReportMetric } from '../tools/report-metric.js';
import { handleGetProgress } from '../tools/get-progress.js';

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
    expect(manifest.files).toHaveLength(15);

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
    expect(manifest.files).toHaveLength(15);
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

describe('handleSyncImplementationState', () => {
  let client: AgentBlueprintClient;

  beforeEach(() => {
    client = new AgentBlueprintClient(mockConfig);
    vi.restoreAllMocks();
  });

  const sampleStateData = {
    schema_version: '1.0',
    overall_status: 'in_progress',
    platform: { name: 'ServiceNow', version: 'Australia', environment: 'dev' },
    agents: [
      { name: 'Intake Classifier', status: 'implemented' },
      { name: 'Resolution Agent', status: 'in_progress' },
    ],
  };

  it('returns formatted summary on first sync', async () => {
    const syncResponse = {
      state: {
        id: 'state-1',
        blueprintId: 'bp-1',
        organizationId: 'org-1',
        stateData: sampleStateData,
        schemaVersion: '1.0',
        syncedAt: '2026-03-22T10:00:00Z',
        syncedBy: 'mcp',
        previousStateId: null,
      },
      diff: {
        isFirstSync: true,
        overallStatusChange: { from: null, to: 'in_progress' },
        agentChanges: [
          { name: 'Intake Classifier', statusChange: { from: null, to: 'implemented' }, isNew: true, isRemoved: false },
          { name: 'Resolution Agent', statusChange: { from: null, to: 'in_progress' }, isNew: true, isRemoved: false },
        ],
      },
      warnings: [],
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: syncResponse, timestamp: '' }),
    }));

    const result = await handleSyncImplementationState(client, {
      blueprintId: 'bp-1',
      stateData: sampleStateData,
    });

    expect(result.isError).toBeUndefined();
    const text = result.content[0].text;
    expect(text).toContain('first sync');
    expect(text).toContain('state-1');
    expect(text).toContain('Intake Classifier');
    expect(text).toContain('1/2 agents implemented');
  });

  it('returns formatted summary on subsequent sync with changes', async () => {
    const syncResponse = {
      state: {
        id: 'state-2',
        blueprintId: 'bp-1',
        organizationId: 'org-1',
        stateData: { ...sampleStateData, overall_status: 'complete', agents: [
          { name: 'Intake Classifier', status: 'implemented' },
          { name: 'Resolution Agent', status: 'implemented' },
        ]},
        schemaVersion: '1.0',
        syncedAt: '2026-03-22T12:00:00Z',
        syncedBy: 'mcp',
        previousStateId: 'state-1',
      },
      diff: {
        isFirstSync: false,
        overallStatusChange: { from: 'in_progress', to: 'complete' },
        agentChanges: [
          { name: 'Resolution Agent', statusChange: { from: 'in_progress', to: 'implemented' }, isNew: false, isRemoved: false },
        ],
      },
      warnings: [],
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: syncResponse, timestamp: '' }),
    }));

    const result = await handleSyncImplementationState(client, {
      blueprintId: 'bp-1',
      stateData: sampleStateData,
    });

    expect(result.isError).toBeUndefined();
    const text = result.content[0].text;
    expect(text).toContain('updated');
    expect(text).toContain('in_progress -> complete');
    expect(text).toContain('Resolution Agent: in_progress -> implemented');
    expect(text).toContain('2/2 agents implemented');
  });

  it('shows warnings from agent name mismatch', async () => {
    const syncResponse = {
      state: {
        id: 'state-3',
        blueprintId: 'bp-1',
        organizationId: 'org-1',
        stateData: sampleStateData,
        schemaVersion: '1.0',
        syncedAt: '2026-03-22T10:00:00Z',
        syncedBy: 'mcp',
        previousStateId: null,
      },
      diff: { isFirstSync: true, overallStatusChange: null, agentChanges: [] },
      warnings: ['Agent "Unknown Agent" not found in blueprint'],
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: syncResponse, timestamp: '' }),
    }));

    const result = await handleSyncImplementationState(client, {
      blueprintId: 'bp-1',
      stateData: sampleStateData,
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('Unknown Agent');
  });

  it('returns error on validation failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      json: () => Promise.resolve({ error: 'overall_status: Invalid enum value' }),
    }));

    const result = await handleSyncImplementationState(client, {
      blueprintId: 'bp-1',
      stateData: { schema_version: '1.0', overall_status: 'invalid' },
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid enum value');
  });
});

describe('handleReportMetric', () => {
  let client: AgentBlueprintClient;

  beforeEach(() => {
    client = new AgentBlueprintClient(mockConfig);
    vi.restoreAllMocks();
  });

  it('returns formatted summary with deviation analysis', async () => {
    const reportResponse = {
      results: [
        {
          metricName: 'Incident Resolution Time',
          metricId: 'metric-1',
          predictedValue: '≤5 hours',
          actualValue: '4.2 hours',
          deviationPercent: -16,
          status: 'on_track',
          warnings: [],
        },
        {
          metricName: 'First Contact Resolution',
          metricId: 'metric-2',
          predictedValue: '≥80%',
          actualValue: '78%',
          deviationPercent: -2.5,
          status: 'on_track',
          warnings: [],
        },
      ],
      summary: { total: 2, succeeded: 2, failed: 0, warnings: 0 },
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: reportResponse, timestamp: '' }),
    }));

    const result = await handleReportMetric(client, {
      blueprintId: 'bp-1',
      metrics: [
        { metricName: 'Incident Resolution Time', actualValue: '4.2 hours' },
        { metricName: 'First Contact Resolution', actualValue: '78%' },
      ],
    });

    expect(result.isError).toBeUndefined();
    const text = result.content[0].text;
    expect(text).toContain('2/2 metrics');
    expect(text).toContain('[OK] Incident Resolution Time');
    expect(text).toContain('target: ≤5 hours');
    expect(text).toContain('4.2 hours');
  });

  it('shows warnings for unmatched metrics', async () => {
    const reportResponse = {
      results: [
        {
          metricName: 'Custom Metric',
          metricId: 'metric-3',
          predictedValue: 'N/A',
          actualValue: '42',
          deviationPercent: 0,
          status: 'on_track',
          warnings: ['Metric "Custom Metric" not found in blueprint targets.'],
        },
      ],
      summary: { total: 1, succeeded: 1, failed: 0, warnings: 1 },
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: reportResponse, timestamp: '' }),
    }));

    const result = await handleReportMetric(client, {
      blueprintId: 'bp-1',
      metrics: [{ metricName: 'Custom Metric', actualValue: '42' }],
    });

    expect(result.isError).toBeUndefined();
    const text = result.content[0].text;
    expect(text).toContain('Custom Metric');
    expect(text).toContain('not found in blueprint targets');
  });

  it('returns error on API failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: () => Promise.resolve({ error: 'Blueprint not found' }),
    }));

    const result = await handleReportMetric(client, {
      blueprintId: 'nonexistent',
      metrics: [{ metricName: 'Test', actualValue: '100' }],
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Blueprint not found');
  });
});

describe('handleGetProgress', () => {
  let client: AgentBlueprintClient;

  beforeEach(() => {
    client = new AgentBlueprintClient(mockConfig);
    vi.restoreAllMocks();
  });

  it('returns formatted progress with metrics and implementation state', async () => {
    const progressResponse = {
      blueprintId: 'bp-1',
      blueprintTitle: 'Enterprise Onboarding Automation',
      targets: {
        operational: [
          { name: 'Onboarding Cycle Time', target: '≤5 days', unit: 'days', direction: 'lower_is_better' },
          { name: 'Error Rate', target: '≤2%', unit: '%', direction: 'lower_is_better' },
        ],
        financial: [
          { name: 'ROI', value: '285%', unit: '%', direction: 'higher_is_better' },
        ],
      },
      actuals: [
        {
          id: 'metric-1',
          metricName: 'Onboarding Cycle Time',
          metricType: 'operational',
          predictedValue: '≤5 days',
          actualValue: '6.2 days',
          deviationPercent: 24,
          status: 'major_deviation',
          recordedAt: '2026-03-20T10:00:00Z',
          dataSource: 'api',
          recordingCount: 3,
        },
      ],
      summary: {
        totalTargets: 3,
        metricsRecorded: 1,
        onTrack: 0,
        minorDeviation: 0,
        majorDeviation: 1,
      },
      implementationState: {
        overallStatus: 'in_progress',
        agentCount: 5,
        implementedCount: 3,
        lastSyncedAt: '2026-03-19T15:00:00Z',
      },
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: progressResponse, timestamp: '' }),
    }));

    const result = await handleGetProgress(client, { blueprintId: 'bp-1' });

    expect(result.isError).toBeUndefined();
    const text = result.content[0].text;
    expect(text).toContain('Enterprise Onboarding Automation');
    expect(text).toContain('3/5 agents');
    expect(text).toContain('1/3 targets measured');
    expect(text).toContain('[MAJOR] Onboarding Cycle Time');
    expect(text).toContain('6.2 days');
    expect(text).toContain('3 recordings');
    expect(text).toContain('Error Rate');
    expect(text).toContain('ROI');
    expect(text).toContain('Not yet measured');
  });

  it('shows all targets as unmeasured when no actuals exist', async () => {
    const progressResponse = {
      blueprintId: 'bp-2',
      blueprintTitle: 'New Blueprint',
      targets: {
        operational: [{ name: 'Metric A', target: '100', direction: 'higher_is_better' }],
        financial: [],
      },
      actuals: [],
      summary: {
        totalTargets: 1,
        metricsRecorded: 0,
        onTrack: 0,
        minorDeviation: 0,
        majorDeviation: 0,
      },
      implementationState: null,
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: progressResponse, timestamp: '' }),
    }));

    const result = await handleGetProgress(client, { blueprintId: 'bp-2' });

    expect(result.isError).toBeUndefined();
    const text = result.content[0].text;
    expect(text).toContain('0/1 targets measured');
    expect(text).toContain('Not yet measured');
    expect(text).toContain('Metric A');
  });

  it('returns error on API failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: () => Promise.resolve({ error: 'Blueprint not found' }),
    }));

    const result = await handleGetProgress(client, { blueprintId: 'nonexistent' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Blueprint not found');
  });
});
