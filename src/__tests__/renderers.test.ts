import { describe, it, expect } from 'vitest';

import { renderSkillDirectory, slugify, hasProgressData } from '../renderers.js';
import type { SkillRenderInput } from '../renderers.js';
import type { ImplementationStateResponse, ProgressResponse } from '../client.js';

// ─── Test fixtures ──────────────────────────────────────────────────

const minimalInput: SkillRenderInput = {
  blueprintTitle: 'Test Blueprint',
  blueprintId: 'bp-123',
  blueprintData: {
    title: 'Test Blueprint',
    executiveSummary: 'A test blueprint for unit testing.',
    agenticPattern: 'Supervisor',
    enhancedDigitalTeam: [
      {
        name: 'Test Agent',
        role: 'Handles test tasks',
        agentRole: 'Worker',
        supervisionLevel: 'Supervised',
        instructions: { description: 'Process incoming test requests' },
        responsibilities: ['Handle tests', 'Report results'],
        enhancedTools: [
          { name: 'TestRunner', toolCategory: 'Testing', description: 'Runs tests' },
        ],
        guardrails: [
          { type: 'Safety', condition: 'Must not delete production data' },
        ],
        escalationRules: ['Escalate on failure'],
        successMetrics: [
          { metric: 'Test Pass Rate', target: '99%' },
        ],
      },
    ],
    platformRecommendation: {
      primaryPlatform: { name: 'ServiceNow', summary: 'Enterprise platform' },
    },
    riskAssessment: {
      technicalRisks: ['Integration complexity'],
      businessRisks: ['Adoption risk'],
      mitigationStrategies: ['Phased rollout'],
    },
    phases: [
      { name: 'Pilot Phase', durationWeeks: 4, phaseGoal: 'Validate approach', phaseCost: '$50,000' },
      { name: 'Full Rollout', durationWeeks: 12, phaseGoal: 'Enterprise deployment' },
    ],
  },
};

const fullInput: SkillRenderInput = {
  ...minimalInput,
  businessCaseData: {
    executiveSummary: {
      purpose: 'Automate testing processes',
      ask: {
        investmentAmount: '$200,000',
        timeline: '6 months',
        keyOutcomes: ['50% faster testing', 'Reduced errors'],
      },
      valueProposition: 'Significant ROI through automation',
    },
    benefits: {
      quantifiedROI: {
        roi: '285%',
        npv: '$450,000',
        paybackPeriod: '8 months',
        laborCostDetail: {
          currentStateBaseline: {
            blendedHourlyRate: { value: '$95/hr' },
            totalAnnualCost: { value: '$300,000' },
            totalAnnualHours: { value: '3,150' },
          },
          projectedSavings: {
            costSavingsAnnual: { value: '$180,000' },
          },
        },
        costBreakdown: {
          implementation: { value: '$150,000' },
          annualLicensing: { value: '$30,000' },
          annualSupportMaintenance: { value: '$15,000' },
        },
        pilotROI: {
          pilotCapex: { value: '$37,500', calculation: '$150,000 × 25%' },
          pilotOpex: { value: '$7,500', calculation: '$37,500 × 20%' },
          pilotAnnualSavings: { value: '$27,000', calculation: '$180,000 × 15%' },
          pilotPaybackMonths: '20',
          pilotYear1Net: { value: '-$18,000', calculation: '$27,000 - $45,000' },
        },
        sensitivity: {
          conservative: { roiPercentage: 180, paybackMonths: 12, annualSavings: '$144,000' },
          realistic: { roiPercentage: 285, paybackMonths: 8, annualSavings: '$180,000' },
          optimistic: { roiPercentage: 380, paybackMonths: 5, annualSavings: '$228,000' },
        },
        fiveYearProjection: [
          { year: 1, costsThisYear: '$200K', valueDelivered: '$100K', netThisYear: '-$100K', runningTotal: '-$100K' },
          { year: 2, costsThisYear: '$50K', valueDelivered: '$250K', netThisYear: '$200K', runningTotal: '$100K' },
        ],
      },
    },
    risks: {
      implementationRisks: [
        { title: 'Data migration', severity: 'High', impact: 'Schedule delay' },
      ],
      mitigationPlan: [
        { riskTitle: 'Data migration', strategy: 'Parallel run', owner: 'PM', timeline: 'Week 4-8' },
      ],
    },
  },
  implementationPlanData: {
    projectOverview: {
      projectName: 'Test Automation Project',
      executiveSummary: 'Deploy AI-powered test automation',
      scope: 'All testing functions',
      assumptions: ['Stable API', 'Team availability'],
    },
    epics: [
      {
        name: 'Infrastructure Setup',
        phase: 'Phase 1',
        priority: 'P0',
        estimatedDuration: '2 weeks',
        businessValue: 'Foundation for all agents',
        stories: [
          { title: 'Setup CI/CD', asA: 'developer', iWant: 'automated pipelines', soThat: 'deploys are reliable' },
        ],
        dependencies: ['Cloud access'],
      },
    ],
    resources: {
      timeline: {
        totalDuration: '6 months',
        phases: [
          { name: 'Phase 1', duration: '2 months', milestones: ['Pilot complete'] },
        ],
      },
      roles: [
        { role: 'Developer', allocation: 'Full-time', duration: '6 months', skillsRequired: ['TypeScript', 'AI'] },
      ],
    },
    dependencies: [
      { type: 'Technical', criticality: 'High', description: 'API access required' },
    ],
  },
  useCaseData: {
    title: 'Test Automation',
    description: 'Automate manual testing processes',
    businessChallenge: 'Manual testing is slow and error-prone',
    currentPainPoints: ['Slow feedback loops', 'Human error'],
    desiredBusinessOutcomes: ['Faster releases', 'Higher quality'],
    transformationStory: {
      situation: 'Manual testing taking 2 weeks per release',
      complication: 'Growing product complexity',
      resolution: 'AI-powered automation reduces to 2 days',
    },
  },
};

// ─── Tests ──────────────────────────────────────────────────────────

describe('slugify', () => {
  it('converts title to URL-safe slug', () => {
    expect(slugify('My Test Blueprint')).toBe('my-test-blueprint');
  });

  it('removes special characters', () => {
    expect(slugify('AI-Powered Testing (v2.0)!')).toBe('ai-powered-testing-v2-0');
  });

  it('truncates at 60 characters', () => {
    const long = 'a'.repeat(100);
    expect(slugify(long).length).toBeLessThanOrEqual(60);
  });

  it('handles empty string', () => {
    expect(slugify('')).toBe('');
  });
});

