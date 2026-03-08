// =============================================================================
// Agent Skills directory renderer
// Ported from implementation-spec-export.service.ts (main app)
// Converts blueprint + business case + implementation plan + use case JSON
// into a Map<string, string> of { relativePath → fileContent }
// =============================================================================

export interface SkillRenderInput {
  blueprintTitle: string;
  blueprintId: string;
  organizationName?: string;
  blueprintData: Record<string, unknown>;
  businessCaseData?: Record<string, unknown>;
  implementationPlanData?: Record<string, unknown>;
  useCaseData?: Record<string, unknown>;
  businessProfileData?: Record<string, unknown>;
}

// =============================================================================
// HELPERS
// =============================================================================

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function str(val: unknown): string {
  return typeof val === 'string' ? val : '';
}

function arr(val: unknown): any[] {
  return Array.isArray(val) ? val : [];
}

function rec(val: unknown): Record<string, unknown> {
  return val && typeof val === 'object' && !Array.isArray(val) ? (val as Record<string, unknown>) : {};
}

/** Returns string representation for numbers, passes through strings, '' otherwise */
function numStr(val: unknown): string {
  if (typeof val === 'number') return String(val);
  if (typeof val === 'string') return val;
  return '';
}

/** Checks if a string value is a placeholder/garbage value that shouldn't be rendered */
function isPlaceholder(val: string): boolean {
  return ['—', '–', '-', 'N/A', 'n/a', 'TBD', 'null', 'undefined', 'none'].includes(val.trim());
}

/** Strips a trailing unit suffix to prevent double-units (e.g. "3.6 months" + " months") */
function stripTrailingUnit(val: string, unit: string): string {
  return val.replace(new RegExp(`\\s*${unit}\\s*$`, 'i'), '');
}

/** Joins string arrays with separator; returns '' for non-arrays */
function arrStr(val: unknown, sep = ', '): string {
  return Array.isArray(val) ? val.filter((v) => typeof v === 'string').join(sep) : '';
}

function getPlatformName(bp: Record<string, unknown>): string {
  const pr = rec(bp.platformRecommendation);
  const pp = rec(pr.primaryPlatform);
  return str(pp.name) || 'Vendor-Agnostic';
}

function getAgenticPattern(bp: Record<string, unknown>): string {
  return str(bp.agenticPattern) || 'Multi-Agent';
}

function getTeam(bp: Record<string, unknown>): Record<string, unknown>[] {
  return arr(bp.enhancedDigitalTeam).filter(
    (a): a is Record<string, unknown> => !!a && typeof a === 'object'
  );
}

function getInvestmentTier(bc: Record<string, unknown> | undefined): string {
  if (!bc) return 'unknown';
  const es = rec(bc.executiveSummary);
  const ask = rec(es.ask);
  const amount = str(ask.investmentAmount);
  if (!amount) return 'unknown';
  // Extract the first number group only (avoid concatenating multiple numbers
  // e.g. "$13,143 one-time + $2,981 annual" → 13143, not 131432981)
  const match = amount.match(/[\d,]+(?:\.\d+)?/);
  if (!match) return 'unknown';
  const num = parseFloat(match[0].replace(/,/g, ''));
  if (isNaN(num)) return 'unknown';
  if (num < 100000) return 'low';
  if (num < 500000) return 'medium';
  return 'high';
}

// =============================================================================
// SKILL.md — FRONTMATTER
// =============================================================================

function buildSkillFrontmatter(input: SkillRenderInput): string {
  const bp = input.blueprintData;
  const team = getTeam(bp);
  const platform = getPlatformName(bp);
  const pattern = getAgenticPattern(bp);
  const slug = slugify(input.blueprintTitle) || 'implementation-spec';

  const lines = [
    '---',
    `name: ${slug}`,
    'description: >-',
    `  Implementation specification for ${input.blueprintTitle}. ${team.length} AI agents,`,
    `  ${pattern} pattern, targeting ${platform}.`,
    'compatibility: Any coding agent (Claude Code, Codex, Cursor).',
    'metadata:',
    '  generated-by: agent-blueprint',
    `  generated-at: "${new Date().toISOString()}"`,
    `  blueprint-id: "${input.blueprintId}"`,
    `  platform: "${platform}"`,
    `  agent-count: "${team.length}"`,
    `  pattern: "${pattern}"`,
    `  investment-tier: "${getInvestmentTier(input.businessCaseData)}"`,
    '---',
  ];
  return lines.join('\n');
}

// =============================================================================
// SKILL.md — BODY
// =============================================================================

