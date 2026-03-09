import { describe, it, expect } from 'vitest';

import { renderSkillDirectory, slugify } from '../renderers.js';
import type { SkillRenderInput } from '../renderers.js';

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
    expect(paths).toContain('scripts/validate-spec.sh');
    expect(files.size).toBe(9);
  });

  it('SKILL.md starts with YAML frontmatter', () => {
    const files = renderSkillDirectory(minimalInput);
    const skill = files.get('SKILL.md')!;

    expect(skill.startsWith('---\n')).toBe(true);
    expect(skill).toContain('name: test-blueprint');
    expect(skill).toContain('blueprint-id: "bp-123"');
    expect(skill).toContain('platform: "ServiceNow"');
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
    expect(files.size).toBe(9);
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