describe('renderSkillDirectory', () => {
  it('returns all expected files', () => {
    const files = renderSkillDirectory(minimalInput);
    const paths = Array.from(files.keys());

    expect(paths).toContain('SKILL.md');
    expect(paths).toContain('references/business-context.md');
    expect(paths).toContain('references/organization-context.md');
    expect(paths).toContain('references/agent-specifications.md');
    expect(paths).toContain('references/financial-case.md');
    expect(paths).toContain('references/implementation-roadmap.md');
    expect(paths).toContain('references/architecture-decisions.md');
    expect(paths).toContain('references/guardrails-and-governance.md');
    expect(paths).toContain('references/evaluation-criteria.md');
    expect(paths).toContain('references/platform-connectivity.md');
    expect(paths).toContain('GETTING-STARTED.md');
    expect(paths).toContain('scripts/validate-spec.sh');
    expect(paths).toContain('implementation-state.yaml');
    expect(paths).toContain('AGENTS.md');
    expect(paths).toContain('hooks/claude-code-sync.json');
    expect(files.size).toBe(15);
  });

  it('SKILL.md starts with YAML frontmatter', () => {
    const files = renderSkillDirectory(minimalInput);
    const skill = files.get('SKILL.md')!;

    expect(skill.startsWith('---\n')).toBe(true);
    expect(skill).toContain('name: test-blueprint');
    expect(skill).toContain('blueprint-id: "bp-123"');
    expect(skill).toContain('target-platform: "ServiceNow"');
    expect(skill).toContain('agent-count: "1"');
    expect(skill).toContain('pattern: "Supervisor"');
  });

  it('SKILL.md body contains agent table', () => {
    const files = renderSkillDirectory(minimalInput);
    const skill = files.get('SKILL.md')!;

    expect(skill).toContain('| # | Agent | Role | Type |');
    expect(skill).toContain('Test Agent');
  });

  it('SKILL.md includes phase information', () => {
    const files = renderSkillDirectory(minimalInput);
    const skill = files.get('SKILL.md')!;

    expect(skill).toContain('Phase 1: Pilot');
    expect(skill).toContain('4 weeks');
    expect(skill).toContain('Full Rollout');
  });

  it('agent-specifications.md includes tool table', () => {
    const files = renderSkillDirectory(minimalInput);
    const agentSpec = files.get('references/agent-specifications.md')!;

    expect(agentSpec).toContain('## Test Agent');
    expect(agentSpec).toContain('TestRunner');
    expect(agentSpec).toContain('### Guardrails');
    expect(agentSpec).toContain('Must not delete production data');
    expect(agentSpec).toContain('### Success Metrics');
    expect(agentSpec).toContain('99%');
  });

  it('architecture-decisions.md includes platform info', () => {
    const files = renderSkillDirectory(minimalInput);
    const arch = files.get('references/architecture-decisions.md')!;

    expect(arch).toContain('## Platform: ServiceNow');
  });

  it('guardrails-and-governance.md includes risks', () => {
    const files = renderSkillDirectory(minimalInput);
    const guardrails = files.get('references/guardrails-and-governance.md')!;

    expect(guardrails).toContain('Integration complexity');
    expect(guardrails).toContain('Adoption risk');
    expect(guardrails).toContain('Phased rollout');
  });

  it('validate-spec.sh is executable bash script', () => {
    const files = renderSkillDirectory(minimalInput);
    const script = files.get('scripts/validate-spec.sh')!;

    expect(script).toContain('#!/bin/bash');
    expect(script).toContain('check_file "SKILL.md"');
  });
});

describe('renderSkillDirectory with full data', () => {
  it('financial-case.md includes ROI and sensitivity', () => {
    const files = renderSkillDirectory(fullInput);
    const financial = files.get('references/financial-case.md')!;

    expect(financial).toContain('285%');
    expect(financial).toContain('$450,000');
    expect(financial).toContain('8 months');
    expect(financial).toContain('## Sensitivity Analysis');
    expect(financial).toContain('Conservative');
    expect(financial).toContain('180%');   // conservative ROI
    expect(financial).toContain('## Five-Year Projection');
    expect(financial).toContain('$200K');  // year 1 costs
    expect(financial).toContain('## Pilot Economics');
    expect(financial).toContain('$37,500'); // pilot capex
    expect(financial).toContain('## Labor Cost Analysis');
    expect(financial).toContain('$95/hr');  // blended rate
    expect(financial).toContain('## Cost Breakdown');
    expect(financial).toContain('$150,000'); // implementation
  });

  it('implementation-roadmap.md includes epics and stories', () => {
    const files = renderSkillDirectory(fullInput);
    const roadmap = files.get('references/implementation-roadmap.md')!;

    expect(roadmap).toContain('Test Automation Project');
    expect(roadmap).toContain('### Infrastructure Setup');
    expect(roadmap).toContain('Setup CI/CD');
    expect(roadmap).toContain('## Timeline');
    expect(roadmap).toContain('6 months');
    expect(roadmap).toContain('## Required Roles');
    expect(roadmap).toContain('## Dependencies');
  });

  it('business-context.md includes use case data', () => {
    const files = renderSkillDirectory(fullInput);
    const context = files.get('references/business-context.md')!;

    expect(context).toContain('## Use Case: Test Automation');
    expect(context).toContain('Manual testing is slow');
    expect(context).toContain('## Transformation Story');
    expect(context).toContain('AI-powered automation');
  });

  it('guardrails includes business case risks', () => {
    const files = renderSkillDirectory(fullInput);
    const guardrails = files.get('references/guardrails-and-governance.md')!;

    expect(guardrails).toContain('Implementation Risks (Business Case)');
    expect(guardrails).toContain('Data migration');
    expect(guardrails).toContain('## Mitigation Plan');
    expect(guardrails).toContain('Parallel run');
  });

  it('SKILL.md includes financial summary when business case present', () => {
    const files = renderSkillDirectory(fullInput);
    const skill = files.get('SKILL.md')!;

    expect(skill).toContain('**ROI:** 285%');
    expect(skill).toContain('**NPV:** $450,000');
    // Pilot economics should use nested field structure
    expect(skill).toContain('Pilot capex: $37,500');
    expect(skill).toContain('Pilot annual savings: $27,000');
  });
});

describe('investment tier with multi-number amounts', () => {
  it('parses first number from compound investment string', () => {
    const input: SkillRenderInput = {
      ...minimalInput,
      businessCaseData: {
        executiveSummary: {
          ask: { investmentAmount: '$13,143 one-time + $2,981 annual ongoing' },
        },
        benefits: {},
      },
    };
    const files = renderSkillDirectory(input);
    const skill = files.get('SKILL.md')!;

    expect(skill).toContain('investment-tier: "low"');
  });

  it('handles simple investment amount', () => {
    const input: SkillRenderInput = {
      ...minimalInput,
      businessCaseData: {
        executiveSummary: {
          ask: { investmentAmount: '$200,000' },
        },
        benefits: {},
      },
    };
    const files = renderSkillDirectory(input);
    const skill = files.get('SKILL.md')!;

    expect(skill).toContain('investment-tier: "medium"');
  });

  it('returns pending when no business case', () => {
    const files = renderSkillDirectory(minimalInput);
    const skill = files.get('SKILL.md')!;

    expect(skill).toContain('investment-tier: "pending"');
  });
});