function buildSkillBody(input: SkillRenderInput): string {
  const bp = input.blueprintData;
  const bc = input.businessCaseData;
  const team = getTeam(bp);
  const platform = getPlatformName(bp);
  const pattern = getAgenticPattern(bp);
  const execSummary = str(bp.executiveSummary);

  const lines: string[] = [];

  // Overview
  lines.push('# Implementation Specification', '');
  lines.push(`> ${execSummary || input.blueprintTitle}`, '');

  // Business Problem
  lines.push('## Business Problem', '');
  if (input.useCaseData) {
    const uc = input.useCaseData;
    if (str(uc.businessChallenge)) {
      lines.push(str(uc.businessChallenge), '');
    } else if (str(uc.description)) {
      lines.push(str(uc.description), '');
    }
    const painPoints = arr(uc.currentPainPoints);
    if (painPoints.length > 0) {
      lines.push('**Current pain points:**', '');
      for (const p of painPoints) lines.push(`- ${p}`);
      lines.push('');
    }
  } else {
    lines.push(execSummary || '_See references/business-context.md for details._', '');
  }

  // Solution Architecture
  lines.push('## Solution Architecture', '');
  lines.push(`- **Platform:** ${platform}`);
  lines.push(`- **Pattern:** ${pattern}`);
  lines.push(`- **Agents:** ${team.length}`, '');

  // Agent summary table
  lines.push('| # | Agent | Role | Type |');
  lines.push('|---|-------|------|------|');
  team.forEach((agent, i) => {
    const name = str(agent.name) || `Agent ${i + 1}`;
    const role = str(agent.role) || str(rec(agent.instructions).role) as string || str(agent.agentRole) || '';
    const type = str(agent.agentRole) || str(agent.orchestrationRole) || str(agent.type) || 'Worker';
    lines.push(`| ${i + 1} | ${name} | ${role} | ${type} |`);
  });
  lines.push('');
  lines.push('> Full agent specifications in `references/agent-specifications.md`', '');

  // Phase rendering — prefer implementation plan epics when available
  const ipEpics = input.implementationPlanData ? arr(rec(input.implementationPlanData).epics) : [];
  if (ipEpics.length > 0) {
    const pilotEpics = ipEpics.filter((e: any) => str(rec(e).phase).toLowerCase().includes('pilot'));
    const fullEpics = ipEpics.filter((e: any) => !str(rec(e).phase).toLowerCase().includes('pilot'));

    lines.push('## Phase 1: Pilot', '');
    if (pilotEpics.length > 0) {
      const seen = new Set<string>();
      for (const epic of pilotEpics) {
        const e = rec(epic);
        const name = str(e.name);
        if (name && !seen.has(name)) {
          seen.add(name);
          lines.push(`- **${name}**${str(e.estimatedDuration) ? ` (${str(e.estimatedDuration)})` : ''}`);
        }
      }
      lines.push('');
    } else {
      lines.push('_No pilot epics defined. See `references/implementation-roadmap.md` for phasing._', '');
    }

    lines.push('## Phase 2: Full Implementation', '');
    if (fullEpics.length > 0) {
      const seen = new Set<string>();
      for (const epic of fullEpics) {
        const e = rec(epic);
        const name = str(e.name);
        if (name && !seen.has(name)) {
          seen.add(name);
          lines.push(`- **${name}**${str(e.estimatedDuration) ? ` (${str(e.estimatedDuration)})` : ''}`);
        }
      }
      lines.push('');
    } else {
      lines.push('_See `references/implementation-roadmap.md` for full rollout plan._', '');
    }
  } else {
    lines.push('## Phase 1: Pilot', '');
    const phases = arr(bp.phases);
    const pilotPhase = phases.find(
      (p: any) => str(p?.name).toLowerCase().includes('pilot') || str(p?.name).toLowerCase().includes('phase 1')
    );
    if (pilotPhase) {
      const p = rec(pilotPhase);
      if (str(p.phaseGoal)) lines.push(`**Goal:** ${str(p.phaseGoal)}`, '');
      if (p.durationWeeks) lines.push(`**Duration:** ${p.durationWeeks} weeks`);
      if (str(p.phaseCost)) lines.push(`**Cost target:** ${str(p.phaseCost)}`);
      lines.push('');

      const workstreams = arr(p.workstreams);
      if (workstreams.length > 0) {
        lines.push('**Pilot workstreams:**', '');
        for (const ws of workstreams) {
          const w = rec(ws);
          lines.push(`- ${str(w.title)}`);
        }
        lines.push('');
      }

      const gate = rec(p.decisionGate);
      if (gate.criteria) {
        lines.push('**Decision gate criteria:**', '');
        for (const c of arr(gate.criteria)) {
          const cr = rec(c);
          const label = str(cr.name) || str(cr.criterion) || str(cr.metric) || str(cr.description) || 'Unnamed criterion';
          lines.push(`- ${label}: ${str(cr.target) || str(cr.threshold)}`);
        }
        lines.push('');
      }

      const exitCriteria = arr(p.exitCriteria);
      if (exitCriteria.length > 0) {
        lines.push('**Exit criteria:**', '');
        for (const c of exitCriteria) lines.push(`- ${c}`);
        lines.push('');
      }
    } else {
      lines.push('_No pilot phase defined. See `references/implementation-roadmap.md` for phasing._', '');
    }

    lines.push('## Phase 2: Full Implementation', '');
    const fullPhases = phases.filter(
      (p: any) => !str(p?.name).toLowerCase().includes('pilot') && !str(p?.name).toLowerCase().includes('phase 1')
    );
    if (fullPhases.length > 0) {
      for (const phase of fullPhases) {
        const p = rec(phase);
        lines.push(`### ${str(p.name)}`, '');
        if (str(p.phaseGoal)) lines.push(str(p.phaseGoal), '');
        if (p.durationWeeks) lines.push(`**Duration:** ${p.durationWeeks} weeks`);
        if (str(p.phaseCost)) lines.push(`**Cost:** ${str(p.phaseCost)}`);
        lines.push('');
      }
    } else {
      lines.push('_See `references/implementation-roadmap.md` for full rollout plan._', '');
    }
  }

  // Financial Summary
  lines.push('## Financial Summary', '');
  if (bc) {
    const benefits = rec(bc.benefits);
    const quantifiedROI = rec(benefits.quantifiedROI);
    if (str(quantifiedROI.roi) && !isPlaceholder(str(quantifiedROI.roi))) lines.push(`- **ROI:** ${str(quantifiedROI.roi)}`);
    if (str(quantifiedROI.npv) && !isPlaceholder(str(quantifiedROI.npv))) lines.push(`- **NPV:** ${str(quantifiedROI.npv)}`);
    if (str(quantifiedROI.paybackPeriod) && !isPlaceholder(str(quantifiedROI.paybackPeriod))) lines.push(`- **Payback:** ${str(quantifiedROI.paybackPeriod)}`);

    const pilotROI = rec(quantifiedROI.pilotROI);
    const skillPilotCapex = str(rec(pilotROI.pilotCapex).value);
    const skillPilotSavings = str(rec(pilotROI.pilotAnnualSavings).value);
    const skillPilotYear1Net = str(rec(pilotROI.pilotYear1Net).value);
    if (skillPilotCapex || skillPilotSavings) {
      lines.push('');
      lines.push('**Pilot economics:**');
      if (skillPilotCapex) lines.push(`- Pilot capex: ${skillPilotCapex}`);
      if (skillPilotSavings) lines.push(`- Pilot annual savings: ${skillPilotSavings}`);
      if (skillPilotYear1Net) lines.push(`- Pilot Year 1 net: ${skillPilotYear1Net}`);
    }
    lines.push('');
    lines.push('> Full financial analysis in `references/financial-case.md`', '');
  } else {
    lines.push('_Generate a Business Case to enrich this section._', '');
  }

  // Agent Specifications Summary
  lines.push('## Agent Specifications Summary', '');
  for (const agent of team.slice(0, 5)) {
    const name = str(agent.name);
    const role = str(agent.role) || str(rec(agent.instructions).role) || '';
    lines.push(`- **${name}**: ${role}`);
  }
  if (team.length > 5) lines.push(`- _...and ${team.length - 5} more agents_`);
  lines.push('');
  lines.push('> Full specifications in `references/agent-specifications.md`', '');

  // Risk & Governance Summary
  lines.push('## Risk & Governance Summary', '');
  const riskAssessment = rec(bp.riskAssessment);
  const techRisks = arr(riskAssessment.technicalRisks);
  const bizRisks = arr(riskAssessment.businessRisks);
  if (techRisks.length > 0 || bizRisks.length > 0) {
    if (techRisks.length > 0) {
      lines.push('**Technical risks:**', '');
      for (const r of techRisks.slice(0, 3)) lines.push(`- ${r}`);
      lines.push('');
    }
    if (bizRisks.length > 0) {
      lines.push('**Business risks:**', '');
      for (const r of bizRisks.slice(0, 3)) lines.push(`- ${r}`);
      lines.push('');
    }
  } else {
    lines.push('_See `references/guardrails-and-governance.md` for risk details._', '');
  }
  lines.push('> Full governance framework in `references/guardrails-and-governance.md`', '');

  // How to Use This Spec
  lines.push('## How to Use This Spec', '');
  lines.push('1. **Load this skill** into your coding agent (Claude Code, Codex, Cursor)');
  lines.push('2. **Review** the reference files for full context');
  lines.push('3. **Start with Phase 1** (Pilot) — implement the lead agent first');
  lines.push('4. **Use decision gates** to validate before expanding to full implementation');
  lines.push('5. **Reference `scripts/validate-spec.sh`** to verify spec completeness', '');

  // Generated By
  lines.push('---', '');
  lines.push('Generated by [Agent Blueprint](https://app.agentblueprint.ai)', '');

  return lines.join('\n');
}

