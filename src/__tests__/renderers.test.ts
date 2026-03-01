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
        pilotROI: {
          pilotCost: '$50,000',
          pilotBenefit: '$80,000',
          pilotROI: '60%',
          pilotDuration: '3 months',
        },
        sensitivity: {
          conservative: { npv: '$300K', roi: '180%', paybackPeriod: '12 months' },
          realistic: { npv: '$450K', roi: '285%', paybackPeriod: '8 months' },
          optimistic: { npv: '$600K', roi: '380%', paybackPeriod: '5 months' },
        },
        fiveYearProjection: [
          { year: 'Year 1', investment: '$200K', value: '$100K', netCashFlow: '-$100K', cumulative: '-$100K' },
          { year: 'Year 2', investment: '$50K', value: '$250K', netCashFlow: '$200K', cumulative: '$100K' },
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
    expect(paths).toContain('references/agent-specifications.md');
    expect(paths).toContain('references/financial-case.md');
    expect(paths).toContain('references/implementation-roadmap.md');
    expect(paths).toContain('references/architecture-decisions.md');
    expect(paths).toContain('references/guardrails-and-governance.md');
    expect(paths).toContain('scripts/validate-spec.sh');
    expect(files.size).toBe(8);
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
    expect(financial).toContain('## Five-Year Projection');
    expect(financial).toContain('## Pilot Economics');
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
    expect(files.size).toBe(8);
  });
});