describe('renderSkillDirectory with missing data', () => {
  it('handles missing business case gracefully', () => {
    const input: SkillRenderInput = {
      ...minimalInput,
      businessCaseData: undefined,
    };
    const files = renderSkillDirectory(input);
    const financial = files.get('references/financial-case.md')!;

    expect(financial).toContain('No business case data available');
  });

  it('handles missing implementation plan gracefully', () => {
    const input: SkillRenderInput = {
      ...minimalInput,
      implementationPlanData: undefined,
    };
    const files = renderSkillDirectory(input);
    const roadmap = files.get('references/implementation-roadmap.md')!;

    expect(roadmap).toContain('No implementation plan data available');
  });

  it('handles missing use case gracefully', () => {
    const input: SkillRenderInput = {
      ...minimalInput,
      useCaseData: undefined,
    };
    const files = renderSkillDirectory(input);
    const context = files.get('references/business-context.md')!;

    expect(context).toContain('Use case data not available');
  });

  it('handles empty team gracefully', () => {
    const input: SkillRenderInput = {
      ...minimalInput,
      blueprintData: { ...minimalInput.blueprintData, enhancedDigitalTeam: [] },
    };
    const files = renderSkillDirectory(input);
    const skill = files.get('SKILL.md')!;

    expect(skill).toContain('agent-count: "0"');
  });

  it('handles null fields in blueprint data', () => {
    const input: SkillRenderInput = {
      blueprintTitle: 'Null Test',
      blueprintId: 'bp-null',
      blueprintData: {
        title: null,
        executiveSummary: null,
        enhancedDigitalTeam: null,
        phases: null,
        platformRecommendation: null,
        riskAssessment: null,
      } as any,
    };
    // Should not throw
    const files = renderSkillDirectory(input);
    expect(files.size).toBe(15);
  });

  it('SKILL.md renders phases from implementation plan epics', () => {
    const input: SkillRenderInput = {
      ...minimalInput,
      implementationPlanData: {
        epics: [
          { name: 'Agent Setup', phase: 'Pilot', estimatedDuration: '3 weeks' },
          { name: 'Full Deployment', phase: 'Phase 2', estimatedDuration: '8 weeks' },
        ],
      },
    };
    const files = renderSkillDirectory(input);
    const skill = files.get('SKILL.md')!;

    expect(skill).toContain('**Agent Setup** (3 weeks)');
    expect(skill).toContain('**Full Deployment** (8 weeks)');
  });

  it('evaluation-criteria.md renders with full data', () => {
    const input: SkillRenderInput = {
      ...minimalInput,
      blueprintData: {
        ...minimalInput.blueprintData,
        roiBaseline: {
          generatedAt: '2026-01-01T00:00:00Z',
          operational: [
            { name: 'Test Pass Rate', predictedValue: '99%', unit: '%', direction: 'higher_is_better', source: 'successCriteria.kpis' },
          ],
          financial: [
            { name: 'ROI', predictedValue: '285%', unit: '%', direction: 'higher_is_better', source: 'quantifiedROI' },
          ],
        },
      },
      businessCaseData: fullInput.businessCaseData,
    };
    const files = renderSkillDirectory(input);
    const evalCriteria = files.get('references/evaluation-criteria.md')!;

    expect(evalCriteria).toContain('## Operational Metrics');
    expect(evalCriteria).toContain('Test Pass Rate');
    expect(evalCriteria).toContain('99%');
    expect(evalCriteria).toContain('## Financial Metrics');
    expect(evalCriteria).toContain('ROI');
    expect(evalCriteria).toContain('285%');
    expect(evalCriteria).toContain('## Agent-Level Metrics');
    expect(evalCriteria).toContain('Test Agent');
  });

  it('evaluation-criteria.md shows placeholder without data', () => {
    const input: SkillRenderInput = {
      ...minimalInput,
      blueprintData: {
        ...minimalInput.blueprintData,
        enhancedDigitalTeam: [
          { name: 'Plain Agent', role: 'Does things', agentRole: 'Worker' },
        ],
      },
    };
    const files = renderSkillDirectory(input);
    const evalCriteria = files.get('references/evaluation-criteria.md')!;

    expect(evalCriteria).toContain('No evaluation criteria available yet');
  });

  it('evaluation-criteria.md includes agent-level metrics', () => {
    const files = renderSkillDirectory(minimalInput);
    const evalCriteria = files.get('references/evaluation-criteria.md')!;

    expect(evalCriteria).toContain('## Agent-Level Metrics');
    expect(evalCriteria).toContain('Test Agent');
    expect(evalCriteria).toContain('Test Pass Rate');
    expect(evalCriteria).toContain('99%');
  });

  it('validate-spec.sh checks for evaluation-criteria.md', () => {
    const files = renderSkillDirectory(minimalInput);
    const script = files.get('scripts/validate-spec.sh')!;

    expect(script).toContain('check_optional "references/evaluation-criteria.md"');
  });

  it('five-year projection renders with old field names for backward compat', () => {
    const input: SkillRenderInput = {
      ...minimalInput,
      businessCaseData: {
        executiveSummary: { purpose: 'Test' },
        benefits: {
          quantifiedROI: {
            fiveYearProjection: [
              { year: 1, investment: '$100K', value: '$50K', netCashFlow: '-$50K', cumulative: '-$50K' },
            ],
          },
        },
      },
    };
    const files = renderSkillDirectory(input);
    const financial = files.get('references/financial-case.md')!;

    expect(financial).toContain('$100K');
    expect(financial).toContain('$50K');
  });
});

describe('slugify edge cases', () => {
  it('strips "Blueprint for" prefix before slugifying', () => {
    const result = slugify('Blueprint for Merchant Onboarding Bottleneck from Fragmented Data Access and Legacy Architecture Constraints');
    expect(result.startsWith('blueprint-for')).toBe(false);
    expect(result).toContain('merchant-onboarding');
    expect(result.length).toBeLessThanOrEqual(60);
  });

  it('strips trailing stop words after truncation', () => {
    const result = slugify('Blueprint for Merchant Onboarding Bottleneck from Fragmented Data Access and Legacy Architecture Constraints');
    expect(result).not.toMatch(/-(from|for|and|or|the|with|of|in|on|to|by|a|an)$/);
  });

  it('preserves short titles with "Blueprint for" prefix', () => {
    expect(slugify('Blueprint for CRM')).toBe('crm');
  });
});

describe('description double period', () => {
  it('no double period when title ends with period', () => {
    const input: SkillRenderInput = {
      ...minimalInput,
      blueprintTitle: 'Merchant Onboarding Automation.',
    };
    const files = renderSkillDirectory(input);
    const skill = files.get('SKILL.md')!;
    expect(skill).not.toContain('Automation.. ');
    expect(skill).toContain('Automation. 1 AI agents');
  });
});

describe('evaluation criteria deduplication', () => {
  it('deduplicates overlapping operational metrics with same direction and target', () => {
    const input: SkillRenderInput = {
      ...minimalInput,
      blueprintData: {
        ...minimalInput.blueprintData,
        roiBaseline: {
          generatedAt: '2026-01-01T00:00:00Z',
          operational: [
            { name: 'Instant onboarding share', predictedValue: '70%', unit: '%', direction: 'higher_is_better', source: 'businessCase.objectives' },
            { name: 'Instant Approval Rate', predictedValue: '70%', unit: '%', direction: 'higher_is_better', source: 'roiBaseline' },
            { name: 'Manual review rate', predictedValue: '<5%', unit: '%', direction: 'lower_is_better', source: 'businessCase.objectives' },
          ],
          financial: [],
        },
      },
    };
    const files = renderSkillDirectory(input);
    const evalCriteria = files.get('references/evaluation-criteria.md')!;
    const rows = evalCriteria.split('\n').filter(l => l.startsWith('| ') && !l.startsWith('| Metric') && !l.startsWith('|--'));
    const seventyPercentRows = rows.filter(r => r.includes('70%'));
    expect(seventyPercentRows.length).toBe(1);
    expect(evalCriteria).toContain('Manual review rate');
  });

  it('keeps metrics with same target but different directions', () => {
    const input: SkillRenderInput = {
      ...minimalInput,
      blueprintData: {
        ...minimalInput.blueprintData,
        roiBaseline: {
          generatedAt: '2026-01-01T00:00:00Z',
          operational: [
            { name: 'Approval Rate', predictedValue: '90%', unit: '%', direction: 'higher_is_better', source: 'roiBaseline' },
            { name: 'Rejection Rate', predictedValue: '90%', unit: '%', direction: 'lower_is_better', source: 'roiBaseline' },
          ],
          financial: [],
        },
      },
    };
    const files = renderSkillDirectory(input);
    const evalCriteria = files.get('references/evaluation-criteria.md')!;
    expect(evalCriteria).toContain('Approval Rate');
    expect(evalCriteria).toContain('Rejection Rate');
  });
});