// =============================================================================
// REFERENCE FILES
// =============================================================================

function buildBusinessContext(input: SkillRenderInput): string {
  const bp = input.blueprintData;
  const uc = input.useCaseData;
  const lines: string[] = ['# Business Context', ''];

  const execSummary = str(bp.executiveSummary);
  if (execSummary) {
    lines.push('## Executive Summary', '', execSummary, '');
  }

  if (uc) {
    if (str(uc.title)) lines.push(`## Use Case: ${str(uc.title)}`, '');
    if (str(uc.description)) lines.push(str(uc.description), '');

    const fiveWs = rec(uc.description5Ws);
    if (fiveWs.who || fiveWs.what) {
      lines.push('## Five Ws', '');
      if (str(fiveWs.who)) lines.push(`- **Who:** ${str(fiveWs.who)}`);
      if (str(fiveWs.what)) lines.push(`- **What:** ${str(fiveWs.what)}`);
      if (str(fiveWs.where)) lines.push(`- **Where:** ${str(fiveWs.where)}`);
      if (str(fiveWs.when)) lines.push(`- **When:** ${str(fiveWs.when)}`);
      if (str(fiveWs.why)) lines.push(`- **Why:** ${str(fiveWs.why)}`);
      lines.push('');
    }

    if (str(uc.businessChallenge)) {
      lines.push('## Business Challenge', '', str(uc.businessChallenge), '');
    }

    const painPoints = arr(uc.currentPainPoints);
    if (painPoints.length > 0) {
      lines.push('## Current Pain Points', '');
      for (const p of painPoints) lines.push(`- ${p}`);
      lines.push('');
    }

    const outcomes = arr(uc.desiredBusinessOutcomes);
    if (outcomes.length > 0) {
      lines.push('## Desired Business Outcomes', '');
      for (const o of outcomes) lines.push(`- ${o}`);
      lines.push('');
    }

    const procDoc = rec(uc.processDocumentation);
    const steps = arr(procDoc.steps);
    if (steps.length > 0) {
      lines.push('## Current Process', '');
      for (const step of steps) {
        const s = rec(step);
        lines.push(`${s.stepNumber || '-'}. ${str(s.description)} _(${str(s.performer) || 'Unknown'})_`);
      }
      lines.push('');
    }

    const ts = rec(uc.transformationStory);
    if (str(ts.situation)) {
      lines.push('## Transformation Story', '');
      lines.push(`**Situation:** ${str(ts.situation)}`);
      if (str(ts.complication)) lines.push(`**Complication:** ${str(ts.complication)}`);
      if (str(ts.resolution)) lines.push(`**Resolution:** ${str(ts.resolution)}`);
      lines.push('');
    }

    if (str(uc.strategicAlignment)) {
      lines.push('## Strategic Alignment', '', str(uc.strategicAlignment), '');
    }
  } else {
    lines.push('_Use case data not available. Generate a Use Case analysis to enrich this section._', '');
  }

  return lines.join('\n');
}

