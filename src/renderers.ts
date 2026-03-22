// =============================================================================
// Agent Skills directory renderer
// Ported from implementation-spec-export.service.ts (main app)
// Converts blueprint + business case + implementation plan + use case JSON
// into a Map<string, string> of { relativePath → fileContent }
// =============================================================================

import type { ImplementationStateResponse, ProgressResponse } from './client.js';

export interface SkillRenderInput {
  blueprintTitle: string;
  blueprintId: string;
  organizationName?: string;
  blueprintData: Record<string, unknown>;
  businessCaseData?: Record<string, unknown>;
  implementationPlanData?: Record<string, unknown>;
  useCaseData?: Record<string, unknown>;
  businessProfileData?: Record<string, unknown>;
  generalGuide?: string;
  vendorGuide?: { platform: string; content: string };
  vendorSkill?: { platform: string; skillName: string; content: string };
  implementationState?: ImplementationStateResponse | null;
  progress?: ProgressResponse | null;
}

// =============================================================================
// HELPERS
// =============================================================================

export function slugify(input: string): string {
  const stripped = input.replace(/^blueprint\s+for\s+/i, '');
  const full = stripped
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (full.length <= 60) return full;
  const trimmed = full.slice(0, 60);
  const lastDash = trimmed.lastIndexOf('-');
  let result = lastDash > 20 ? trimmed.slice(0, lastDash) : trimmed;
  const TRAILING_STOP = /-(from|for|and|or|the|with|of|in|on|to|by|a|an)$/;
  while (TRAILING_STOP.test(result)) {
    result = result.replace(TRAILING_STOP, '');
  }
  return result;
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

function getInvestmentTier(bp: Record<string, unknown>, bc: Record<string, unknown> | undefined): string {
  // Primary: blueprint feasibility indicators (canonical source)
  const fi = rec(bp.feasibilityIndicators);
  const bpTier = str(fi.investmentTier);
  if (bpTier && ['low', 'medium', 'high'].includes(bpTier)) return bpTier;
  // Fallback: derive from business case ask amount (first numeric token)
  if (!bc) return 'pending';
  const es = rec(bc.executiveSummary);
  const ask = rec(es.ask);
  const amount = str(ask.investmentAmount);
  if (!amount) return 'pending';
  const match = amount.match(/[\d,]+(?:\.\d+)?/);
  if (!match) return 'pending';
  const num = parseFloat(match[0].replace(/,/g, ''));
  if (isNaN(num)) return 'pending';
  if (num < 150000) return 'low';
  if (num < 400000) return 'medium';
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

  const cleanTitle = input.blueprintTitle.replace(/[.!?]+$/, '');
  const lines = [
    '---',
    `name: ${slug}`,
    'description: >-',
    `  Implementation specification for ${cleanTitle}. ${team.length} AI agents,`,
    `  ${pattern} pattern, targeting ${platform}.`,
    'compatibility: Any coding agent (Claude Code, Codex, Cursor).',
    'metadata:',
    '  generated-by: agent-blueprint',
    `  generated-at: "${new Date().toISOString()}"`,
    `  blueprint-id: "${input.blueprintId}"`,
    `  target-platform: "${platform}"`,
    `  agent-count: "${team.length}"`,
    `  pattern: "${pattern}"`,
    `  investment-tier: "${getInvestmentTier(input.blueprintData, input.businessCaseData)}"`,
  ];
  if (input.vendorSkill) {
    lines.push(`  vendor-skill: "${input.vendorSkill.platform}"`);
  } else if (input.vendorGuide) {
    lines.push(`  deployment-guide: "${input.vendorGuide.platform}"`);
  }
  lines.push('---');
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

  if (input.vendorSkill) {
    const platformLabel = input.vendorSkill.platform.charAt(0).toUpperCase() + input.vendorSkill.platform.slice(1);
    lines.push(
      `> A ${platformLabel} expert skill has been installed at \`.claude/skills/${input.vendorSkill.skillName}/\`.`,
      '> It will be auto-loaded for platform-specific tasks.',
      '',
    );
  } else if (input.vendorGuide) {
    const guideFilename = `references/deployment-guide-${input.vendorGuide.platform}.md`;
    const platformLabel = input.vendorGuide.platform.charAt(0).toUpperCase() + input.vendorGuide.platform.slice(1);
    lines.push(
      `> A ${platformLabel} deployment guide is included in this export.`,
      `> See \`${guideFilename}\` for platform-specific implementation instructions.`,
      '',
    );
  }

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
    const skillPilotSuppressed = pilotROI.suppressed === true || pilotROI.suppressed === 'true';
    if (!skillPilotSuppressed && (skillPilotCapex || skillPilotSavings)) {
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
  lines.push('2. **Read `GETTING-STARTED.md`** for step-by-step implementation guidance');
  lines.push('3. **Review** the reference files for full context');
  lines.push('4. **Start with Phase 1** (Pilot) -- implement the lead agent first');
  lines.push('5. **Use decision gates** to validate before expanding to full implementation');
  lines.push('6. **Reference `scripts/validate-spec.sh`** to verify spec completeness', '');

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
        if (typeof tool === 'string') {
          lines.push(`| ${tool} | | |`);
          continue;
        }
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
  const pilotSuppressed = pilotROI.suppressed === true || pilotROI.suppressed === 'true';
  if (!pilotSuppressed && (pilotCapex || pilotSavings)) {
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

function normalizeMetricName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// =============================================================================
// REALITY LAYER HELPERS (Living Blueprint Phase 3A)
// =============================================================================

function hasImplementationData(input: SkillRenderInput): boolean {
  if (!input.implementationState) return false;
  const sd = rec(input.implementationState.stateData);
  const agents = arr(sd.agents);
  return agents.some((a: unknown) => str(rec(a).status) !== 'not_started');
}

export function hasProgressData(input: SkillRenderInput): boolean {
  if (!input.progress) return false;
  return input.progress.actuals.length > 0;
}

function buildProgressByName(input: SkillRenderInput): Map<string, { actualValue: string; status: string; recordedAt: string; deviationPercent?: number; predictedValue: string }> {
  const map = new Map<string, { actualValue: string; status: string; recordedAt: string; deviationPercent?: number; predictedValue: string }>();
  if (!input.progress) return map;
  for (const actual of input.progress.actuals) {
    map.set(normalizeMetricName(actual.metricName), {
      actualValue: actual.actualValue,
      status: actual.status,
      recordedAt: actual.recordedAt,
      deviationPercent: actual.deviationPercent,
      predictedValue: actual.predictedValue,
    });
  }
  return map;
}

// =============================================================================
// CURRENT-STATE.md (new file on return visits)
// =============================================================================

function buildCurrentState(input: SkillRenderInput): string {
  const lines: string[] = [];
  const state = input.implementationState!;
  const sd = rec(state.stateData);
  const stateAgents = arr(sd.agents);
  const bp = rec(input.blueprintData);
  const team = arr(bp.enhancedDigitalTeam);

  const syncDate = state.syncedAt ? state.syncedAt.split('T')[0] : 'unknown';
  const overallStatus = str(sd.overall_status) || 'unknown';

  lines.push('# Current State', '');
  lines.push(`> Last synced: ${syncDate} | Overall: ${overallStatus}`, '');

  // Agent status table
  const bpAgentsByName = new Map<string, Record<string, unknown>>();
  for (const a of team) {
    const agent = rec(a);
    bpAgentsByName.set(str(agent.name).toLowerCase().trim(), agent);
  }

  lines.push('## Agent Implementation Status', '');
  lines.push('| # | Agent | Planned Role | Status | Platform Artifact | Deviations |');
  lines.push('|---|-------|-------------|--------|-------------------|------------|');

  let implementedCount = 0;
  const totalAgents = stateAgents.length || team.length;

  for (let i = 0; i < stateAgents.length; i++) {
    const sa = rec(stateAgents[i]);
    const name = str(sa.name);
    const status = str(sa.status) || 'not_started';
    const artifact = str(sa.platform_artifact) || '-';
    const deviations = arr(sa.deviations);
    const devStr = deviations.length > 0 ? deviations.map((d: unknown) => str(d)).join('; ') : '-';

    const bpAgent = bpAgentsByName.get(name.toLowerCase().trim());
    const plannedRole = bpAgent ? str(bpAgent.role) || str(bpAgent.agentRole) || '-' : '-';

    if (status === 'implemented' || status === 'modified') implementedCount++;

    lines.push(`| ${i + 1} | ${name} | ${plannedRole} | ${status} | ${artifact} | ${devStr} |`);
  }

  lines.push('');
  lines.push(`${implementedCount} of ${totalAgents} agents implemented.`, '');

  // Platform comparison
  const stPlatform = rec(sd.platform);
  const stArch = rec(sd.architecture);
  const plannedPlatform = getPlatformName(bp);
  const plannedPattern = getAgenticPattern(bp);
  const actualPlatform = str(stPlatform.name) || 'Not reported';
  const actualPattern = str(stArch.pattern) || 'Not reported';

  if (actualPlatform !== 'Not reported' || actualPattern !== 'Not reported') {
    lines.push('## Platform', '');
    lines.push('| | Planned | Actual |');
    lines.push('|---|---------|--------|');
    lines.push(`| Platform | ${plannedPlatform} | ${actualPlatform} |`);
    lines.push(`| Pattern | ${plannedPattern} | ${actualPattern} |`);
    if (str(stPlatform.version)) lines.push(`| Version | - | ${str(stPlatform.version)} |`);
    if (str(stPlatform.environment)) lines.push(`| Environment | - | ${str(stPlatform.environment)} |`);
    lines.push('');
  }

  // Architecture deviations
  const archDevs = arr(stArch.deviations).filter((d: unknown) => str(d));
  if (archDevs.length > 0) {
    lines.push('## Architecture Deviations', '');
    for (const d of archDevs) lines.push(`- ${str(d)}`);
    lines.push('');
  }

  // Additional components
  const addlComponents = arr(stArch.additional_components).filter((c: unknown) => str(c));
  if (addlComponents.length > 0) {
    lines.push('## Additional Components', '');
    for (const c of addlComponents) lines.push(`- ${str(c)}`);
    lines.push('');
  }

  // Integrations connected (per agent)
  const agentsWithIntegrations = stateAgents
    .map((a: unknown) => rec(a))
    .filter(a => arr(a.integrations_connected).length > 0);
  if (agentsWithIntegrations.length > 0) {
    lines.push('## Integrations Connected', '');
    for (const a of agentsWithIntegrations) {
      const integrations = arr(a.integrations_connected).map((i: unknown) => str(i)).join(', ');
      lines.push(`- **${str(a.name)}**: ${integrations}`);
    }
    lines.push('');
  }

  // Performance against targets (if progress data exists)
  if (hasProgressData(input)) {
    const progress = input.progress!;
    lines.push('## Performance Against Targets', '');
    lines.push('| Metric | Target | Actual | Status | Measured |');
    lines.push('|--------|--------|--------|--------|----------|');

    for (const actual of progress.actuals) {
      const measured = actual.recordedAt ? actual.recordedAt.split('T')[0] : '-';
      lines.push(`| ${actual.metricName} | ${actual.predictedValue} | ${actual.actualValue} | ${actual.status} | ${measured} |`);
    }

    lines.push('');
    const s = progress.summary;
    lines.push(`${s.onTrack} on track, ${s.minorDeviation} minor deviation, ${s.majorDeviation} major deviation.`, '');
  }

  return lines.join('\n');
}

// =============================================================================
// RECOMMENDATIONS.md (new file on return visits)
// =============================================================================

function buildRecommendations(input: SkillRenderInput): string {
  const lines: string[] = [];
  lines.push('# Recommendations', '');
  lines.push('> Prioritized next actions based on implementation state and performance data.', '');

  let recNum = 0;
  const bp = rec(input.blueprintData);
  const team = arr(bp.enhancedDigitalTeam);
  const bc = rec(input.businessCaseData);

  // Build epic lookup for priority ordering
  const epics = arr(rec(input.implementationPlanData).epics);
  const epicByNormalizedName = new Map<string, { phase: string; priority: string; dependencies: string[] }>();
  for (const e of epics) {
    const epic = rec(e);
    const name = str(epic.name).toLowerCase().trim();
    epicByNormalizedName.set(name, {
      phase: str(epic.phase),
      priority: str(epic.priority) || 'P2',
      dependencies: arr(epic.dependencies).map((d: unknown) => typeof d === 'string' ? d : str(rec(d).description) || str(d)),
    });
  }

  // Helper to find the best-matching epic for an agent
  function findEpicForAgent(agentName: string): { phase: string; priority: string; dependencies: string[] } | undefined {
    const norm = agentName.toLowerCase().trim();
    // Direct match
    for (const [epicName, epic] of epicByNormalizedName) {
      if (epicName.includes(norm) || norm.includes(epicName)) return epic;
    }
    // Word overlap
    const agentWords = norm.split(/\s+/).filter(w => w.length > 2);
    for (const [epicName, epic] of epicByNormalizedName) {
      for (const word of agentWords) {
        if (epicName.includes(word)) return epic;
      }
    }
    return undefined;
  }

  // Priority sort key: P0=0, P1=1, P2=2, unknown=3
  function priorityKey(p: string): number {
    if (p === 'P0') return 0;
    if (p === 'P1') return 1;
    if (p === 'P2') return 2;
    return 3;
  }

  // --- Section 1: Unimplemented agents ---
  if (hasImplementationData(input)) {
    const sd = rec(input.implementationState!.stateData);
    const stateAgents = arr(sd.agents);

    const implementedNames = new Set(
      stateAgents
        .map((a: unknown) => rec(a))
        .filter(a => str(a.status) === 'implemented' || str(a.status) === 'modified')
        .map(a => str(a.name).toLowerCase().trim())
    );

    interface AgentRec {
      name: string;
      role: string;
      status: string;
      phase: string;
      priority: string;
      priorityNum: number;
    }

    const unimplemented: AgentRec[] = [];
    for (const sa of stateAgents) {
      const a = rec(sa);
      const status = str(a.status);
      if (status === 'implemented' || status === 'modified' || status === 'skipped') continue;

      const name = str(a.name);
      const bpAgent = team.find((t: unknown) => str(rec(t).name).toLowerCase().trim() === name.toLowerCase().trim());
      const role = bpAgent ? str(rec(bpAgent).role) || str(rec(bpAgent).agentRole) : '-';
      const epic = findEpicForAgent(name);
      const phase = epic?.phase || '-';
      const priority = epic?.priority || '-';

      unimplemented.push({
        name,
        role,
        status,
        phase,
        priority,
        priorityNum: priorityKey(priority),
      });
    }

    // Sort by roadmap priority
    unimplemented.sort((a, b) => a.priorityNum - b.priorityNum);

    if (unimplemented.length > 0) {
      lines.push('## Next Agents to Implement', '');
      for (const agent of unimplemented) {
        recNum++;
        const statusLabel = agent.status === 'in_progress' ? ' (in progress)' : '';
        lines.push(`### ${recNum}. ${agent.status === 'in_progress' ? 'Continue' : 'Implement'} ${agent.name}${statusLabel}`, '');
        lines.push(`Role: ${agent.role}`);
        if (agent.phase !== '-') lines.push(`Roadmap phase: ${agent.phase} | Priority: ${agent.priority}`);
        lines.push(`Read agent spec in \`references/agent-specifications.md\`.`, '');
      }
    }
  }

  // --- Section 2: Metric deviations ---
  if (hasProgressData(input)) {
    const progress = input.progress!;
    const deviating = progress.actuals
      .filter(a => a.status === 'major_deviation' || a.status === 'minor_deviation')
      .sort((a, b) => {
        // Major before minor
        if (a.status !== b.status) return a.status === 'major_deviation' ? -1 : 1;
        // Then by absolute deviation descending
        const absA = Math.abs(a.deviationPercent ?? 0);
        const absB = Math.abs(b.deviationPercent ?? 0);
        return absB - absA;
      });

    if (deviating.length > 0) {
      lines.push('## Metrics Requiring Attention', '');
      for (const metric of deviating) {
        recNum++;
        const devPct = metric.deviationPercent != null ? `${metric.deviationPercent > 0 ? '+' : ''}${metric.deviationPercent.toFixed(1)}%` : '-';
        lines.push(`### ${recNum}. Address ${metric.metricName} deviation`, '');
        lines.push(`Target: ${metric.predictedValue} | Actual: ${metric.actualValue} | Deviation: ${devPct}`);
        lines.push(`Status: ${metric.status}`);

        // Financial context
        const quantifiedROI = rec(rec(bc.benefits).quantifiedROI);
        if (metric.metricType === 'financial' && str(quantifiedROI.roi)) {
          lines.push(`Financial impact: This metric is tracked against the projected ${str(quantifiedROI.roi)} ROI in the business case.`);
        } else if (str(quantifiedROI.roi)) {
          const annualSavings = str(rec(rec(quantifiedROI.laborCostDetail).projectedSavings).costSavingsAnnual);
          if (annualSavings) {
            lines.push(`Financial context: Operational metrics drive the projected ${annualSavings} annual savings in the business case.`);
          }
        }
        lines.push('');
      }
    }
  }

  // --- Section 3: Spec deviations ---
  if (hasImplementationData(input)) {
    const sd = rec(input.implementationState!.stateData);
    const stateAgents = arr(sd.agents);

    const agentsWithDeviations = stateAgents
      .map((a: unknown) => rec(a))
      .filter(a => arr(a.deviations).length > 0);

    if (agentsWithDeviations.length > 0) {
      lines.push('## Deviations to Review', '');
      for (const agent of agentsWithDeviations) {
        recNum++;
        const name = str(agent.name);
        const bpAgent = team.find((t: unknown) => str(rec(t).name).toLowerCase().trim() === name.toLowerCase().trim());
        const role = bpAgent ? str(rec(bpAgent).role) || str(rec(bpAgent).agentRole) : '-';

        lines.push(`### ${recNum}. Review deviations: ${name}`, '');
        lines.push(`Planned role: ${role}`, '');
        for (const d of arr(agent.deviations)) {
          lines.push(`- ${str(d)}`);
        }
        lines.push('');
        lines.push('Check if these deviations affect the agent\'s success metrics in `references/evaluation-criteria.md`.', '');
      }
    }
  }

  // --- Section 4: Financial impact note ---
  if (hasProgressData(input)) {
    const progress = input.progress!;
    const deviationCount = progress.summary.minorDeviation + progress.summary.majorDeviation;
    const quantifiedROI = rec(rec(bc.benefits).quantifiedROI);

    if (deviationCount > 0 && str(quantifiedROI.roi)) {
      lines.push('## Financial Impact Note', '');
      const payback = str(quantifiedROI.paybackPeriod);
      lines.push(`${deviationCount} metric${deviationCount > 1 ? 's are' : ' is'} deviating from targets. The business case projected ${str(quantifiedROI.roi)} ROI${payback ? ` and ${payback} payback period` : ''}.`);
      lines.push('Track whether deviations affect these projections using Agent Blueprint\'s performance monitoring.', '');
    }
  }

  if (recNum === 0) {
    lines.push('All agents implemented and metrics on track. No action items at this time.', '');
  }

  return lines.join('\n');
}

function buildEvaluationCriteria(input: SkillRenderInput): string {
  const { blueprintData, businessCaseData } = input;
  const bp = rec(blueprintData);
  const bc = rec(businessCaseData);
  const progressMap = buildProgressByName(input);
  const hasActuals = progressMap.size > 0;

  const lines: string[] = [
    '# Evaluation Criteria',
    '',
    '> Machine-readable success metrics for deployment monitoring.',
    '> Map these criteria to your monitoring system to track agent performance.',
    '',
  ];

  const roiBaseline = rec(bp.roiBaseline);
  const roiOps = arr(roiBaseline.operational);
  const roiFin = arr(roiBaseline.financial);

  const objectives = rec(bc.objectives);
  const successMetrics = arr(objectives.successMetrics);

  const successMetricsByName = new Map<string, Record<string, unknown>>();
  for (const sm of successMetrics) {
    const m = rec(sm);
    const key = normalizeMetricName(str(m.metric));
    if (key) successMetricsByName.set(key, m);
  }

  const kpis = arr(rec(bp.successCriteria).kpis);
  const quantifiedROI = rec(rec(bc.benefits).quantifiedROI);
  const team = arr(bp.enhancedDigitalTeam);

  let hasContent = false;

  // --- Operational Metrics ---
  interface OpMetricRow {
    name: string; baseline: string; target: string;
    direction: string; unit: string; frequency: string;
    source: string;
  }
  const normalizeTarget = (t: string) => t.replace(/[%$<>~,\s]/g, '');
  const collectedOps: OpMetricRow[] = [];

  if (roiOps.length > 0) {
    for (const item of roiOps) {
      const m = rec(item);
      const name = str(m.name);
      const enrichment = successMetricsByName.get(normalizeMetricName(name));
      const baseline = enrichment ? str(rec(enrichment).currentValue) : '';
      const frequency = enrichment ? str(rec(enrichment).measurementFrequency) : '';
      collectedOps.push({
        name, baseline: baseline || '-', target: str(m.predictedValue),
        direction: str(m.direction) || '-', unit: str(m.unit) || '-',
        frequency: frequency || '-', source: str(m.source),
      });
    }
  } else if (successMetrics.length > 0) {
    for (const item of successMetrics) {
      const m = rec(item);
      collectedOps.push({
        name: str(m.metric), baseline: str(m.currentValue) || '-',
        target: str(m.targetValue), direction: str(m.direction) || '-',
        unit: str(m.unit) || '-', frequency: str(m.measurementFrequency) || '-',
        source: 'businessCase.objectives',
      });
    }
  } else if (kpis.length > 0) {
    for (const item of kpis) {
      const m = rec(item);
      collectedOps.push({
        name: str(m.name), baseline: '-', target: str(m.target),
        direction: '-', unit: str(m.unit) || '-', frequency: '-',
        source: 'successCriteria.kpis',
      });
    }
  }

  // Deduplicate: group by (direction, normalizedTarget), keep the row with most non-empty fields
  const dedupKey = (r: OpMetricRow) => `${r.direction}::${normalizeTarget(r.target)}`;
  const dedupGroups = new Map<string, OpMetricRow[]>();
  for (const row of collectedOps) {
    const k = dedupKey(row);
    const group = dedupGroups.get(k);
    if (group) group.push(row);
    else dedupGroups.set(k, [row]);
  }
  const fieldScore = (r: OpMetricRow) =>
    [r.name, r.baseline, r.target, r.direction, r.unit, r.frequency, r.source]
      .filter(v => v && v !== '-').length;
  const dedupedOps: OpMetricRow[] = [];
  for (const group of dedupGroups.values()) {
    group.sort((a, b) => fieldScore(b) - fieldScore(a));
    dedupedOps.push(group[0]);
  }

  const operationalRows = dedupedOps.map(r => {
    if (hasActuals) {
      const match = progressMap.get(normalizeMetricName(r.name));
      const actual = match ? match.actualValue : '-';
      const status = match ? match.status : '-';
      const measured = match ? match.recordedAt.split('T')[0] : '-';
      return `| ${r.name} | ${r.baseline} | ${r.target} | ${actual} | ${status} | ${measured} | ${r.direction} | ${r.unit} | ${r.frequency} | ${r.source} |`;
    }
    return `| ${r.name} | ${r.baseline} | ${r.target} | ${r.direction} | ${r.unit} | ${r.frequency} | ${r.source} |`;
  });

  if (operationalRows.length > 0) {
    hasContent = true;
    if (hasActuals) {
      lines.push(
        '## Operational Metrics', '',
        '| Metric | Baseline | Target | Actual | Status | Measured | Direction | Unit | Frequency | Source |',
        '|--------|----------|--------|--------|--------|----------|-----------|------|-----------|--------|',
        ...operationalRows, '',
      );
    } else {
      lines.push(
        '## Operational Metrics', '',
        '| Metric | Baseline | Target | Direction | Unit | Frequency | Source |',
        '|--------|----------|--------|-----------|------|-----------|--------|',
        ...operationalRows, '',
      );
    }
  }

  // --- Financial Metrics ---
  interface FinMetricRow { name: string; target: string; direction: string; unit: string; source: string }
  const collectedFin: FinMetricRow[] = [];

  if (roiFin.length > 0) {
    for (const item of roiFin) {
      const m = rec(item);
      collectedFin.push({
        name: str(m.name), target: str(m.predictedValue),
        direction: str(m.direction) || '-', unit: str(m.unit) || '-', source: str(m.source),
      });
    }
  } else {
    if (str(quantifiedROI.roi)) {
      collectedFin.push({ name: 'ROI', target: str(quantifiedROI.roi), direction: 'higher_is_better', unit: '%', source: 'quantifiedROI' });
    }
    if (str(quantifiedROI.paybackPeriod)) {
      collectedFin.push({ name: 'Payback Period', target: str(quantifiedROI.paybackPeriod), direction: 'lower_is_better', unit: 'months', source: 'quantifiedROI' });
    }
    if (str(quantifiedROI.npv)) {
      collectedFin.push({ name: 'NPV', target: str(quantifiedROI.npv), direction: 'higher_is_better', unit: 'currency', source: 'quantifiedROI' });
    }
    const annualSavings = str(rec(rec(quantifiedROI.laborCostDetail).projectedSavings).costSavingsAnnual);
    if (annualSavings) {
      collectedFin.push({ name: 'Annual Cost Savings', target: annualSavings, direction: 'higher_is_better', unit: 'currency', source: 'quantifiedROI' });
    }
  }

  const financialRows = collectedFin.map(r => {
    if (hasActuals) {
      const match = progressMap.get(normalizeMetricName(r.name));
      const actual = match ? match.actualValue : '-';
      const status = match ? match.status : '-';
      return `| ${r.name} | ${r.target} | ${actual} | ${status} | ${r.direction} | ${r.unit} | ${r.source} |`;
    }
    return `| ${r.name} | ${r.target} | ${r.direction} | ${r.unit} | ${r.source} |`;
  });

  if (financialRows.length > 0) {
    hasContent = true;
    if (hasActuals) {
      lines.push(
        '## Financial Metrics', '',
        '| Metric | Target | Actual | Status | Direction | Unit | Source |',
        '|--------|--------|--------|--------|-----------|------|--------|',
        ...financialRows, '',
      );
    } else {
      lines.push(
        '## Financial Metrics', '',
        '| Metric | Target | Direction | Unit | Source |',
        '|--------|--------|-----------|------|--------|',
        ...financialRows, '',
      );
    }
  }

  // --- Agent-Level Metrics ---
  const agentRows: string[] = [];
  for (const agent of team) {
    const a = rec(agent);
    const metrics = arr(a.successMetrics);
    for (const item of metrics) {
      const m = rec(item);
      if (hasActuals) {
        const match = progressMap.get(normalizeMetricName(str(m.metric)));
        const actual = match ? match.actualValue : '-';
        const status = match ? match.status : '-';
        agentRows.push(`| ${str(a.name)} | ${str(m.metric)} | ${str(m.target)} | ${actual} | ${status} |`);
      } else {
        agentRows.push(`| ${str(a.name)} | ${str(m.metric)} | ${str(m.target)} |`);
      }
    }
  }

  if (agentRows.length > 0) {
    hasContent = true;
    if (hasActuals) {
      lines.push(
        '## Agent-Level Metrics', '',
        '| Agent | Metric | Target | Actual | Status |',
        '|-------|--------|--------|--------|--------|',
        ...agentRows, '',
      );
    } else {
      lines.push(
        '## Agent-Level Metrics', '',
        '| Agent | Metric | Target |',
        '|-------|--------|--------|',
        ...agentRows, '',
      );
    }
  }

  if (!hasContent) {
    lines.push(
      '> No evaluation criteria available yet. Generate a Business Case to populate',
      '> operational and financial metrics, or add success metrics to agent specifications.',
      '',
    );
  }

  // --- Monitoring Guidance ---
  lines.push(
    '## Monitoring Guidance', '',
    '> If using Agent Blueprint\'s performance monitoring feature, these criteria can inform metric setup:',
    '> - Operational metrics correspond to `metricType: "operational"`',
    '> - Financial metrics correspond to `metricType: "financial"`',
    '> - Use metric names and targets when recording actuals via the Performance tab or webhook integrations',
    '',
  );

  return lines.join('\n');
}

function buildGettingStartedReturnVisit(input: SkillRenderInput): string {
  const lines: string[] = [];
  const sd = rec(input.implementationState!.stateData);
  const stateAgents = arr(sd.agents);
  const team = arr(rec(input.blueprintData).enhancedDigitalTeam);
  const totalAgents = stateAgents.length || team.length;

  let implementedCount = 0;
  const inProgressNames: string[] = [];
  for (const sa of stateAgents) {
    const a = rec(sa);
    const status = str(a.status);
    if (status === 'implemented' || status === 'modified') implementedCount++;
    if (status === 'in_progress') inProgressNames.push(str(a.name));
  }

  lines.push('# Getting Started');
  lines.push('');
  lines.push('YOU ARE CONTINUING AN IMPLEMENTATION. Implementation state has been synced');
  lines.push('back to Agent Blueprint. Read `CURRENT-STATE.md` for where things stand');
  lines.push('and `RECOMMENDATIONS.md` for what to do next.');
  lines.push('');
  lines.push('## Current status');
  lines.push('');
  lines.push(`${implementedCount} of ${totalAgents} agents implemented. Overall: ${str(sd.overall_status) || 'in_progress'}.`);
  if (inProgressNames.length > 0) {
    lines.push(`In progress: ${inProgressNames.join(', ')}.`);
  }

  if (hasProgressData(input)) {
    const s = input.progress!.summary;
    lines.push(`${s.onTrack} metric${s.onTrack !== 1 ? 's' : ''} on track, ${s.minorDeviation} minor deviation${s.minorDeviation !== 1 ? 's' : ''}, ${s.majorDeviation} major deviation${s.majorDeviation !== 1 ? 's' : ''}.`);
  }
  lines.push('');

  // Ground rules (same as first visit)
  lines.push('## Ground rules (MUST FOLLOW)');
  lines.push('');
  lines.push('- **Do not summarize the blueprint.** The user already knows what they bought.');
  lines.push('  Do not list agents, describe the architecture, or restate the problem.');
  lines.push('  Go straight to building.');
  lines.push('- **Do not ask questions you can answer yourself.** Check your configured MCP');
  lines.push('  servers, read the spec files, query the platform. Only ask the user when');
  lines.push('  you genuinely cannot proceed without their input.');
  lines.push('- **Act, then report.** Do not narrate what you are about to do. Do it, then');
  lines.push('  tell the user what you did and what comes next. One short status per milestone.');
  lines.push('- **Be decisive.** When you know the right approach, take it. Do not present');
  lines.push('  options and ask the user to choose. Recommend and act.');
  lines.push('- **Recover fast.** When something fails, try the obvious fix immediately.');
  lines.push('  One fix, one alternative, then ask. Do not spiral.');
  lines.push('- **Verify before presenting.** Never give the user a URL, path, or command');
  lines.push('  you have not verified against the actual platform instance.');
  lines.push('');

  // Step 1
  lines.push('## Step 1: Review current state');
  lines.push('');
  lines.push('Read `CURRENT-STATE.md` for the full implementation picture:');
  lines.push('- Which agents are implemented, in progress, or not started');
  lines.push('- Platform and architecture decisions made so far');
  lines.push('- Performance against targets (if metrics have been reported)');
  lines.push('');

  // Step 2
  lines.push('## Step 2: Follow recommendations');
  lines.push('');
  lines.push('Read `RECOMMENDATIONS.md` for prioritized next actions:');
  lines.push('- Agents to implement next (ordered by roadmap priority)');
  lines.push('- Metrics that need attention (deviations from targets)');
  lines.push('- Deviations from spec that warrant review');
  lines.push('');

  // Step 3
  lines.push('## Step 3: Continue implementation');
  lines.push('');
  if (inProgressNames.length > 0) {
    lines.push(`Agent${inProgressNames.length > 1 ? 's' : ''} in progress: ${inProgressNames.join(', ')}. Pick up where you left off.`);
    lines.push('');
  }

  if (input.vendorSkill) {
    lines.push(`The \`.claude/skills/${input.vendorSkill.skillName}/\` skill contains platform-specific`);
    lines.push('deployment guidance. Follow it for all platform-specific work.');
    lines.push('');
  }

  lines.push('For each agent:');
  lines.push('1. Review the agent spec in `references/agent-specifications.md`');
  lines.push('2. Build the agent with its tools and instructions');
  lines.push('3. Test and iterate until behavior matches the spec');
  lines.push('4. Update `implementation-state.yaml` with status and platform artifact');
  lines.push('5. Move to the next agent');
  lines.push('');

  // Step 4
  lines.push('## Step 4: Validate and measure');
  lines.push('');
  lines.push('Use `references/evaluation-criteria.md` to verify success metrics.');
  lines.push('Report actuals:');
  lines.push('');
  lines.push('  agentblueprint report-metric <blueprint-id> --metric "Metric Name" --value "actual"');
  lines.push('');

  // Step 5
  lines.push('## Step 5: Sync your progress');
  lines.push('');
  lines.push('After implementing each agent or making significant changes, sync immediately:');
  lines.push('');
  lines.push('**MCP tool** (preferred):');
  lines.push('');
  lines.push('    Use the sync_implementation_state tool with:');
  lines.push(`      blueprintId: "${input.blueprintId}"`);
  lines.push('      stateData: <contents of implementation-state.yaml as JSON>');
  lines.push('');
  lines.push('**CLI**:');
  lines.push('');
  lines.push(`    agentblueprint sync <blueprint-id>`);
  lines.push('');
  lines.push('When you observe actual metric values, report them:');
  lines.push('');
  lines.push('    Use the report_metric tool with:');
  lines.push(`      blueprintId: "${input.blueprintId}"`);
  lines.push('      metrics:');
  lines.push('        - metricName: "Metric Name"');
  lines.push('          actualValue: "measured value"');
  lines.push('');
  lines.push('See `AGENTS.md` for trigger points, deviation rules, and full sync guidance.');
  lines.push('');
  lines.push('**Claude Code users**: See `hooks/claude-code-sync.json` for a Stop hook that');
  lines.push('reminds you to sync when implementation-state.yaml has unsynced changes.');
  lines.push('');

  // Platform patterns (same as first visit)
  lines.push('## Platform patterns');
  lines.push('');
  lines.push('These patterns help you map the vendor-agnostic spec to your target platform:');
  lines.push('');
  lines.push('- **Agent orchestration**: Look for your platform\'s agent/bot framework,');
  lines.push('  workflow engine, or flow builder. The spec describes a');

  const pattern = getPatternName(input);
  if (pattern) {
    lines.push(`  ${pattern} pattern -- find your platform's equivalent orchestration mechanism.`);
  } else {
    lines.push('  multi-agent pattern -- find your platform\'s equivalent orchestration mechanism.');
  }

  lines.push('- **Data integration**: Check what APIs or connectors exist for the data sources');
  lines.push('  listed in `references/architecture-decisions.md`. Prefer native connectors');
  lines.push('  over custom API calls.');
  lines.push('- **Guardrails**: Map the escalation rules from `references/guardrails-and-governance.md`');
  lines.push('  to platform-native controls (approval chains, role-based access, audit logs).');
  lines.push('- **Scoping**: Some platforms have namespace or scope constraints on API-created');
  lines.push('  records. If records don\'t appear in the expected scope, check your platform\'s');
  lines.push('  documentation on scoped app deployment.');
  lines.push('');

  // Footer
  lines.push('---');
  lines.push('');
  lines.push('Generated by [Agent Blueprint](https://app.agentblueprint.ai)');
  lines.push('');

  return lines.join('\n');
}

function buildGettingStarted(input: SkillRenderInput): string {
  if (hasImplementationData(input)) {
    return buildGettingStartedReturnVisit(input);
  }

  const lines: string[] = [];

  lines.push('# Getting Started');
  lines.push('');
  lines.push('YOU ARE THE IMPLEMENTER. This guide tells you what to do. Do not summarize');
  lines.push('this blueprint back to the user. Do not ask the user to review files. Read');
  lines.push('the spec, connect to the platform, and start building.');
  lines.push('');
  lines.push('## Ground rules (MUST FOLLOW)');
  lines.push('');
  lines.push('- **Do not summarize the blueprint.** The user already knows what they bought.');
  lines.push('  Do not list agents, describe the architecture, or restate the problem.');
  lines.push('  Go straight to connecting and building.');
  lines.push('- **Do not ask questions you can answer yourself.** Check your configured MCP');
  lines.push('  servers, read the spec files, query the platform. Only ask the user when');
  lines.push('  you genuinely cannot proceed without their input.');
  lines.push('- **Act, then report.** Do not narrate what you are about to do. Do it, then');
  lines.push('  tell the user what you did and what comes next. One short status per milestone.');
  lines.push('- **Be decisive.** When you know the right approach, take it. Do not present');
  lines.push('  options and ask the user to choose. Recommend and act.');
  lines.push('- **Recover fast.** When something fails, try the obvious fix immediately.');
  lines.push('  One fix, one alternative, then ask. Do not spiral.');
  lines.push('- **Verify before presenting.** Never give the user a URL, path, or command');
  lines.push('  you have not verified against the actual platform instance.');
  lines.push('');

  // Step 1
  lines.push('## Step 1: Understand the architecture');
  lines.push('');
  lines.push('Read `SKILL.md` for the overview, then drill into reference files as needed:');
  lines.push('');
  lines.push('- `references/agent-specifications.md` -- detailed agent team design (start here)');
  lines.push('- `references/architecture-decisions.md` -- platform rationale and integration gaps');
  lines.push('- `references/implementation-roadmap.md` -- phased rollout plan with epics and stories');
  lines.push('- `references/guardrails-and-governance.md` -- risk controls and escalation rules');
  lines.push('');

  // Step 2
  lines.push('## Step 2: Connect to the target platform');
  lines.push('');
  lines.push('Ask the user where they want to deploy this. Three scenarios:');
  lines.push('');
  lines.push('**A. User has a platform and instance ready** (e.g., ServiceNow, Salesforce):');
  lines.push('1. Get the instance URL and credentials.');
  lines.push('2. Confirm this is a development or sandbox instance, not production.');
  lines.push('3. Verify you are connected to the correct instance before making any changes.');
  lines.push('');
  if (input.vendorSkill) {
    const platformLabel = input.vendorSkill.platform.charAt(0).toUpperCase() + input.vendorSkill.platform.slice(1);
    lines.push(`A ${platformLabel} expert skill has been installed at \`.claude/skills/${input.vendorSkill.skillName}/\`.`);
    lines.push('It contains the connection verification steps, deployment sequence, platform');
    lines.push('patterns, and debugging guidance. Follow it for all platform-specific work.');
  } else {
    lines.push('If `references/deployment-guide-*.md` files are present, read those for');
    lines.push('platform-specific tooling, deployment sequence, and gotchas.');
  }
  lines.push('');
  lines.push('**B. User wants to build from scratch** (custom code, open-source frameworks):');
  lines.push('Help them choose a framework based on the blueprint architecture. Search the web');
  lines.push('for current agentic AI frameworks and their capabilities -- this space moves fast');
  lines.push('and your training data may be outdated. Consider the blueprint\'s orchestration');
  lines.push('pattern (manager-workers, parallel tasks, tool use) when recommending. Common');
  lines.push('options include LangGraph, CrewAI, AutoGen, OpenAI Agents SDK, and Claude Agent');
  lines.push('SDK, but search for what is current before recommending.');
  lines.push('');
  lines.push('**C. User is unsure what platform to use:**');
  lines.push('Ask about their existing tech stack, budget, and team skills. Search the web for');
  lines.push('current agentic AI platforms that fit their constraints. Compare options and');
  lines.push('recommend one. The blueprint is vendor-agnostic -- it can be deployed to any');
  lines.push('platform that supports AI agents with tool use.');
  lines.push('');

  // Step 3
  lines.push('## Step 3: Start with the pilot');
  lines.push('');
  lines.push('Check `references/implementation-roadmap.md` for Phase 1 scope.');
  lines.push('Build the lead agent first. Validate it works before expanding to the full team.');
  lines.push('');
  if (input.vendorSkill) {
    lines.push(`The \`.claude/skills/${input.vendorSkill.skillName}/\` skill contains the deployment`);
    lines.push('sequence and platform-specific patterns. Follow its guidance for implementation.');
  } else {
    lines.push('If a vendor deployment guide is included (`references/deployment-guide-*.md`),');
    lines.push('follow its deployment sequence instead of the general pattern below.');
  }
  lines.push('');
  lines.push('General pattern (fallback when no deployment guide is present):');
  lines.push('1. Create the data model (tables, fields, relationships) for the pilot scope');
  lines.push('2. Build the first worker agent with its tools and instructions');
  lines.push('3. Add seed or test data to exercise the agent');
  lines.push('4. Test and iterate until behavior matches the spec');
  lines.push('5. Add remaining agents one at a time, testing after each');
  lines.push('6. Wire the orchestrator last, once all workers are validated');
  lines.push('');

  // Step 4
  lines.push('## Step 4: Validate');
  lines.push('');
  lines.push('Use `references/evaluation-criteria.md` to verify success metrics');
  lines.push('are measurable in the target platform. Run `scripts/validate-spec.sh`');
  lines.push('to check structural completeness of the spec files.');
  lines.push('');

  // Step 5
  lines.push('## Step 5: Track progress and close the loop');
  lines.push('');
  lines.push('As you implement each agent, update `implementation-state.yaml`:');
  lines.push('');
  lines.push('1. Set the agent\'s `status` to `in_progress` when you start, `implemented` when done.');
  lines.push('2. Record the `platform_artifact` (sys_id, function name, service URL, etc.).');
  lines.push('3. Note any `deviations` from the spec and why you made them.');
  lines.push('4. List `integrations_connected` for each agent.');
  lines.push('5. Update `overall_status` as you progress.');
  lines.push('6. Fill in the `platform` section with the actual platform, version, and environment.');
  lines.push('');
  lines.push('### Sync trigger points');
  lines.push('');
  lines.push('Sync after each of these events (do not wait until the end):');
  lines.push('- After implementing an agent');
  lines.push('- After connecting an integration');
  lines.push('- After modifying an agent\'s behavior');
  lines.push('- At the end of every coding session');
  lines.push('');
  lines.push('### How to sync');
  lines.push('');
  lines.push('**MCP tool** (preferred when Agent Blueprint MCP server is connected):');
  lines.push('');
  lines.push('    Use the sync_implementation_state tool with:');
  lines.push(`      blueprintId: "${input.blueprintId}"`);
  lines.push('      stateData: <contents of implementation-state.yaml as JSON>');
  lines.push('');
  lines.push('**CLI**:');
  lines.push('');
  lines.push(`    agentblueprint sync <blueprint-id>`);
  lines.push('');
  lines.push('### Reporting metrics');
  lines.push('');
  lines.push('When you observe actual metric values in the running system, report them:');
  lines.push('');
  lines.push('    Use the report_metric tool with:');
  lines.push(`      blueprintId: "${input.blueprintId}"`);
  lines.push('      metrics:');
  lines.push('        - metricName: "Metric Name"');
  lines.push('          actualValue: "measured value"');
  lines.push('');
  lines.push('See `AGENTS.md` for the full sync rules and all trigger points.');
  lines.push('');
  lines.push('**Claude Code users**: See `hooks/claude-code-sync.json` for a Stop hook that');
  lines.push('reminds you to sync when implementation-state.yaml has unsynced changes.');
  lines.push('');

  // Platform patterns
  lines.push('## Platform patterns');
  lines.push('');
  lines.push('These patterns help you map the vendor-agnostic spec to your target platform:');
  lines.push('');
  lines.push('- **Agent orchestration**: Look for your platform\'s agent/bot framework,');
  lines.push('  workflow engine, or flow builder. The spec describes a');

  const pattern = getPatternName(input);
  if (pattern) {
    lines.push(`  ${pattern} pattern -- find your platform's equivalent orchestration mechanism.`);
  } else {
    lines.push('  multi-agent pattern -- find your platform\'s equivalent orchestration mechanism.');
  }

  lines.push('- **Data integration**: Check what APIs or connectors exist for the data sources');
  lines.push('  listed in `references/architecture-decisions.md`. Prefer native connectors');
  lines.push('  over custom API calls.');
  lines.push('- **Guardrails**: Map the escalation rules from `references/guardrails-and-governance.md`');
  lines.push('  to platform-native controls (approval chains, role-based access, audit logs).');
  lines.push('- **Scoping**: Some platforms have namespace or scope constraints on API-created');
  lines.push('  records. If records don\'t appear in the expected scope, check your platform\'s');
  lines.push('  documentation on scoped app deployment.');
  lines.push('');

  // Footer
  lines.push('---');
  lines.push('');
  lines.push('Generated by [Agent Blueprint](https://app.agentblueprint.ai)');
  lines.push('');

  return lines.join('\n');
}

/** Extract pattern name from blueprint data for getting-started guidance. */
function getPatternName(input: SkillRenderInput): string | null {
  const data = input.blueprintData as Record<string, unknown> | undefined;
  if (!data) return null;
  const pattern = (data.pattern ?? data.architecturePattern ?? data.multiAgentPattern) as string | undefined;
  return pattern || null;
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
check_file "GETTING-STARTED.md"
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
check_optional "references/evaluation-criteria.md"
check_optional "references/platform-connectivity.md"

echo ""
echo "--- Implementation Tracking ---"
check_optional "implementation-state.yaml"

echo ""
echo "--- Deployment Guides ---"
GUIDE_COUNT=0
for guide in references/deployment-guide-*.md; do
  if [ -f "$guide" ]; then
    echo "OK: $guide"
    GUIDE_COUNT=$((GUIDE_COUNT + 1))
  fi
done
if [ $GUIDE_COUNT -eq 0 ]; then
  echo "INFO: No deployment guides found (references/deployment-guide-*.md)"
fi

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
// PLATFORM CONNECTIVITY REFERENCE (static content -- no input params needed)
// =============================================================================

function buildPlatformConnectivity(): string {
  const lines: string[] = [
    '# Platform Connectivity Reference',
    '',
    '> Quick reference for connecting your coding agent to popular agentic platforms.',
    '> This guide lists recommended tools and patterns -- your coding agent will handle the specifics.',
    '',
    '## General Approach',
    '',
    'Before connecting to any platform, ask the user for credentials and access details.',
    'Prefer official SDKs and CLIs over raw REST calls -- they handle authentication,',
    'pagination, and error handling. When an MCP server exists for the target platform,',
    'use it for the richest tool integration.',
    '',
    '## ServiceNow',
    '',
    '- **Recommended MCP server**: https://github.com/sonisoft-cnanda/nowsdk-ext-mcp',
    '- **Alternatives**: https://github.com/michaelbuckner/servicenow-mcp, https://github.com/Happy-Technologies-LLC/mcp-servicenow-nodejs',
    '- **No MCP server?** Fall back to REST API (Table API for CRUD, `/sys.scripts.do` for bulk operations). Ask the user for instance URL and credentials.',
    '',
    '## OpenClaw',
    '',
    '- **Recommended**: OpenClaw CLI (`openclaw`)',
    '- **Skills directory**: `.openclaw/skills/` for agent definitions',
    '- **Configuration**: YAML-based agent and tool definitions',
    '',
    '## Google Cloud (Vertex AI)',
    '',
    '- **Recommended**: gcloud CLI + Vertex AI SDK',
    '- **Workflows**: Google Cloud Workflows for orchestration',
    '- **Data**: BigQuery for data backbone',
    '',
    '## Microsoft (Copilot Studio / Azure)',
    '',
    '- **Recommended**: Azure CLI (`az`) + Power Platform CLI (`pac`)',
    '- **Agents**: Copilot Studio for agent definitions',
    '- **Flows**: Power Automate for workflow orchestration',
    '',
    '## Salesforce (Agentforce)',
    '',
    '- **Recommended**: Salesforce CLI (`sf`, formerly sfdx)',
    '- **Metadata**: Source-driven development with scratch orgs',
    '- **Integration**: MuleSoft for external system connectivity',
    '',
    '## AWS (Bedrock Agents)',
    '',
    '- **Recommended**: AWS CLI (`aws`) + CDK/CloudFormation',
    '- **Agents**: Bedrock Agent API for agent definitions',
    '- **Orchestration**: Step Functions for workflow coordination',
    '',
    '## Custom / In-House',
    '',
    '- Use your platform\'s native API or SDK',
    '- The agent specifications in this blueprint are vendor-agnostic',
    '- Map the agent team structure to your framework\'s equivalent concepts',
    '',
    '---',
    '',
    'Generated by [Agent Blueprint](https://app.agentblueprint.ai)',
  ];
  return lines.join('\n');
}

// =============================================================================
// IMPLEMENTATION STATE TEMPLATE
// =============================================================================

function buildImplementationState(input: SkillRenderInput): string {
  const bp = input.blueprintData as Record<string, unknown>;
  const team = getTeam(bp);
  const pattern = getAgenticPattern(bp);

  const lines: string[] = [];

  // Header
  lines.push('# implementation-state.yaml');
  lines.push('# Updated by the coding agent as implementation progresses.');
  lines.push('# Sync back to Agent Blueprint: agentblueprint sync <blueprint-id>');
  lines.push('');
  lines.push('schema_version: "1.0"');
  lines.push(`blueprint_id: "${input.blueprintId}"`);
  lines.push('last_updated: ""');
  lines.push('');
  lines.push('overall_status: not_started  # not_started | in_progress | partial | complete');
  lines.push('');

  // Platform
  lines.push('platform:');
  lines.push('  name: ""           # e.g., "ServiceNow", "Salesforce", "Custom Node.js"');
  lines.push('  version: ""        # e.g., "Australia", "Spring \'26"');
  lines.push('  environment: ""    # e.g., "dev", "staging", "production"');
  lines.push('');

  // Agents
  if (team.length === 0) {
    lines.push('agents: []  # No agents defined in blueprint');
  } else {
    lines.push('agents:');
    for (let i = 0; i < team.length; i++) {
      const agent = team[i] as Record<string, unknown>;
      const name = str(agent.name);
      const escapedName = name.replace(/"/g, '\\"');
      const type = str(agent.agentRole) || str(agent.orchestrationRole) || str(agent.type) || 'Worker';
      const tools = arr(agent.enhancedTools).map((t: Record<string, unknown>) => str(t.name)).filter(Boolean);
      const toolHint = tools.length > 0 ? ` | tools: ${tools.join(', ')}` : '';

      lines.push(`  - name: "${escapedName}"`);
      lines.push(`    # role: ${type}${toolHint}`);
      if (i === 0) {
        lines.push('    status: not_started  # not_started | in_progress | implemented | modified | skipped');
        lines.push('    platform_artifact: ""  # sys_id, function name, service URL, etc.');
      } else {
        lines.push('    status: not_started');
        lines.push('    platform_artifact: ""');
      }
      lines.push('    deviations: []');
      lines.push('    integrations_connected: []');
      lines.push('    notes: ""');
      if (i < team.length - 1) lines.push('');
    }
  }
  lines.push('');

  // Architecture
  lines.push('architecture:');
  lines.push(`  pattern: ""        # actual pattern used (spec recommends: ${pattern})`);
  lines.push('  deviations: []');
  lines.push('  additional_components: []');
  lines.push('');

  // Metrics -- collect and deduplicate from all agents
  const seenMetrics = new Set<string>();
  const metricEntries: { metric: string; target: string }[] = [];
  for (const agent of team) {
    const a = agent as Record<string, unknown>;
    const metrics = arr(a.successMetrics);
    for (const m of metrics) {
      const mr = rec(m);
      const metric = str(mr.metric);
      const target = str(mr.target);
      if (metric && !seenMetrics.has(metric)) {
        seenMetrics.add(metric);
        metricEntries.push({ metric, target });
      }
    }
  }

  if (metricEntries.length > 0) {
    lines.push('# To track metrics, replace [] with entries:');
    lines.push('metrics_observed: []');
    lines.push('  # Blueprint-defined success metrics:');
    for (const entry of metricEntries) {
      lines.push(`  # - metric: "${entry.metric}"`);
      lines.push(`  #   target: "${entry.target}"`);
      lines.push('  #   actual: ""');
      lines.push('  #   measured_at: ""');
      lines.push('  #   source: ""');
    }
  } else {
    lines.push('metrics_observed: []');
  }

  return lines.join('\n') + '\n';
}

// =============================================================================
// AGENTS.MD -- UNIVERSAL SYNC RULES
// =============================================================================

function buildAgentsMd(input: SkillRenderInput): string {
  const bpId = input.blueprintId;
  const lines: string[] = [];

  lines.push('# Sync Rules');
  lines.push('');
  lines.push('Rules for keeping Agent Blueprint in sync with your implementation.');
  lines.push('These apply to ALL coding agents regardless of IDE or framework.');
  lines.push('');

  lines.push('## Blueprint ID');
  lines.push('');
  lines.push(`    ${bpId}`);
  lines.push('');

  lines.push('## When to sync implementation state');
  lines.push('');
  lines.push('Sync after each of these events:');
  lines.push('- After implementing an agent (status: not_started -> implemented)');
  lines.push('- After connecting an integration to an agent');
  lines.push('- After modifying an already-implemented agent (status -> modified)');
  lines.push('- After changing architecture decisions (e.g., switching orchestration pattern)');
  lines.push('- At the end of every coding session, if any agents changed');
  lines.push('');

  lines.push('## How to sync');
  lines.push('');
  lines.push('**MCP tool** (preferred when Agent Blueprint MCP server is connected):');
  lines.push('');
  lines.push('    Use the sync_implementation_state tool with:');
  lines.push(`      blueprintId: "${bpId}"`);
  lines.push('      stateData: <contents of implementation-state.yaml as JSON>');
  lines.push('');
  lines.push('**CLI** (alternative):');
  lines.push('');
  lines.push(`    agentblueprint sync <blueprint-id>`);
  lines.push('');
  lines.push('Both methods accept the data from implementation-state.yaml. Keep that file');
  lines.push('updated as you work.');
  lines.push('');

  lines.push('## When to report metrics');
  lines.push('');
  lines.push('Report metrics when you observe actual values in the running system:');
  lines.push('- After deploying an agent and observing its first real outputs');
  lines.push('- When reviewing dashboards or logs that show metric values');
  lines.push('- During validation testing against success criteria');
  lines.push('- Periodically as the system runs in production');
  lines.push('');

  lines.push('## How to report metrics');
  lines.push('');
  lines.push('**MCP tool** (preferred):');
  lines.push('');
  lines.push('    Use the report_metric tool with:');
  lines.push(`      blueprintId: "${bpId}"`);
  lines.push('      metrics:');
  lines.push('        - metricName: "Metric Name"');
  lines.push('          actualValue: "measured value"');
  lines.push('          notes: "how/where you measured this"');
  lines.push('');
  lines.push('**CLI**:');
  lines.push('');
  lines.push(`    agentblueprint report-metric <blueprint-id> --metric "Metric Name" --value "measured value"`);
  lines.push('');

  lines.push('## Documenting deviations');
  lines.push('');
  lines.push('When you deviate from the spec (different tool, different approach, skipped an agent):');
  lines.push('1. Update the agent\'s `deviations` array in implementation-state.yaml');
  lines.push('2. Include a brief reason (e.g., "Used Flow Designer instead of Workflow -- better parallel support")');
  lines.push('3. Sync so Agent Blueprint can track spec drift and adjust recommendations');
  lines.push('');

  lines.push('## Why this matters');
  lines.push('');
  lines.push('Each sync creates a versioned snapshot. Agent Blueprint uses your progress to:');
  lines.push('- Generate prioritized next-step recommendations');
  lines.push('- Track spec drift and surface deviations that need attention');
  lines.push('- Compare actual performance against predicted targets');
  lines.push('- Improve future blueprints based on real-world outcomes');
  lines.push('');

  return lines.join('\n');
}

// =============================================================================
// CLAUDE CODE HOOKS REFERENCE
// =============================================================================

function buildClaudeCodeHooksConfig(input: SkillRenderInput): string {
  const bpId = input.blueprintId;

  // Shell command: read stdin, check stop_hook_active, check for implementation-state.yaml changes
  // Uses jq for JSON parsing (no python3). Uses git status --porcelain to catch both tracked and untracked changes.
  // Stop hooks: exit 0 with no output = allow stop. Output {"decision":"block","reason":"..."} = block stop.
  const command = [
    'INPUT=$(cat);',
    'ACTIVE=$(echo "$INPUT" | jq -r \'.stop_hook_active // false\');',
    'if [ "$ACTIVE" = "true" ]; then exit 0; fi;',
    'if git status --porcelain 2>/dev/null | grep -q "implementation-state.yaml"; then',
    ` echo '{"decision":"block","reason":"implementation-state.yaml has unsynced changes. Run: agentblueprint sync ${bpId}"}';`,
    'fi',
  ].join(' ');

  const config = {
    _comment: [
      'Claude Code Stop hook reference for automated Agent Blueprint sync.',
      'Copy the "hooks" section into .claude/settings.json or .claude/settings.local.json.',
      'Review and adapt for your project before installing.',
      `Blueprint ID: ${bpId}`,
    ].join(' '),
    hooks: {
      Stop: [
        {
          hooks: [
            {
              type: 'command' as const,
              command,
              timeout: 30,
            },
          ],
        },
      ],
    },
  };

  return JSON.stringify(config, null, 2) + '\n';
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
  files.set('references/evaluation-criteria.md', buildEvaluationCriteria(input));
  files.set('references/platform-connectivity.md', buildPlatformConnectivity());

  // Getting Started guide
  files.set('GETTING-STARTED.md', buildGettingStarted(input));

  // Sync rules (universal -- all coding agents via AGENTS.md standard)
  files.set('AGENTS.md', buildAgentsMd(input));

  // Claude Code hooks reference (agent-specific -- Claude Code only)
  files.set('hooks/claude-code-sync.json', buildClaudeCodeHooksConfig(input));

  // Deployment guides (vendor skill replaces vendor deployment guide when present)
  if (input.generalGuide) {
    files.set('references/deployment-guide-general.md', input.generalGuide);
  }
  if (input.vendorGuide && !input.vendorSkill) {
    files.set(`references/deployment-guide-${input.vendorGuide.platform}.md`, input.vendorGuide.content);
  }

  // Vendor expert skill
  if (input.vendorSkill) {
    files.set(`.claude/skills/${input.vendorSkill.skillName}/SKILL.md`, input.vendorSkill.content);
  }

  // Scripts
  files.set('scripts/validate-spec.sh', buildValidateScript());

  // Implementation state template
  files.set('implementation-state.yaml', buildImplementationState(input));

  // Reality layer (return visits -- Living Blueprint Phase 3A)
  if (hasImplementationData(input)) {
    files.set('CURRENT-STATE.md', buildCurrentState(input));
  }
  if (hasImplementationData(input) || hasProgressData(input)) {
    files.set('RECOMMENDATIONS.md', buildRecommendations(input));
  }

  return files;
}