describe('implementation-state.yaml', () => {
  it('contains schema_version and blueprint_id', () => {
    const files = renderSkillDirectory(minimalInput);
    const state = files.get('implementation-state.yaml')!;
    expect(state).toContain('schema_version: "1.0"');
    expect(state).toContain('blueprint_id: "bp-123"');
  });

  it('pre-populates agent names from blueprint', () => {
    const files = renderSkillDirectory(minimalInput);
    const state = files.get('implementation-state.yaml')!;
    expect(state).toContain('name: "Test Agent"');
    expect(state).toContain('status: not_started');
  });

  it('includes agent role and tools as comments', () => {
    const files = renderSkillDirectory(minimalInput);
    const state = files.get('implementation-state.yaml')!;
    expect(state).toContain('# role: Worker | tools: TestRunner');
  });

  it('includes success metrics as commented-out templates', () => {
    const files = renderSkillDirectory(minimalInput);
    const state = files.get('implementation-state.yaml')!;
    expect(state).toContain('# - metric: "Test Pass Rate"');
    expect(state).toContain('#   target: "99%"');
  });

  it('renders overall_status as not_started', () => {
    const files = renderSkillDirectory(minimalInput);
    const state = files.get('implementation-state.yaml')!;
    expect(state).toContain('overall_status: not_started');
  });

  it('includes architecture pattern hint from blueprint', () => {
    const files = renderSkillDirectory(minimalInput);
    const state = files.get('implementation-state.yaml')!;
    expect(state).toContain('# actual pattern used (spec recommends: Supervisor)');
  });

  it('handles empty team gracefully', () => {
    const input: SkillRenderInput = {
      ...minimalInput,
      blueprintData: { ...minimalInput.blueprintData, enhancedDigitalTeam: [] },
    };
    const files = renderSkillDirectory(input);
    const state = files.get('implementation-state.yaml')!;
    expect(state).toContain('agents: []');
    expect(state).toContain('schema_version: "1.0"');
    expect(state).toContain('metrics_observed: []');
  });

  it('handles agent with no success metrics', () => {
    const input: SkillRenderInput = {
      ...minimalInput,
      blueprintData: {
        ...minimalInput.blueprintData,
        enhancedDigitalTeam: [
          { name: 'Plain Agent', agentRole: 'Worker' },
        ],
      },
    };
    const files = renderSkillDirectory(input);
    const state = files.get('implementation-state.yaml')!;
    expect(state).toContain('name: "Plain Agent"');
    expect(state).toContain('metrics_observed: []');
    expect(state).not.toContain('# - metric:');
  });

  it('handles multiple agents', () => {
    const input: SkillRenderInput = {
      ...minimalInput,
      blueprintData: {
        ...minimalInput.blueprintData,
        enhancedDigitalTeam: [
          {
            name: 'Manager Agent',
            agentRole: 'Manager',
            enhancedTools: [{ name: 'TaskRouter', description: 'Routes tasks' }],
            successMetrics: [{ metric: 'Task Completion', target: '95%' }],
          },
          {
            name: 'Worker Agent',
            agentRole: 'Worker',
            enhancedTools: [{ name: 'DataParser', description: 'Parses data' }],
            successMetrics: [{ metric: 'Accuracy', target: '99%' }],
          },
        ],
      },
    };
    const files = renderSkillDirectory(input);
    const state = files.get('implementation-state.yaml')!;
    expect(state).toContain('name: "Manager Agent"');
    expect(state).toContain('name: "Worker Agent"');
    expect(state).toContain('# - metric: "Task Completion"');
    expect(state).toContain('# - metric: "Accuracy"');
  });

  it('deduplicates success metrics across agents', () => {
    const input: SkillRenderInput = {
      ...minimalInput,
      blueprintData: {
        ...minimalInput.blueprintData,
        enhancedDigitalTeam: [
          { name: 'Agent A', agentRole: 'Worker', successMetrics: [{ metric: 'Accuracy', target: '95%' }] },
          { name: 'Agent B', agentRole: 'Worker', successMetrics: [{ metric: 'Accuracy', target: '95%' }] },
        ],
      },
    };
    const files = renderSkillDirectory(input);
    const state = files.get('implementation-state.yaml')!;
    const metricLines = state.split('\n').filter(l => l.includes('# - metric: "Accuracy"'));
    expect(metricLines.length).toBe(1);
  });

  it('status enum comment only on first agent', () => {
    const input: SkillRenderInput = {
      ...minimalInput,
      blueprintData: {
        ...minimalInput.blueprintData,
        enhancedDigitalTeam: [
          { name: 'Agent A', agentRole: 'Worker' },
          { name: 'Agent B', agentRole: 'Worker' },
        ],
      },
    };
    const files = renderSkillDirectory(input);
    const state = files.get('implementation-state.yaml')!;
    const enumComments = state.split('\n').filter(l => l.includes('# not_started | in_progress | implemented'));
    expect(enumComments.length).toBe(1);
  });
});

describe('implementation-state.yaml pre-populated from synced state', () => {
  const syncedState: ImplementationStateResponse = {
    id: 'state-1',
    blueprintId: 'bp-123',
    organizationId: 'org-1',
    stateData: {
      schema_version: '1.0',
      blueprint_id: 'bp-123',
      last_updated: '2026-03-20T12:00:00Z',
      overall_status: 'in_progress',
      platform: { name: 'ServiceNow', version: 'Australia', environment: 'dev' },
      agents: [
        {
          name: 'Test Agent',
          status: 'implemented',
          platform_artifact: 'sys_id:abc123',
          deviations: ['Used Flow Designer instead of Workflow'],
          integrations_connected: ['CMDB', 'Service Portal'],
          notes: 'Working well',
        },
      ],
      architecture: {
        pattern: 'Supervisor',
        deviations: ['Added fallback routing'],
        additional_components: ['Custom REST API'],
      },
      metrics_observed: [
        { metric: 'Resolution Time', target: '<4h', actual: '3.2h', measured_at: '2026-03-19', source: 'dashboard' },
      ],
    },
    schemaVersion: '1.0',
    syncedAt: '2026-03-20T12:00:00Z',
    syncedBy: 'cli',
    previousStateId: null,
  };

  it('populates YAML from synced state instead of blank template', () => {
    const input: SkillRenderInput = { ...minimalInput, implementationState: syncedState };
    const files = renderSkillDirectory(input);
    const state = files.get('implementation-state.yaml')!;
    expect(state).toContain('overall_status: in_progress');
    expect(state).toContain('name: "ServiceNow"');
    expect(state).toContain('version: "Australia"');
    expect(state).toContain('environment: "dev"');
    expect(state).toContain('status: implemented');
    expect(state).toContain('platform_artifact: "sys_id:abc123"');
    expect(state).toContain('Used Flow Designer instead of Workflow');
    expect(state).toContain('notes: "Working well"');
  });

  it('includes pre-populated header comment', () => {
    const input: SkillRenderInput = { ...minimalInput, implementationState: syncedState };
    const files = renderSkillDirectory(input);
    const state = files.get('implementation-state.yaml')!;
    expect(state).toContain('Pre-populated from last sync');
  });

  it('populates architecture from synced state', () => {
    const input: SkillRenderInput = { ...minimalInput, implementationState: syncedState };
    const files = renderSkillDirectory(input);
    const state = files.get('implementation-state.yaml')!;
    expect(state).toContain('pattern: "Supervisor"');
    expect(state).toContain('Added fallback routing');
    expect(state).toContain('Custom REST API');
  });

  it('populates metrics_observed from synced state', () => {
    const input: SkillRenderInput = { ...minimalInput, implementationState: syncedState };
    const files = renderSkillDirectory(input);
    const state = files.get('implementation-state.yaml')!;
    expect(state).toContain('metric: "Resolution Time"');
    expect(state).toContain('target: "<4h"');
    expect(state).toContain('actual: "3.2h"');
    expect(state).toContain('source: "dashboard"');
  });

  it('populates integrations_connected from synced state', () => {
    const input: SkillRenderInput = { ...minimalInput, implementationState: syncedState };
    const files = renderSkillDirectory(input);
    const state = files.get('implementation-state.yaml')!;
    expect(state).toContain('CMDB');
    expect(state).toContain('Service Portal');
  });

  it('still renders blank template when no synced state exists', () => {
    const files = renderSkillDirectory(minimalInput);
    const state = files.get('implementation-state.yaml')!;
    expect(state).toContain('overall_status: not_started');
    expect(state).toContain('last_updated: ""');
    expect(state).not.toContain('Pre-populated');
  });

  it('renders blank template when all agents are not_started', () => {
    const allNotStarted: ImplementationStateResponse = {
      ...syncedState,
      stateData: {
        ...syncedState.stateData as Record<string, unknown>,
        overall_status: 'not_started',
        agents: [
          { name: 'Test Agent', status: 'not_started', platform_artifact: '', deviations: [], integrations_connected: [], notes: '' },
        ],
      },
    };
    const input: SkillRenderInput = { ...minimalInput, implementationState: allNotStarted };
    const files = renderSkillDirectory(input);
    const state = files.get('implementation-state.yaml')!;
    // Should use blank template since hasImplementationData returns false
    expect(state).not.toContain('Pre-populated');
    expect(state).toContain('last_updated: ""');
  });

  it('merges blueprint agents not in synced state as not_started', () => {
    const input: SkillRenderInput = {
      ...minimalInput,
      blueprintData: {
        ...minimalInput.blueprintData,
        enhancedDigitalTeam: [
          { name: 'Test Agent', agentRole: 'Worker', enhancedTools: [{ name: 'TestRunner', description: 'Runs tests' }], successMetrics: [{ metric: 'Test Pass Rate', target: '99%' }] },
          { name: 'New Agent', agentRole: 'Manager', enhancedTools: [], successMetrics: [] },
        ],
      },
      implementationState: syncedState,
    };
    const files = renderSkillDirectory(input);
    const state = files.get('implementation-state.yaml')!;
    // Synced agent should be populated
    expect(state).toContain('status: implemented');
    // Blueprint-only agent should appear as not_started
    expect(state).toContain('name: "New Agent"');
    expect(state).toMatch(/name: "New Agent"[\s\S]*?status: not_started/);
  });

  it('preserves role/tools hints from blueprint on pre-populated agents', () => {
    const input: SkillRenderInput = { ...minimalInput, implementationState: syncedState };
    const files = renderSkillDirectory(input);
    const state = files.get('implementation-state.yaml')!;
    expect(state).toContain('# role: Worker | tools: TestRunner');
  });
});