function buildOrganizationContext(input: SkillRenderInput): string {
  const bp = input.businessProfileData;
  const lines: string[] = ['# Organization Context', ''];

  if (!bp) {
    lines.push('_No business profile data available. Create a Business Profile to enrich this section._', '');
    return lines.join('\n');
  }

  // Company overview
  const companyName = str(bp.companyName);
  if (companyName) {
    lines.push(`## ${companyName}`, '');
  }
  if (str(bp.description)) lines.push(str(bp.description), '');

  // Industry & scale
  if (str(bp.industry) || str(bp.size) || str(bp.revenue)) {
    lines.push('## Industry & Scale', '');
    if (str(bp.industry)) lines.push(`- **Industry:** ${str(bp.industry)}`);
    if (str(bp.size)) lines.push(`- **Company size:** ${str(bp.size)}`);
    if (str(bp.revenue)) lines.push(`- **Revenue:** ${str(bp.revenue)}`);
    if (str(bp.currency) && str(bp.currency) !== 'USD') lines.push(`- **Currency:** ${str(bp.currency)}`);
    lines.push('');
  }

  // Technology profile
  const tech = rec(bp.technologyProfile);
  const systems = arr(tech.systems);
  const dataInfra = rec(tech.dataInfrastructure);
  const integration = rec(tech.integrationCapabilities);
  const security = rec(tech.securityCompliance);

  if (systems.length > 0 || dataInfra.cloudPlatforms || dataInfra.dataWarehouseExists !== undefined || integration.apiReadiness || integration.apiMaturity) {
    lines.push('## Technology Landscape', '');

    if (systems.length > 0) {
      lines.push('### Current Systems', '');
      lines.push('| System | Category | Criticality |');
      lines.push('|--------|----------|-------------|');
      for (const sys of systems) {
        const s = rec(sys);
        lines.push(`| ${str(s.name)} | ${str(s.category)} | ${str(s.criticality) || str(s.businessCriticality)} |`);
      }
      lines.push('');
    }

    const cloudPlatforms = arrStr(dataInfra.cloudPlatforms);
    if (cloudPlatforms || dataInfra.dataWarehouseExists !== undefined || str(dataInfra.cloudProvider)) {
      lines.push('### Data Infrastructure', '');
      if (cloudPlatforms) lines.push(`- **Cloud platforms:** ${cloudPlatforms}`);
      else if (str(dataInfra.cloudProvider)) lines.push(`- **Cloud provider:** ${str(dataInfra.cloudProvider)}`);
      if (dataInfra.dataWarehouseExists !== undefined) lines.push(`- **Data warehouse:** ${dataInfra.dataWarehouseExists ? 'Yes' : 'No'}`);
      if (dataInfra.dataLakeExists !== undefined) lines.push(`- **Data lake:** ${dataInfra.dataLakeExists ? 'Yes' : 'No'}`);
      if (str(dataInfra.dataGovernanceMaturity)) lines.push(`- **Data governance maturity:** ${str(dataInfra.dataGovernanceMaturity)}`);
      else if (str(dataInfra.dataQuality)) lines.push(`- **Data quality:** ${str(dataInfra.dataQuality)}`);
      lines.push('');
    }

    const apiReadiness = str(integration.apiReadiness) || str(integration.apiMaturity);
    const currentIntegrations = arrStr(integration.currentIntegrations);
    if (apiReadiness || currentIntegrations || str(integration.integrationPatterns)) {
      lines.push('### Integration Capabilities', '');
      if (apiReadiness) lines.push(`- **API readiness:** ${apiReadiness}`);
      if (currentIntegrations) lines.push(`- **Current integrations:** ${currentIntegrations}`);
      else if (str(integration.integrationPatterns)) lines.push(`- **Integration patterns:** ${str(integration.integrationPatterns)}`);
      if (str(integration.integrationPlatform) && !isPlaceholder(str(integration.integrationPlatform))) lines.push(`- **Integration platform:** ${str(integration.integrationPlatform)}`);
      else if (str(integration.middlewarePlatforms) && !isPlaceholder(str(integration.middlewarePlatforms))) lines.push(`- **Middleware:** ${str(integration.middlewarePlatforms)}`);
      lines.push('');
    }

    const complianceCerts = arrStr(security.complianceCertifications);
    const privacyMeasures = arrStr(security.dataPrivacyMeasures);
    if (complianceCerts || privacyMeasures || str(security.complianceFrameworks) || str(security.dataPrivacy)) {
      lines.push('### Security & Compliance', '');
      if (complianceCerts) lines.push(`- **Compliance certifications:** ${complianceCerts}`);
      else if (str(security.complianceFrameworks)) lines.push(`- **Compliance frameworks:** ${str(security.complianceFrameworks)}`);
      if (privacyMeasures) lines.push(`- **Data privacy measures:** ${privacyMeasures}`);
      else if (str(security.dataPrivacy)) lines.push(`- **Data privacy:** ${str(security.dataPrivacy)}`);
      lines.push('');
    }
  }

  // Business operations
  const ops = rec(bp.businessOperations);
  const keyProcesses = arr(ops.keyProcesses);
  const painPoints = arr(ops.painPoints);
  const stakeholders = arr(ops.stakeholders);

  if (keyProcesses.length > 0 || painPoints.length > 0) {
    lines.push('## Business Operations', '');

    if (keyProcesses.length > 0) {
      lines.push('### Key Processes', '');
      for (const proc of keyProcesses) {
        const p = rec(proc);
        const name = str(p.name) || str(p.processName);
        const volume = str(p.volume) || str(p.transactionVolume);
        if (name) {
          lines.push(`- **${name}**${volume ? ` (${volume})` : ''}`);
          if (str(p.frequency)) lines.push(`  - Frequency: ${str(p.frequency)}`);
          if (str(p.automationLevel)) lines.push(`  - Automation level: ${str(p.automationLevel)}`);
        }
      }
      lines.push('');
    }

    if (painPoints.length > 0) {
      lines.push('### Operational Pain Points', '');
      for (const pp of painPoints) {
        if (typeof pp === 'string') {
          lines.push(`- ${pp}`);
        } else {
          const p = rec(pp);
          const desc = str(p.description) || str(p.painPoint);
          if (desc) lines.push(`- ${desc}${str(p.severity) ? ` _(${str(p.severity)})_` : ''}`);
        }
      }
      lines.push('');
    }

    if (stakeholders.length > 0) {
      lines.push('### Key Stakeholders', '');
      for (const sh of stakeholders) {
        const s = rec(sh);
        const role = str(s.role) || str(s.title);
        const name = str(s.name);
        if (role || name) lines.push(`- **${role || name}**${name && role ? ` — ${name}` : ''}`);
      }
      lines.push('');
    }
  }

  // Organizational capabilities
  const caps = rec(bp.organizationalCapabilities);
  const technicalTeam = rec(caps.technicalTeam);
  const currentAutomation = rec(caps.currentAutomation);

  const devCapacity = numStr(technicalTeam.developmentCapacity);
  if (devCapacity || str(technicalTeam.size) || str(currentAutomation.level)) {
    lines.push('## Organizational Capabilities', '');
    if (devCapacity) lines.push(`- **Development capacity:** ${devCapacity} FTEs`);
    else if (str(technicalTeam.size)) lines.push(`- **Technical team size:** ${str(technicalTeam.size)}`);
    if (str(technicalTeam.aiMlExperience)) lines.push(`- **AI/ML experience:** ${str(technicalTeam.aiMlExperience)}`);
    else if (str(technicalTeam.aiExperience)) lines.push(`- **AI experience:** ${str(technicalTeam.aiExperience)}`);
    if (str(currentAutomation.level)) lines.push(`- **Current automation level:** ${str(currentAutomation.level)}`);
    const automatedProcesses = arrStr(currentAutomation.automatedProcesses);
    if (automatedProcesses) lines.push(`- **Automated processes:** ${automatedProcesses}`);
    else if (str(currentAutomation.tools)) lines.push(`- **Automation tools:** ${str(currentAutomation.tools)}`);
    lines.push('');
  }

  // Constraints
  const constraints = rec(bp.constraintsProfile);
  const budget = rec(constraints.budget);
  const timeline = rec(constraints.timeline);
  const technical = rec(constraints.technical);
  const regulatory = rec(constraints.regulatory);

  const totalBudget = str(budget.totalAiBudget) || str(budget.totalBudget);
  const annualBudget = str(budget.annualOpexAvailable) || str(budget.annualBudget);
  const deadlines = arrStr(timeline.criticalDeadlines);
  const rolloutTimeline = str(timeline.fullRolloutTimeline) || str(timeline.preferredTimeline);
  const legacyConstraints = arrStr(technical.legacySystemConstraints);
  const regulations = arrStr(regulatory.industryRegulations);
  if (totalBudget || deadlines || str(timeline.deadline) || regulations || str(regulatory.requirements)) {
    lines.push('## Constraints', '');
    if (totalBudget) lines.push(`- **Budget:** ${totalBudget}`);
    if (annualBudget) lines.push(`- **Annual budget:** ${annualBudget}`);
    if (deadlines) lines.push(`- **Critical deadlines:** ${deadlines}`);
    else if (str(timeline.deadline)) lines.push(`- **Deadline:** ${str(timeline.deadline)}`);
    if (rolloutTimeline) lines.push(`- **Rollout timeline:** ${rolloutTimeline}`);
    if (legacyConstraints) lines.push(`- **Legacy system constraints:** ${legacyConstraints}`);
    else if (str(technical.limitations)) lines.push(`- **Technical limitations:** ${str(technical.limitations)}`);
    if (regulations) lines.push(`- **Industry regulations:** ${regulations}`);
    else if (str(regulatory.requirements)) lines.push(`- **Regulatory:** ${str(regulatory.requirements)}`);
    lines.push('');
  }

  // Strategic initiatives
  const initiatives = arr(bp.strategicInitiatives);
  if (initiatives.length > 0) {
    lines.push('## Strategic Initiatives', '');
    for (const init of initiatives) {
      const i = rec(init);
      const title = str(i.title);
      if (title) {
        lines.push(`### ${title}`, '');
        if (str(i.description)) lines.push(str(i.description), '');
        if (str(i.priority)) lines.push(`- **Priority:** ${str(i.priority)}`);
        if (str(i.status)) lines.push(`- **Status:** ${str(i.status)}`);
        if (str(i.budget)) lines.push(`- **Budget:** ${str(i.budget)}`);
        if (str(i.timeline)) lines.push(`- **Timeline:** ${str(i.timeline)}`);
        const outcomes = arr(i.expectedOutcomes);
        if (outcomes.length > 0) {
          lines.push('- **Expected outcomes:**');
          for (const o of outcomes) lines.push(`  - ${o}`);
        }
        lines.push('');
      }
    }
  }

  // AI readiness
  if (bp.aiReadinessScore !== null && bp.aiReadinessScore !== undefined) {
    lines.push('## AI Readiness', '');
    lines.push(`- **Score:** ${bp.aiReadinessScore}/100`);
    lines.push('');
  }

  return lines.join('\n');
}