describe('GETTING-STARTED.md implementation state reference', () => {
  it('mentions implementation-state.yaml', () => {
    const files = renderSkillDirectory(minimalInput);
    const guide = files.get('GETTING-STARTED.md')!;
    expect(guide).toContain('implementation-state.yaml');
  });

  it('references agentblueprint sync', () => {
    const files = renderSkillDirectory(minimalInput);
    const guide = files.get('GETTING-STARTED.md')!;
    expect(guide).toContain('agentblueprint sync');
  });
});

describe('GETTING-STARTED.md sync enhancements', () => {
  it('Step 5 has sync trigger points', () => {
    const files = renderSkillDirectory(minimalInput);
    const guide = files.get('GETTING-STARTED.md')!;
    expect(guide).toContain('After implementing an agent');
    expect(guide).toContain('After connecting an integration');
  });

  it('Step 5 has MCP tool examples', () => {
    const files = renderSkillDirectory(minimalInput);
    const guide = files.get('GETTING-STARTED.md')!;
    expect(guide).toContain('sync_implementation_state');
    expect(guide).toContain('report_metric');
  });

  it('Step 5 references AGENTS.md', () => {
    const files = renderSkillDirectory(minimalInput);
    const guide = files.get('GETTING-STARTED.md')!;
    expect(guide).toContain('AGENTS.md');
  });

  it('Step 5 references hooks/claude-code-sync.json', () => {
    const files = renderSkillDirectory(minimalInput);
    const guide = files.get('GETTING-STARTED.md')!;
    expect(guide).toContain('hooks/claude-code-sync.json');
  });

  it('Step 5 includes the blueprint ID in tool examples', () => {
    const files = renderSkillDirectory(minimalInput);
    const guide = files.get('GETTING-STARTED.md')!;
    expect(guide).toContain('bp-123');
  });
});

describe('AGENTS.md', () => {
  it('contains sync trigger points', () => {
    const files = renderSkillDirectory(minimalInput);
    const agents = files.get('AGENTS.md')!;
    expect(agents).toContain('After implementing an agent');
    expect(agents).toContain('At the end of every coding session');
  });

  it('contains MCP tool examples', () => {
    const files = renderSkillDirectory(minimalInput);
    const agents = files.get('AGENTS.md')!;
    expect(agents).toContain('sync_implementation_state');
    expect(agents).toContain('report_metric');
  });

  it('contains CLI examples', () => {
    const files = renderSkillDirectory(minimalInput);
    const agents = files.get('AGENTS.md')!;
    expect(agents).toContain('agentblueprint sync');
  });

  it('includes the blueprint ID', () => {
    const files = renderSkillDirectory(minimalInput);
    const agents = files.get('AGENTS.md')!;
    expect(agents).toContain('bp-123');
  });

  it('contains deviation documentation guidance', () => {
    const files = renderSkillDirectory(minimalInput);
    const agents = files.get('AGENTS.md')!;
    expect(agents).toContain('deviations');
    expect(agents).toContain('implementation-state.yaml');
  });
});

describe('hooks/claude-code-sync.json', () => {
  it('is valid JSON', () => {
    const files = renderSkillDirectory(minimalInput);
    const hookContent = files.get('hooks/claude-code-sync.json')!;
    expect(() => JSON.parse(hookContent)).not.toThrow();
  });

  it('has Stop hook structure', () => {
    const files = renderSkillDirectory(minimalInput);
    const config = JSON.parse(files.get('hooks/claude-code-sync.json')!);
    expect(config.hooks).toBeDefined();
    expect(config.hooks.Stop).toBeDefined();
    expect(Array.isArray(config.hooks.Stop)).toBe(true);
    expect(config.hooks.Stop[0].hooks[0].type).toBe('command');
  });

  it('does not include matcher field (Stop hooks do not support matchers)', () => {
    const files = renderSkillDirectory(minimalInput);
    const config = JSON.parse(files.get('hooks/claude-code-sync.json')!);
    expect(config.hooks.Stop[0]).not.toHaveProperty('matcher');
  });

  it('checks stop_hook_active to prevent infinite loops', () => {
    const files = renderSkillDirectory(minimalInput);
    const config = JSON.parse(files.get('hooks/claude-code-sync.json')!);
    const command = config.hooks.Stop[0].hooks[0].command;
    expect(command).toContain('stop_hook_active');
  });

  it('uses jq for JSON parsing', () => {
    const files = renderSkillDirectory(minimalInput);
    const config = JSON.parse(files.get('hooks/claude-code-sync.json')!);
    const command = config.hooks.Stop[0].hooks[0].command;
    expect(command).toContain('jq');
  });

  it('uses git status --porcelain to catch untracked files', () => {
    const files = renderSkillDirectory(minimalInput);
    const config = JSON.parse(files.get('hooks/claude-code-sync.json')!);
    const command = config.hooks.Stop[0].hooks[0].command;
    expect(command).toContain('git status --porcelain');
  });

  it('includes the blueprint ID', () => {
    const files = renderSkillDirectory(minimalInput);
    const config = JSON.parse(files.get('hooks/claude-code-sync.json')!);
    const command = config.hooks.Stop[0].hooks[0].command;
    expect(command).toContain('bp-123');
  });

  it('has a 30-second timeout', () => {
    const files = renderSkillDirectory(minimalInput);
    const config = JSON.parse(files.get('hooks/claude-code-sync.json')!);
    expect(config.hooks.Stop[0].hooks[0].timeout).toBe(30);
  });
});