function buildAgentSpecifications(input: SkillRenderInput): string {
  const bp = input.blueprintData;
  const team = getTeam(bp);
  const lines: string[] = ['# Agent Specifications', ''];

  for (const agent of team) {
    const name = str(agent.name);
    lines.push(`## ${name}`, '');

    const role = str(agent.role) || str(rec(agent.instructions).role);
    const type = str(agent.agentRole) || str(agent.orchestrationRole) || str(agent.type) || 'Worker';
    const supervision = str(agent.supervisionLevel) || 'Supervised';
    lines.push(`- **Role:** ${role}`);
    lines.push(`- **Type:** ${type}`);
    lines.push(`- **Supervision:** ${supervision}`);
    lines.push('');

    const instructions = rec(agent.instructions);
    if (str(instructions.description)) {
      lines.push('### Instructions', '', str(instructions.description), '');
    }
    if (str(instructions.role)) {
      lines.push(`**Role:** ${str(instructions.role)}`, '');
    }
    const steps = arr(instructions.steps);
    if (steps.length > 0) {
      lines.push('**Steps:**', '');
      for (const step of steps) lines.push(`1. ${step}`);
      lines.push('');
    }

    const responsibilities = arr(agent.responsibilities);
    if (responsibilities.length > 0) {
      lines.push('### Responsibilities', '');
      for (const r of responsibilities) lines.push(`- ${r}`);
      lines.push('');
    }

    const tools = arr(agent.enhancedTools);
    if (tools.length > 0) {
      lines.push('### Tools', '');
      lines.push('| Tool | Category | Description |');
      lines.push('|------|----------|-------------|');
      for (const tool of tools) {
        const t = rec(tool);
        const tName = str(t.name);
        const tCat = str(t.toolCategory) || str(t.type) || '';
        const tDesc = str(t.description).replace(/\|/g, '\\|');
        lines.push(`| ${tName} | ${tCat} | ${tDesc} |`);
      }
      lines.push('');
    }

    const guardrails = arr(agent.guardrails);
    if (guardrails.length > 0) {
      lines.push('### Guardrails', '');
      for (const g of guardrails) {
        const gr = rec(g);
        lines.push(`- **${str(gr.type)}**: ${str(gr.condition) || str(gr.description)}`);
      }
      lines.push('');
    }

    const escalation = arr(agent.escalationRules);
    if (escalation.length > 0) {
      lines.push('### Escalation Rules', '');
      for (const rule of escalation) lines.push(`- ${rule}`);
      lines.push('');
    }

    const risk = rec(agent.riskAssessment);
    if (str(risk.level) && !isPlaceholder(str(risk.level))) {
      lines.push('### Risk Assessment', '');
      lines.push(`- **Level:** ${str(risk.level)}`);
      const riskImpact = str(risk.impact);
      if (riskImpact && !isPlaceholder(riskImpact)) lines.push(`- **Impact:** ${riskImpact}`);
      const controls = arr(risk.controls);
      if (controls.length > 0) {
        lines.push('- **Controls:**');
        for (const c of controls) lines.push(`  - ${c}`);
      }
      lines.push('');
    }

    const cost = rec(agent.operatingCost);
    if (arr(cost.drivers).length > 0 || str(cost.breakeven)) {
      lines.push('### Cost Drivers', '');
      for (const d of arr(cost.drivers)) lines.push(`- ${d}`);
      if (str(cost.breakeven)) lines.push(`- **Breakeven:** ${str(cost.breakeven)}`);
      lines.push('');
    }

    const metrics = arr(agent.successMetrics);
    if (metrics.length > 0) {
      lines.push('### Success Metrics', '');
      lines.push('| Metric | Target |');
      lines.push('|--------|--------|');
      for (const m of metrics) {
        const mr = rec(m);
        lines.push(`| ${str(mr.metric)} | ${str(mr.target)} |`);
      }
      lines.push('');
    }

    lines.push('---', '');
  }

  return lines.join('\n');
}