describe('validate-spec.sh implementation state check', () => {
  it('checks for implementation-state.yaml', () => {
    const files = renderSkillDirectory(minimalInput);
    const script = files.get('scripts/validate-spec.sh')!;
    expect(script).toContain('check_optional "implementation-state.yaml"');
  });
});

// =============================================================================
// Reality Layer Tests (Living Blueprint Phase 3A)
// =============================================================================

const sampleImplementationState: ImplementationStateResponse = {
  id: 'state-1',
  blueprintId: 'bp-123',
  organizationId: 'org-1',
  stateData: {
    schema_version: '1.0',
    blueprint_id: 'bp-123',
    last_updated: '2026-03-20T12:00:00Z',
    overall_status: 'in_progress',
    platform: { name: 'ServiceNow', version: 'Australia', environment: 'dev' },
    agents: [
      {
        name: 'Test Agent',
        status: 'implemented',
        platform_artifact: 'sys_id:abc123',
        deviations: ['Used Flow Designer instead of Workflow'],
        integrations_connected: ['CMDB', 'Service Portal'],
        notes: 'Working well',
      },
    ],
    architecture: {
      pattern: 'Supervisor',
      deviations: [],
      additional_components: ['Custom REST API'],
    },
    metrics_observed: [],
  },
  schemaVersion: '1.0',
  syncedAt: '2026-03-20T12:00:00Z',
  syncedBy: 'cli',
  previousStateId: null,
};

const sampleProgress: ProgressResponse = {
  blueprintId: 'bp-123',
  blueprintTitle: 'Test Blueprint',
  targets: {
    operational: [{ name: 'Test Pass Rate', target: '99%', unit: '%', direction: 'higher_is_better' }],
    financial: [{ name: 'ROI', value: '285%', unit: '%', direction: 'higher_is_better' }],
  },
  actuals: [
    {
      id: 'metric-1',
      metricName: 'Test Pass Rate',
      metricType: 'operational',
      predictedValue: '99%',
      actualValue: '94%',
      deviationPercent: -5.05,
      status: 'minor_deviation',
      recordedAt: '2026-03-18T10:00:00Z',
      dataSource: 'manual',
      recordingCount: 3,
    },
  ],
  summary: {
    totalTargets: 2,
    metricsRecorded: 1,
    onTrack: 0,
    minorDeviation: 1,
    majorDeviation: 0,
  },
  implementationState: {
    overallStatus: 'in_progress',
    agentCount: 1,
    implementedCount: 1,
    lastSyncedAt: '2026-03-20T12:00:00Z',
  },
};

const twoAgentState: ImplementationStateResponse = {
  ...sampleImplementationState,
  stateData: {
    ...sampleImplementationState.stateData as Record<string, unknown>,
    agents: [
      {
        name: 'Test Agent',
        status: 'implemented',
        platform_artifact: 'sys_id:abc123',
        deviations: ['Used Flow Designer instead of Workflow'],
        integrations_connected: ['CMDB'],
        notes: '',
      },
      {
        name: 'Second Agent',
        status: 'not_started',
        platform_artifact: '',
        deviations: [],
        integrations_connected: [],
        notes: '',
      },
    ],
  },
};

describe('renderSkillDirectory with no reality data', () => {
  it('produces 13 files with null implementationState and progress', () => {
    const input: SkillRenderInput = {
      ...minimalInput,
      implementationState: null,
      progress: null,
    };
    const files = renderSkillDirectory(input);
    expect(files.size).toBe(15);
    expect(files.has('CURRENT-STATE.md')).toBe(false);
    expect(files.has('RECOMMENDATIONS.md')).toBe(false);
  });

  it('produces 13 files with undefined implementationState', () => {
    const input: SkillRenderInput = { ...minimalInput };
    const files = renderSkillDirectory(input);
    expect(files.size).toBe(15);
  });

  it('treats all-not_started state as no data', () => {
    const input: SkillRenderInput = {
      ...minimalInput,
      implementationState: {
        ...sampleImplementationState,
        stateData: {
          ...sampleImplementationState.stateData as Record<string, unknown>,
          agents: [{ name: 'Test Agent', status: 'not_started', platform_artifact: '', deviations: [], integrations_connected: [], notes: '' }],
        },
      },
    };
    const files = renderSkillDirectory(input);
    expect(files.size).toBe(15);
    expect(files.has('CURRENT-STATE.md')).toBe(false);
    expect(files.has('RECOMMENDATIONS.md')).toBe(false);
  });

  it('treats empty progress actuals as no data', () => {
    const input: SkillRenderInput = {
      ...minimalInput,
      progress: { ...sampleProgress, actuals: [], summary: { ...sampleProgress.summary, metricsRecorded: 0, onTrack: 0, minorDeviation: 0, majorDeviation: 0 } },
    };
    const files = renderSkillDirectory(input);
    expect(files.size).toBe(15);
    expect(files.has('RECOMMENDATIONS.md')).toBe(false);
  });
});

describe('renderSkillDirectory with implementation state only', () => {
  const stateOnlyInput: SkillRenderInput = {
    ...minimalInput,
    implementationState: sampleImplementationState,
  };

  it('produces 17 files (15 + CURRENT-STATE.md + RECOMMENDATIONS.md)', () => {
    const files = renderSkillDirectory(stateOnlyInput);
    expect(files.size).toBe(17);
    expect(files.has('CURRENT-STATE.md')).toBe(true);
    expect(files.has('RECOMMENDATIONS.md')).toBe(true);
  });

  it('CURRENT-STATE.md contains agent status table', () => {
    const files = renderSkillDirectory(stateOnlyInput);
    const state = files.get('CURRENT-STATE.md')!;
    expect(state).toContain('## Agent Implementation Status');
    expect(state).toContain('Test Agent');
    expect(state).toContain('implemented');
    expect(state).toContain('sys_id:abc123');
  });

  it('CURRENT-STATE.md contains platform comparison', () => {
    const files = renderSkillDirectory(stateOnlyInput);
    const state = files.get('CURRENT-STATE.md')!;
    expect(state).toContain('## Platform');
    expect(state).toContain('ServiceNow');
    expect(state).toContain('Australia');
  });

  it('CURRENT-STATE.md contains deviations', () => {
    const files = renderSkillDirectory(stateOnlyInput);
    const state = files.get('CURRENT-STATE.md')!;
    expect(state).toContain('Flow Designer');
  });

  it('CURRENT-STATE.md contains integrations', () => {
    const files = renderSkillDirectory(stateOnlyInput);
    const state = files.get('CURRENT-STATE.md')!;
    expect(state).toContain('## Integrations Connected');
    expect(state).toContain('CMDB');
    expect(state).toContain('Service Portal');
  });

  it('CURRENT-STATE.md contains additional components', () => {
    const files = renderSkillDirectory(stateOnlyInput);
    const state = files.get('CURRENT-STATE.md')!;
    expect(state).toContain('## Additional Components');
    expect(state).toContain('Custom REST API');
  });

  it('CURRENT-STATE.md does not contain Performance section without progress', () => {
    const files = renderSkillDirectory(stateOnlyInput);
    const state = files.get('CURRENT-STATE.md')!;
    expect(state).not.toContain('## Performance Against Targets');
  });

  it('GETTING-STARTED.md is return-visit format', () => {
    const files = renderSkillDirectory(stateOnlyInput);
    const guide = files.get('GETTING-STARTED.md')!;
    expect(guide).toContain('CONTINUING AN IMPLEMENTATION');
    expect(guide).toContain('CURRENT-STATE.md');
    expect(guide).toContain('RECOMMENDATIONS.md');
  });

  it('return-visit Step 5 has MCP tool examples', () => {
    const files = renderSkillDirectory(stateOnlyInput);
    const guide = files.get('GETTING-STARTED.md')!;
    expect(guide).toContain('sync_implementation_state');
    expect(guide).toContain('report_metric');
  });

  it('return-visit Step 5 references AGENTS.md', () => {
    const files = renderSkillDirectory(stateOnlyInput);
    const guide = files.get('GETTING-STARTED.md')!;
    expect(guide).toContain('AGENTS.md');
  });

  it('return-visit Step 5 references hooks config', () => {
    const files = renderSkillDirectory(stateOnlyInput);
    const guide = files.get('GETTING-STARTED.md')!;
    expect(guide).toContain('hooks/claude-code-sync.json');
  });

  it('RECOMMENDATIONS.md contains deviation review', () => {
    const files = renderSkillDirectory(stateOnlyInput);
    const recs = files.get('RECOMMENDATIONS.md')!;
    expect(recs).toContain('## Deviations to Review');
    expect(recs).toContain('Flow Designer');
  });

  it('evaluation-criteria.md is unchanged without progress', () => {
    const files = renderSkillDirectory(stateOnlyInput);
    const evalCriteria = files.get('references/evaluation-criteria.md')!;
    expect(evalCriteria).not.toContain('| Actual |');
    expect(evalCriteria).not.toContain('| Status |');
  });
});