function buildFinancialCase(input: SkillRenderInput): string {
  const bc = input.businessCaseData;
  const lines: string[] = ['# Financial Case', ''];

  if (!bc) {
    lines.push('_No business case data available. Generate a Business Case to enrich this section._', '');
    return lines.join('\n');
  }

  const es = rec(bc.executiveSummary);
  const ask = rec(es.ask);
  if (str(es.purpose)) lines.push('## Purpose', '', str(es.purpose), '');

  if (str(ask.investmentAmount) || str(ask.timeline)) {
    lines.push('## Investment Ask', '');
    if (str(ask.investmentAmount)) lines.push(`- **Amount:** ${str(ask.investmentAmount)}`);
    if (str(ask.timeline)) lines.push(`- **Timeline:** ${str(ask.timeline)}`);
    const keyOutcomes = arr(ask.keyOutcomes);
    if (keyOutcomes.length > 0) {
      lines.push('- **Key outcomes:**');
      for (const o of keyOutcomes) lines.push(`  - ${o}`);
    }
    lines.push('');
  }

  if (str(es.valueProposition)) {
    lines.push('## Value Proposition', '', str(es.valueProposition), '');
  }

  const benefits = rec(bc.benefits);
  const qROI = rec(benefits.quantifiedROI);

  const roiVal = str(qROI.roi);
  const npvVal = str(qROI.npv);
  const paybackVal = str(qROI.paybackPeriod);
  if ((roiVal && !isPlaceholder(roiVal)) || (npvVal && !isPlaceholder(npvVal)) || (paybackVal && !isPlaceholder(paybackVal))) {
    lines.push('## Return on Investment', '');
    if (roiVal && !isPlaceholder(roiVal)) lines.push(`- **ROI:** ${roiVal}`);
    if (npvVal && !isPlaceholder(npvVal)) lines.push(`- **NPV:** ${npvVal}`);
    if (paybackVal && !isPlaceholder(paybackVal)) lines.push(`- **Payback period:** ${paybackVal}`);
    lines.push('');
  }

  // Labor cost detail (nested object: currentStateBaseline / projectedSavings)
  const laborDetail = rec(qROI.laborCostDetail);
  const currentBaseline = rec(laborDetail.currentStateBaseline);
  const projectedSavings = rec(laborDetail.projectedSavings);
  const blendedRate = str(rec(currentBaseline.blendedHourlyRate).value);
  const totalAnnualCost = str(rec(currentBaseline.totalAnnualCost).value);
  const totalAnnualHours = str(rec(currentBaseline.totalAnnualHours).value);
  const costSavingsAnnual = str(rec(projectedSavings.costSavingsAnnual).value);
  if (totalAnnualCost || blendedRate) {
    lines.push('## Labor Cost Analysis', '');
    if (blendedRate) lines.push(`- **Avg. fully-loaded rate:** ${blendedRate}`);
    if (totalAnnualCost) lines.push(`- **Annual labor cost:** ${totalAnnualCost}`);
    if (totalAnnualHours) lines.push(`- **Annual hours affected:** ${totalAnnualHours}`);
    if (costSavingsAnnual) lines.push(`- **Automation savings:** ${costSavingsAnnual}`);
    lines.push('');
  }

  // Cost breakdown (each field is { value, notes?, source? })
  const costBreakdown = rec(qROI.costBreakdown);
  const cbImpl = str(rec(costBreakdown.implementation).value);
  const cbLic = str(rec(costBreakdown.annualLicensing).value);
  const cbSupport = str(rec(costBreakdown.annualSupportMaintenance).value);
  if (cbImpl || cbLic) {
    lines.push('## Cost Breakdown', '');
    if (cbImpl) lines.push(`- **Implementation:** ${cbImpl}`);
    if (cbLic) lines.push(`- **Annual licensing:** ${cbLic}`);
    if (cbSupport) lines.push(`- **Annual support/maintenance:** ${cbSupport}`);
    lines.push('');
  }

  // Pilot ROI (nested: pilotCapex/pilotOpex/pilotAnnualSavings/pilotYear1Net are { value, calculation })
  const pilotROI = rec(qROI.pilotROI);
  const pilotCapex = str(rec(pilotROI.pilotCapex).value);
  const pilotOpex = str(rec(pilotROI.pilotOpex).value);
  const pilotSavings = str(rec(pilotROI.pilotAnnualSavings).value);
  const pilotYear1Net = str(rec(pilotROI.pilotYear1Net).value);
  const pilotPayback = numStr(pilotROI.pilotPaybackMonths);
  if (pilotCapex || pilotSavings) {
    lines.push('## Pilot Economics', '');
    if (pilotCapex) lines.push(`- **Pilot capex:** ${pilotCapex}`);
    if (pilotOpex) lines.push(`- **Pilot opex:** ${pilotOpex}`);
    if (pilotSavings) lines.push(`- **Pilot annual savings:** ${pilotSavings}`);
    if (pilotYear1Net) lines.push(`- **Pilot Year 1 net:** ${pilotYear1Net}`);
    if (pilotPayback) lines.push(`- **Payback:** ${stripTrailingUnit(pilotPayback, 'months')} months`);
    lines.push('');
  }

  // Sensitivity analysis (roiPercentage, paybackMonths, annualSavings — all numbers/strings)
  const sensitivity = rec(qROI.sensitivity);
  if (sensitivity.conservative || sensitivity.realistic || sensitivity.optimistic) {
    lines.push('## Sensitivity Analysis', '');
    lines.push('| Scenario | ROI | Payback | Annual Savings |');
    lines.push('|----------|-----|---------|----------------|');
    for (const [label, key] of [['Conservative', 'conservative'], ['Realistic', 'realistic'], ['Optimistic', 'optimistic']] as const) {
      const s = rec(sensitivity[key]);
      const roi = numStr(s.roiPercentage);
      const payback = numStr(s.paybackMonths);
      lines.push(`| ${label} | ${roi ? stripTrailingUnit(roi, '%') + '%' : ''} | ${payback ? stripTrailingUnit(payback, 'months') + ' months' : ''} | ${str(s.annualSavings)} |`);
    }
    lines.push('');
  }

  // 5-year projection (calculator uses costsThisYear/valueDelivered/netThisYear/runningTotal)
  const fiveYear = arr(qROI.fiveYearProjection);
  if (fiveYear.length > 0) {
    lines.push('## Five-Year Projection', '');
    lines.push('| Year | Investment | Value | Net Cash Flow | Cumulative |');
    lines.push('|------|-----------|-------|---------------|------------|');
    for (const yr of fiveYear) {
      const y = rec(yr);
      lines.push(`| ${numStr(y.year)} | ${str(y.costsThisYear) || str(y.investment)} | ${str(y.valueDelivered) || str(y.value)} | ${str(y.netThisYear) || str(y.netCashFlow)} | ${str(y.runningTotal) || str(y.cumulative)} |`);
    }
    lines.push('');
  }

  const tangible = rec(benefits.tangibleBenefits);
  if (str(tangible.costSavings) || str(tangible.processEfficiency)) {
    lines.push('## Tangible Benefits', '');
    if (str(tangible.costSavings)) lines.push(`- **Cost savings:** ${str(tangible.costSavings)}`);
    if (str(tangible.revenueUplift)) lines.push(`- **Revenue uplift:** ${str(tangible.revenueUplift)}`);
    if (str(tangible.processEfficiency)) lines.push(`- **Process efficiency:** ${str(tangible.processEfficiency)}`);
    if (str(tangible.timeToMarket)) lines.push(`- **Time to market:** ${str(tangible.timeToMarket)}`);
    lines.push('');
  }

  // Recommendation
  const recommendation = rec(bc.recommendation);
  if (str(recommendation.summary) || str(recommendation.decisionRequest)) {
    lines.push('## Recommendation', '');
    if (str(recommendation.summary)) lines.push(str(recommendation.summary), '');
    if (str(recommendation.decisionRequest)) {
      lines.push(`**Decision request:** ${str(recommendation.decisionRequest)}`, '');
    }
    const immediateActions = arr(recommendation.immediateActions);
    if (immediateActions.length > 0) {
      lines.push('**Immediate actions upon approval:**', '');
      for (const action of immediateActions) lines.push(`1. ${action}`);
      lines.push('');
    }
    if (str(recommendation.blueprintImplementationRef)) {
      lines.push(`> ${str(recommendation.blueprintImplementationRef)}`, '');
    }
  }

  return lines.join('\n');
}