describe('renderSkillDirectory with progress only', () => {
  const progressOnlyInput: SkillRenderInput = {
    ...minimalInput,
    progress: sampleProgress,
  };

  it('produces 16 files (15 + RECOMMENDATIONS.md, no CURRENT-STATE.md)', () => {
    const files = renderSkillDirectory(progressOnlyInput);
    expect(files.size).toBe(16);
    expect(files.has('RECOMMENDATIONS.md')).toBe(true);
    expect(files.has('CURRENT-STATE.md')).toBe(false);
  });

  it('GETTING-STARTED.md is first-visit format', () => {
    const files = renderSkillDirectory(progressOnlyInput);
    const guide = files.get('GETTING-STARTED.md')!;
    expect(guide).not.toContain('CONTINUING AN IMPLEMENTATION');
    expect(guide).toContain('YOU ARE THE IMPLEMENTER');
  });

  it('evaluation-criteria.md is enriched with Actual columns', () => {
    const files = renderSkillDirectory(progressOnlyInput);
    const evalCriteria = files.get('references/evaluation-criteria.md')!;
    expect(evalCriteria).toContain('| Actual |');
    expect(evalCriteria).toContain('94%');
    expect(evalCriteria).toContain('minor_deviation');
  });

  it('RECOMMENDATIONS.md contains metric deviation', () => {
    const files = renderSkillDirectory(progressOnlyInput);
    const recs = files.get('RECOMMENDATIONS.md')!;
    expect(recs).toContain('## Metrics Requiring Attention');
    expect(recs).toContain('Test Pass Rate');
    expect(recs).toContain('minor_deviation');
  });
});

describe('renderSkillDirectory with full reality data', () => {
  const fullRealityInput: SkillRenderInput = {
    ...fullInput,
    implementationState: twoAgentState,
    progress: sampleProgress,
  };

  it('produces 17 files', () => {
    const files = renderSkillDirectory(fullRealityInput);
    expect(files.size).toBe(17);
    expect(files.has('CURRENT-STATE.md')).toBe(true);
    expect(files.has('RECOMMENDATIONS.md')).toBe(true);
  });

  it('CURRENT-STATE.md includes performance table', () => {
    const files = renderSkillDirectory(fullRealityInput);
    const state = files.get('CURRENT-STATE.md')!;
    expect(state).toContain('## Performance Against Targets');
    expect(state).toContain('Test Pass Rate');
    expect(state).toContain('94%');
  });

  it('CURRENT-STATE.md shows agent count summary', () => {
    const files = renderSkillDirectory(fullRealityInput);
    const state = files.get('CURRENT-STATE.md')!;
    expect(state).toContain('1 of 2 agents implemented');
  });

  it('RECOMMENDATIONS.md contains both agent and metric recommendations', () => {
    const files = renderSkillDirectory(fullRealityInput);
    const recs = files.get('RECOMMENDATIONS.md')!;
    expect(recs).toContain('## Next Agents to Implement');
    expect(recs).toContain('Second Agent');
    expect(recs).toContain('## Metrics Requiring Attention');
    expect(recs).toContain('Test Pass Rate');
  });

  it('RECOMMENDATIONS.md includes financial impact note with business case', () => {
    const files = renderSkillDirectory(fullRealityInput);
    const recs = files.get('RECOMMENDATIONS.md')!;
    expect(recs).toContain('## Financial Impact Note');
    expect(recs).toContain('285%');
  });

  it('GETTING-STARTED.md is return-visit format with metrics summary', () => {
    const files = renderSkillDirectory(fullRealityInput);
    const guide = files.get('GETTING-STARTED.md')!;
    expect(guide).toContain('CONTINUING AN IMPLEMENTATION');
    expect(guide).toContain('1 of 2 agents implemented');
    expect(guide).toContain('minor deviation');
  });

  it('evaluation-criteria.md is enriched with actuals', () => {
    const files = renderSkillDirectory(fullRealityInput);
    const evalCriteria = files.get('references/evaluation-criteria.md')!;
    expect(evalCriteria).toContain('| Actual |');
    expect(evalCriteria).toContain('94%');
  });
});

describe('RECOMMENDATIONS.md ordering', () => {
  it('in-progress agents show as "Continue"', () => {
    const input: SkillRenderInput = {
      ...minimalInput,
      blueprintData: {
        ...minimalInput.blueprintData,
        enhancedDigitalTeam: [
          { name: 'Agent A', role: 'Tester', agentRole: 'Worker' },
          { name: 'Agent B', role: 'Builder', agentRole: 'Worker' },
        ],
      },
      implementationState: {
        ...sampleImplementationState,
        stateData: {
          ...sampleImplementationState.stateData as Record<string, unknown>,
          agents: [
            { name: 'Agent A', status: 'in_progress', platform_artifact: '', deviations: [], integrations_connected: [], notes: '' },
            { name: 'Agent B', status: 'not_started', platform_artifact: '', deviations: [], integrations_connected: [], notes: '' },
          ],
        },
      },
    };
    const files = renderSkillDirectory(input);
    const recs = files.get('RECOMMENDATIONS.md')!;
    expect(recs).toContain('Continue Agent A');
    expect(recs).toContain('Implement Agent B');
  });

  it('major deviations before minor in metrics', () => {
    const input: SkillRenderInput = {
      ...minimalInput,
      progress: {
        ...sampleProgress,
        actuals: [
          { id: 'm1', metricName: 'Minor Metric', metricType: 'operational', predictedValue: '90%', actualValue: '80%', deviationPercent: -11.1, status: 'minor_deviation', recordedAt: '2026-03-18T10:00:00Z', dataSource: 'manual', recordingCount: 1 },
          { id: 'm2', metricName: 'Major Metric', metricType: 'operational', predictedValue: '95%', actualValue: '60%', deviationPercent: -36.8, status: 'major_deviation', recordedAt: '2026-03-18T10:00:00Z', dataSource: 'manual', recordingCount: 1 },
        ],
        summary: { totalTargets: 2, metricsRecorded: 2, onTrack: 0, minorDeviation: 1, majorDeviation: 1 },
      },
    };
    const files = renderSkillDirectory(input);
    const recs = files.get('RECOMMENDATIONS.md')!;
    const majorIdx = recs.indexOf('Major Metric');
    const minorIdx = recs.indexOf('Minor Metric');
    expect(majorIdx).toBeLessThan(minorIdx);
  });
});