function buildImplementationRoadmap(input: SkillRenderInput): string {
  const ip = input.implementationPlanData;
  const lines: string[] = ['# Implementation Roadmap', ''];

  if (!ip) {
    lines.push('_No implementation plan data available. Generate an Implementation Plan to enrich this section._', '');
    return lines.join('\n');
  }

  const overview = rec(ip.projectOverview);
  if (str(overview.projectName)) {
    lines.push(`## ${str(overview.projectName)}`, '');
  }
  if (str(overview.executiveSummary)) {
    lines.push(str(overview.executiveSummary), '');
  }
  if (str(overview.scope)) {
    lines.push('### Scope', '', str(overview.scope), '');
  }
  const assumptions = arr(overview.assumptions);
  if (assumptions.length > 0) {
    lines.push('### Assumptions', '');
    for (const a of assumptions) lines.push(`- ${a}`);
    lines.push('');
  }

  const epics = arr(ip.epics);
  if (epics.length > 0) {
    lines.push('## Epics', '');
    for (const epic of epics) {
      const e = rec(epic);
      lines.push(`### ${str(e.name)}`, '');
      if (str(e.description)) lines.push(str(e.description), '');
      lines.push(`- **Phase:** ${str(e.phase)}`);
      lines.push(`- **Priority:** ${str(e.priority)}`);
      if (str(e.estimatedDuration)) lines.push(`- **Duration:** ${str(e.estimatedDuration)}`);
      if (str(e.businessValue)) lines.push(`- **Business value:** ${str(e.businessValue)}`);
      lines.push('');

      const ac = arr(e.acceptanceCriteria);
      if (ac.length > 0) {
        lines.push('**Acceptance criteria:**', '');
        for (const c of ac) lines.push(`- [ ] ${c}`);
        lines.push('');
      }

      const stories = arr(e.stories);
      if (stories.length > 0) {
        lines.push('**User stories:**', '');
        for (const story of stories) {
          const s = rec(story);
          const userStory = `As ${str(s.asA)}, I want ${str(s.iWant)}, so that ${str(s.soThat)}`;
          lines.push(`- **${str(s.title)}**: ${userStory}`);
          if (str(s.estimatedEffort)) lines.push(`  - Effort: ${str(s.estimatedEffort)}`);
        }
        lines.push('');
      }

      const deps = arr(e.dependencies);
      if (deps.length > 0) {
        lines.push('**Dependencies:**', '');
        for (const d of deps) lines.push(`- ${d}`);
        lines.push('');
      }
    }
  }

  const agentSpecs = arr(ip.agentSpecifications);
  if (agentSpecs.length > 0) {
    lines.push('## Agent Build Specifications', '');
    for (const spec of agentSpecs) {
      const s = rec(spec);
      lines.push(`### ${str(s.name)}`, '');
      if (str(s.role)) lines.push(str(s.role), '');
      if (str(s.instructions)) lines.push('**Instructions:**', '', str(s.instructions), '');
      if (str(s.linkedStoryId)) lines.push(`_Linked to story: ${str(s.linkedStoryId)}_`, '');
    }
  }

  const resources = rec(ip.resources);
  const timeline = rec(resources.timeline);
  if (str(timeline.totalDuration)) {
    lines.push('## Timeline', '');
    lines.push(`**Total duration:** ${str(timeline.totalDuration)}`, '');
    const timelinePhases = arr(timeline.phases);
    if (timelinePhases.length > 0) {
      for (const phase of timelinePhases) {
        const p = rec(phase);
        lines.push(`### ${str(p.name)} (${str(p.duration)})`, '');
        for (const m of arr(p.milestones)) lines.push(`- ${m}`);
        lines.push('');
      }
    }
  }

  const roles = arr(resources.roles);
  if (roles.length > 0) {
    lines.push('## Required Roles', '');
    lines.push('| Role | Allocation | Duration | Key Skills |');
    lines.push('|------|-----------|----------|------------|');
    for (const role of roles) {
      const r = rec(role);
      const skills = arr(r.skillsRequired).slice(0, 3).join(', ');
      lines.push(`| ${str(r.role)} | ${str(r.allocation)} | ${str(r.duration)} | ${skills} |`);
    }
    lines.push('');
  }

  const deps = arr(ip.dependencies);
  if (deps.length > 0) {
    lines.push('## Dependencies', '');
    for (const dep of deps) {
      const d = rec(dep);
      lines.push(`- **${str(d.type)}** (${str(d.criticality)}): ${str(d.description)}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function buildArchitectureDecisions(input: SkillRenderInput): string {
  const bp = input.blueprintData;
  const lines: string[] = ['# Architecture Decisions', ''];

  const pr = rec(bp.platformRecommendation);
  const pp = rec(pr.primaryPlatform);

  if (str(pp.name)) {
    lines.push(`## Platform: ${str(pp.name)}`, '');
    if (str(pp.summary)) lines.push(str(pp.summary), '');
    if (str(pp.justification)) lines.push(`**Justification:** ${str(pp.justification)}`, '');

    const pros = arr(pp.pros);
    if (pros.length > 0) {
      lines.push('**Pros:**', '');
      for (const p of pros) lines.push(`- ${p}`);
      lines.push('');
    }

    const cons = arr(pp.cons);
    if (cons.length > 0) {
      lines.push('**Cons:**', '');
      for (const c of cons) lines.push(`- ${c}`);
      lines.push('');
    }

    if (str(pp.implementationTime)) lines.push(`**Implementation time:** ${str(pp.implementationTime)}`);
    if (str(pp.estimatedCost)) lines.push(`**Estimated cost:** ${str(pp.estimatedCost)}`);
    if (str(pp.integrationComplexity)) lines.push(`**Integration complexity:** ${str(pp.integrationComplexity)}`);
    lines.push('');
  }

  const rationale = rec(bp.architectureRationale);
  const whyAgentic = arr(rationale.whyAgentic);
  if (whyAgentic.length > 0) {
    lines.push('## Why Agentic AI', '');
    for (const w of whyAgentic) lines.push(`- ${w}`);
    lines.push('');
  }

  const hybrid = arr(rationale.hybridComponents);
  if (hybrid.length > 0) {
    lines.push('## Hybrid Components', '');
    lines.push('| Component | Approach | Rationale |');
    lines.push('|-----------|----------|-----------|');
    for (const h of hybrid) {
      const hr = rec(h);
      lines.push(`| ${str(hr.component)} | ${str(hr.approach)} | ${str(hr.rationale)} |`);
    }
    lines.push('');
  }

  const wins = arr(rationale.immediateWins);
  if (wins.length > 0) {
    lines.push('## Immediate Wins', '');
    for (const w of wins) lines.push(`- ${w}`);
    lines.push('');
  }

  const reasoning = rec(bp.reasoning);
  const bizDecisions = rec(reasoning.businessDecisions);
  const patternSelection = rec(bizDecisions.patternSelection);
  if (str(patternSelection.decision)) {
    lines.push('## Pattern Selection', '');
    lines.push(`**Selected:** ${str(patternSelection.decision)}`);
    if (str(patternSelection.rationale)) lines.push(`**Rationale:** ${str(patternSelection.rationale)}`);
    if (str(patternSelection.reasoning)) lines.push(`**Business factors:** ${str(patternSelection.reasoning)}`);
    const alts = arr(patternSelection.alternatives);
    if (alts.length > 0) lines.push(`**Alternatives considered:** ${alts.join(', ')}`);
    lines.push('');
  }

  const gaps = arr(bp.integrationGaps);
  if (gaps.length > 0) {
    lines.push('## Integration Gaps', '');
    lines.push('| System | Gap Type | Severity | Impact | Recommendation |');
    lines.push('|--------|----------|----------|--------|----------------|');
    for (const gap of gaps) {
      const g = rec(gap);
      lines.push(`| ${str(g.systemNeeded)} | ${str(g.gapType)} | ${str(g.severity)} | ${str(g.impact)} | ${str(g.recommendation)} |`);
    }
    lines.push('');
  }

  const altPlatforms = arr(pr.alternativePlatforms);
  if (altPlatforms.length > 0) {
    lines.push('## Alternative Platforms Considered', '');
    for (const alt of altPlatforms) {
      const a = rec(alt);
      lines.push(`### ${str(a.name)}`, '');
      if (str(a.justification)) lines.push(str(a.justification), '');
      if (str(a.estimatedCost)) lines.push(`- **Cost:** ${str(a.estimatedCost)}`);
      if (str(a.implementationTime)) lines.push(`- **Timeline:** ${str(a.implementationTime)}`);
      if (str(a.integrationComplexity)) lines.push(`- **Complexity:** ${str(a.integrationComplexity)}`);
      lines.push('');
    }
  }

  const feasibility = rec(bp.feasibilityIndicators);
  const feasConfidence = str(feasibility.feasibilityConfidence) || str(feasibility.overallScore);
  const feasBasis = str(feasibility.feasibilityBasis) || str(feasibility.recommendation);
  if (feasConfidence || feasBasis) {
    lines.push('## Feasibility Assessment', '');
    if (feasConfidence) lines.push(`**Confidence:** ${feasConfidence}`);
    if (feasBasis) lines.push(`**Basis:** ${feasBasis}`);
    lines.push('');
  }

  return lines.join('\n');
}

function buildGuardrailsAndGovernance(input: SkillRenderInput): string {
  const bp = input.blueprintData;
  const bc = input.businessCaseData;
  const team = getTeam(bp);
  const lines: string[] = ['# Guardrails & Governance', ''];

  const riskAssessment = rec(bp.riskAssessment);
  const techRisks = arr(riskAssessment.technicalRisks);
  const bizRisks = arr(riskAssessment.businessRisks);
  const mitStrategies = arr(riskAssessment.mitigationStrategies);
  const contingencies = arr(riskAssessment.contingencyPlans);

  if (techRisks.length > 0) {
    lines.push('## Technical Risks', '');
    for (const r of techRisks) lines.push(`- ${r}`);
    lines.push('');
  }
  if (bizRisks.length > 0) {
    lines.push('## Business Risks', '');
    for (const r of bizRisks) lines.push(`- ${r}`);
    lines.push('');
  }
  if (mitStrategies.length > 0) {
    lines.push('## Mitigation Strategies', '');
    for (const m of mitStrategies) lines.push(`- ${m}`);
    lines.push('');
  }
  if (contingencies.length > 0) {
    lines.push('## Contingency Plans', '');
    for (const c of contingencies) lines.push(`- ${c}`);
    lines.push('');
  }

  const agentsWithGuardrails = team.filter(a => arr(a.guardrails).length > 0 || arr(a.escalationRules).length > 0);
  if (agentsWithGuardrails.length > 0) {
    lines.push('## Agent-Level Guardrails', '');
    for (const agent of agentsWithGuardrails) {
      lines.push(`### ${str(agent.name)}`, '');

      const guardrails = arr(agent.guardrails);
      if (guardrails.length > 0) {
        lines.push('**Guardrails:**', '');
        for (const g of guardrails) {
          const gr = rec(g);
          lines.push(`- **${str(gr.type)}**: ${str(gr.condition) || str(gr.description)}`);
        }
        lines.push('');
      }

      const escalation = arr(agent.escalationRules);
      if (escalation.length > 0) {
        lines.push('**Escalation rules:**', '');
        for (const rule of escalation) lines.push(`- ${rule}`);
        lines.push('');
      }

      const risk = rec(agent.riskAssessment);
      if (str(risk.level) && !isPlaceholder(str(risk.level))) {
        const impactStr = str(risk.impact);
        const riskLine = impactStr && !isPlaceholder(impactStr)
          ? `**Risk:** ${str(risk.level)} — ${impactStr}`
          : `**Risk:** ${str(risk.level)}`;
        lines.push(riskLine);
        lines.push('');
      }
    }
  }

  if (bc) {
    const bcRisks = rec(bc.risks);
    const implRisks = arr(bcRisks.implementationRisks);
    const opRisks = arr(bcRisks.operationalRisks);
    const mitigationPlan = arr(bcRisks.mitigationPlan);

    if (implRisks.length > 0) {
      lines.push('## Implementation Risks (Business Case)', '');
      lines.push('| Risk | Severity | Impact |');
      lines.push('|------|----------|--------|');
      for (const risk of implRisks) {
        const r = rec(risk);
        lines.push(`| ${str(r.title)} | ${str(r.severity)} | ${str(r.impact)} |`);
      }
      lines.push('');
    }

    if (opRisks.length > 0) {
      lines.push('## Operational Risks (Business Case)', '');
      lines.push('| Risk | Severity | Impact |');
      lines.push('|------|----------|--------|');
      for (const risk of opRisks) {
        const r = rec(risk);
        lines.push(`| ${str(r.title)} | ${str(r.severity)} | ${str(r.impact)} |`);
      }
      lines.push('');
    }

    if (mitigationPlan.length > 0) {
      lines.push('## Mitigation Plan', '');
      for (const mit of mitigationPlan) {
        const m = rec(mit);
        lines.push(`### ${str(m.riskTitle)}`, '');
        lines.push(`- **Strategy:** ${str(m.strategy)}`);
        if (str(m.owner)) lines.push(`- **Owner:** ${str(m.owner)}`);
        if (str(m.timeline)) lines.push(`- **Timeline:** ${str(m.timeline)}`);
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

function buildValidateScript(): string {
  return `#!/bin/bash
# validate-spec.sh — Validates implementation spec structure completeness
# Usage: ./scripts/validate-spec.sh

set -e

ERRORS=0
WARNINGS=0

check_file() {
  if [ ! -f "$1" ]; then
    echo "ERROR: Missing required file: $1"
    ERRORS=$((ERRORS + 1))
  else
    echo "OK: $1"
  fi
}

check_optional() {
  if [ ! -f "$1" ]; then
    echo "WARN: Optional file missing: $1 (consider generating the missing artifact)"
    WARNINGS=$((WARNINGS + 1))
  else
    echo "OK: $1"
  fi
}

echo "=== Implementation Spec Validator ==="
echo ""

# Required files
echo "--- Required Files ---"
check_file "SKILL.md"
check_file "references/agent-specifications.md"
check_file "references/architecture-decisions.md"

# Check SKILL.md has frontmatter
if [ -f "SKILL.md" ]; then
  if ! head -1 SKILL.md | grep -q "^---"; then
    echo "ERROR: SKILL.md missing YAML frontmatter"
    ERRORS=$((ERRORS + 1))
  fi
fi

echo ""
echo "--- Optional Files ---"
check_optional "references/business-context.md"
check_optional "references/organization-context.md"
check_optional "references/financial-case.md"
check_optional "references/implementation-roadmap.md"
check_optional "references/guardrails-and-governance.md"

echo ""
echo "=== Results ==="
echo "Errors: $ERRORS"
echo "Warnings: $WARNINGS"

if [ $ERRORS -gt 0 ]; then
  echo "FAILED: Fix $ERRORS error(s) before proceeding."
  exit 1
else
  echo "PASSED"
  exit 0
fi
`;
}

// =============================================================================
// MAIN RENDER FUNCTION
// =============================================================================

/**
 * Renders a complete Agent Skills directory from blueprint data.
 * Returns a Map of { relativePath → fileContent }.
 */
export function renderSkillDirectory(input: SkillRenderInput): Map<string, string> {
  const files = new Map<string, string>();

  // SKILL.md
  const frontmatter = buildSkillFrontmatter(input);
  const body = buildSkillBody(input);
  files.set('SKILL.md', `${frontmatter}\n\n${body}`);

  // Reference files
  files.set('references/business-context.md', buildBusinessContext(input));
  files.set('references/organization-context.md', buildOrganizationContext(input));
  files.set('references/agent-specifications.md', buildAgentSpecifications(input));
  files.set('references/financial-case.md', buildFinancialCase(input));
  files.set('references/implementation-roadmap.md', buildImplementationRoadmap(input));
  files.set('references/architecture-decisions.md', buildArchitectureDecisions(input));
  files.set('references/guardrails-and-governance.md', buildGuardrailsAndGovernance(input));

  // Scripts
  files.set('scripts/validate-spec.sh', buildValidateScript());

  return files;
}