describe('graceful degradation', () => {
  it('handles null fields in stateData without crashing', () => {
    const input: SkillRenderInput = {
      ...minimalInput,
      implementationState: {
        ...sampleImplementationState,
        stateData: {
          overall_status: 'in_progress',
          agents: [{ name: 'Agent', status: 'implemented', platform_artifact: null, deviations: null, integrations_connected: null, notes: null }],
          platform: null,
          architecture: null,
        } as any,
      },
    };
    // Should not throw
    const files = renderSkillDirectory(input);
    expect(files.has('CURRENT-STATE.md')).toBe(true);
    expect(files.has('RECOMMENDATIONS.md')).toBe(true);
  });

  it('all plan files still present with reality data', () => {
    const input: SkillRenderInput = {
      ...minimalInput,
      implementationState: sampleImplementationState,
      progress: sampleProgress,
    };
    const files = renderSkillDirectory(input);
    expect(files.has('SKILL.md')).toBe(true);
    expect(files.has('references/agent-specifications.md')).toBe(true);
    expect(files.has('references/financial-case.md')).toBe(true);
    expect(files.has('references/implementation-roadmap.md')).toBe(true);
    expect(files.has('GETTING-STARTED.md')).toBe(true);
    expect(files.has('implementation-state.yaml')).toBe(true);
  });

  it('RECOMMENDATIONS.md shows all-clear when everything is on track', () => {
    const input: SkillRenderInput = {
      ...minimalInput,
      implementationState: {
        ...sampleImplementationState,
        stateData: {
          ...sampleImplementationState.stateData as Record<string, unknown>,
          agents: [{ name: 'Test Agent', status: 'implemented', platform_artifact: 'x', deviations: [], integrations_connected: [], notes: '' }],
        },
      },
      progress: {
        ...sampleProgress,
        actuals: [
          { id: 'm1', metricName: 'Test Pass Rate', metricType: 'operational', predictedValue: '99%', actualValue: '99.5%', status: 'on_track', recordedAt: '2026-03-18T10:00:00Z', dataSource: 'manual', recordingCount: 1 },
        ],
        summary: { totalTargets: 1, metricsRecorded: 1, onTrack: 1, minorDeviation: 0, majorDeviation: 0 },
      },
    };
    const files = renderSkillDirectory(input);
    const recs = files.get('RECOMMENDATIONS.md')!;
    expect(recs).toContain('All agents implemented and metrics on track');
  });
});

// =============================================================================
// Multi-file skill delivery tests
// =============================================================================

describe('base skill support', () => {
  const baseSkillInput: SkillRenderInput = {
    ...minimalInput,
    baseSkill: {
      files: [
        { path: 'SKILL.md', content: '# Base Skill\nDeployment patterns.' },
        { path: 'references/DEPLOYMENT_PATTERNS.md', content: '# Deployment Patterns\nContent here.' },
      ],
    },
  };

  it('writes base skill files to .claude/skills/agent-blueprint/', () => {
    const files = renderSkillDirectory(baseSkillInput);
    expect(files.has('.claude/skills/agent-blueprint/SKILL.md')).toBe(true);
    expect(files.has('.claude/skills/agent-blueprint/references/DEPLOYMENT_PATTERNS.md')).toBe(true);
    expect(files.get('.claude/skills/agent-blueprint/SKILL.md')).toContain('Base Skill');
    expect(files.get('.claude/skills/agent-blueprint/references/DEPLOYMENT_PATTERNS.md')).toContain('Deployment Patterns');
  });

  it('increases file count by number of base skill files', () => {
    const files = renderSkillDirectory(baseSkillInput);
    expect(files.size).toBe(17); // 15 base + 2 base skill files
  });

  it('SKILL.md body mentions base skill location', () => {
    const files = renderSkillDirectory(baseSkillInput);
    const skill = files.get('SKILL.md')!;
    expect(skill).toContain('.claude/skills/agent-blueprint/');
  });

  it('GETTING-STARTED.md mentions base skill', () => {
    const files = renderSkillDirectory(baseSkillInput);
    const guide = files.get('GETTING-STARTED.md')!;
    expect(guide).toContain('.claude/skills/agent-blueprint/');
  });

  it('return-visit GETTING-STARTED.md mentions base skill', () => {
    const input: SkillRenderInput = {
      ...baseSkillInput,
      implementationState: sampleImplementationState,
    };
    const files = renderSkillDirectory(input);
    const guide = files.get('GETTING-STARTED.md')!;
    expect(guide).toContain('.claude/skills/agent-blueprint/');
  });
});

describe('multi-file vendor skill support', () => {
  const multiFileVendorInput: SkillRenderInput = {
    ...minimalInput,
    vendorSkill: {
      platform: 'servicenow',
      skillName: 'agent-blueprint-servicenow',
      content: '# SN Skill\nMain content.',
      files: [
        { path: 'SKILL.md', content: '# SN Skill\nMain content.' },
        { path: 'references/LESSONS.md', content: '# Lessons\nLesson content.' },
        { path: 'references/PLATFORM_REFERENCE.md', content: '# Platform Reference\nRef content.' },
      ],
    },
  };

  it('writes all vendor skill files from files array', () => {
    const files = renderSkillDirectory(multiFileVendorInput);
    expect(files.has('.claude/skills/agent-blueprint-servicenow/SKILL.md')).toBe(true);
    expect(files.has('.claude/skills/agent-blueprint-servicenow/references/LESSONS.md')).toBe(true);
    expect(files.has('.claude/skills/agent-blueprint-servicenow/references/PLATFORM_REFERENCE.md')).toBe(true);
  });

  it('vendor skill file contents are correct', () => {
    const files = renderSkillDirectory(multiFileVendorInput);
    expect(files.get('.claude/skills/agent-blueprint-servicenow/SKILL.md')).toContain('SN Skill');
    expect(files.get('.claude/skills/agent-blueprint-servicenow/references/LESSONS.md')).toContain('Lesson content');
  });

  it('falls back to single SKILL.md when no files array', () => {
    const input: SkillRenderInput = {
      ...minimalInput,
      vendorSkill: {
        platform: 'servicenow',
        skillName: 'agent-blueprint-servicenow',
        content: '# SN Skill\nFallback content.',
      },
    };
    const files = renderSkillDirectory(input);
    expect(files.has('.claude/skills/agent-blueprint-servicenow/SKILL.md')).toBe(true);
    expect(files.get('.claude/skills/agent-blueprint-servicenow/SKILL.md')).toContain('Fallback content');
  });

  it('uses new skill name in SKILL.md body', () => {
    const files = renderSkillDirectory(multiFileVendorInput);
    const skill = files.get('SKILL.md')!;
    expect(skill).toContain('agent-blueprint-servicenow');
  });

  it('both base skill and vendor skill coexist', () => {
    const input: SkillRenderInput = {
      ...minimalInput,
      baseSkill: {
        files: [
          { path: 'SKILL.md', content: '# Base Skill' },
        ],
      },
      vendorSkill: {
        platform: 'servicenow',
        skillName: 'agent-blueprint-servicenow',
        content: '# SN Skill',
        files: [
          { path: 'SKILL.md', content: '# SN Skill' },
          { path: 'references/LESSONS.md', content: '# Lessons' },
        ],
      },
    };
    const files = renderSkillDirectory(input);
    expect(files.has('.claude/skills/agent-blueprint/SKILL.md')).toBe(true);
    expect(files.has('.claude/skills/agent-blueprint-servicenow/SKILL.md')).toBe(true);
    expect(files.has('.claude/skills/agent-blueprint-servicenow/references/LESSONS.md')).toBe(true);
  });
});
