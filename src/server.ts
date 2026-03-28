import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { AgentBlueprintClient } from './client.js';
import type { Config } from './config.js';
import { readBlueprint, blueprintResourceTemplate } from './resources/blueprint.js';
import { readBlueprintList, blueprintListResource } from './resources/blueprints.js';
import { readBusinessProfile, businessProfileResource } from './resources/business-profile.js';
import { readSpec, specResourceTemplate } from './resources/spec.js';
import { handleGetBlueprint } from './tools/get-blueprint.js';
import { handleGetBusinessCase } from './tools/get-business-case.js';
import { handleGetBusinessProfile } from './tools/get-business-profile.js';
import { handleGetImplementationPlan } from './tools/get-implementation-plan.js';
import { handleGetImplementationSpec } from './tools/get-implementation-spec.js';
import { handleGetUseCase } from './tools/get-use-case.js';
import { handleListBlueprints } from './tools/list-blueprints.js';
import { handleDownloadBlueprint } from './tools/download-blueprint.js';
import { handleSyncImplementationState } from './tools/sync-implementation-state.js';
import { handleReportMetric } from './tools/report-metric.js';
import { handleGetProgress } from './tools/get-progress.js';
import { handleUpdateBlueprint } from './tools/update-blueprint.js';
import { handleUpdateBusinessCase } from './tools/update-business-case.js';
import { handleUpdateImplementationPlan } from './tools/update-implementation-plan.js';
import { handleUpdateUseCase } from './tools/update-use-case.js';
import { handleUpdateBusinessProfile } from './tools/update-business-profile.js';
import { handleRecalculateFinancials } from './tools/recalculate-financials.js';

export function createServer(config: Config): McpServer {
  const client = new AgentBlueprintClient(config);

  const server = new McpServer({
    name: 'agent-blueprint',
    version: '0.2.0',
  });

  // ─── Tools ──────────────────────────────────────────────────────────

  const customerOrgParam = z.string().uuid().optional().describe('Customer organization ID (UUID). Required for partner users accessing a customer org.');

  server.tool(
    'get_business_profile',
    'Get the business profile for the organization. Returns company details, industry, strategic initiatives, technology profile, and AI readiness score.',
    { customerOrgId: customerOrgParam },
    async (args) => handleGetBusinessProfile(client, args.customerOrgId)
  );

  server.tool(
    'list_blueprints',
    'List all blueprints for the organization. Returns summaries with id, title, platform, agent count, and lifecycle status.',
    { customerOrgId: customerOrgParam },
    async (args) => handleListBlueprints(client, args.customerOrgId)
  );

  server.tool(
    'get_blueprint',
    'Get a blueprint summary by ID. Returns title, executive summary, agentic pattern, platform, agent names/roles, and phase overview. For full details, use download_blueprint.',
    { blueprintId: z.string().describe('The blueprint ID (UUID)'), customerOrgId: customerOrgParam },
    async (args) => handleGetBlueprint(client, args)
  );

  server.tool(
    'get_business_case',
    'Get a business case summary for a blueprint. Returns executive summary, headline ROI numbers, pilot economics, and recommendation. For full financial analysis, use download_blueprint.',
    { blueprintId: z.string().describe('The blueprint ID (UUID)'), customerOrgId: customerOrgParam },
    async (args) => handleGetBusinessCase(client, args)
  );

  server.tool(
    'get_implementation_plan',
    'Get an implementation plan summary for a blueprint. Returns project overview, epic names with phases and story counts, and timeline. For full stories and dependencies, use download_blueprint.',
    { blueprintId: z.string().describe('The blueprint ID (UUID)'), customerOrgId: customerOrgParam },
    async (args) => handleGetImplementationPlan(client, args)
  );

  server.tool(
    'get_use_case',
    'Get the use case analysis linked to a blueprint. Returns business challenge, success metrics, ROI estimate, and strategic alignment.',
    { blueprintId: z.string().describe('The blueprint ID (UUID)'), customerOrgId: customerOrgParam },
    async (args) => handleGetUseCase(client, args)
  );

  server.tool(
    'get_implementation_spec',
    'Get the compiled implementation spec for a blueprint. Returns metadata about the spec package including agent count, platform, and what artifacts are included.',
    { blueprintId: z.string().describe('The blueprint ID (UUID)'), customerOrgId: customerOrgParam },
    async (args) => handleGetImplementationSpec(client, args)
  );

  server.tool(
    'download_blueprint',
    'Download a blueprint as an Agent Skills directory. Returns a JSON manifest with all files (SKILL.md, reference docs, scripts) that can be written to disk for any coding agent to consume. Use this instead of reading full blueprint/business-case/plan data via individual tools.',
    {
      blueprintId: z.string().describe('The blueprint ID (UUID)'),
      customerOrgId: customerOrgParam,
      platform: z.string().optional().describe("Target deployment platform (e.g., 'servicenow', 'openclaw'). Includes a platform-specific deployment guide."),
    },
    async (args) => handleDownloadBlueprint(client, args)
  );

  server.tool(
    'sync_implementation_state',
    'Sync implementation state back to Agent Blueprint. Reports which agents have been implemented, their status, platform artifacts, and any deviations from the spec. Each sync creates a versioned snapshot enabling progress tracking over time.',
    {
      blueprintId: z.string().describe('The blueprint ID (UUID)'),
      stateData: z.object({
        schema_version: z.string().describe('Schema version, e.g. "1.0"'),
        overall_status: z.enum(['not_started', 'in_progress', 'partial', 'complete']).describe('Overall implementation status'),
        platform: z.object({
          name: z.string(),
          version: z.string(),
          environment: z.string(),
        }).describe('Target platform details'),
        agents: z.array(z.object({
          name: z.string(),
          status: z.enum(['not_started', 'in_progress', 'implemented', 'modified', 'skipped']),
          platform_artifact: z.string().optional().default(''),
          deviations: z.array(z.string()).optional().default([]),
          integrations_connected: z.array(z.string()).optional().default([]),
          notes: z.string().optional().default(''),
        })).describe('Per-agent implementation status'),
        architecture: z.object({
          pattern: z.string(),
          deviations: z.array(z.string()).optional().default([]),
          additional_components: z.array(z.string()).optional().default([]),
        }).optional(),
        metrics_observed: z.array(z.object({
          metric: z.string(),
          target: z.string().optional().default(''),
          actual: z.string().optional().default(''),
          measured_at: z.string().optional().default(''),
          source: z.string().optional(),
        })).optional(),
      }).describe('Implementation state data (structured JSON matching implementation-state.yaml schema)'),
      customerOrgId: customerOrgParam,
    },
    async (args) => handleSyncImplementationState(client, {
      blueprintId: args.blueprintId,
      stateData: args.stateData as Record<string, unknown>,
      customerOrgId: args.customerOrgId,
    })
  );

  server.tool(
    'report_metric',
    'Report actual performance metrics for a blueprint. The system auto-resolves predicted targets from the blueprint and returns deviation analysis. Supports multiple metrics in one call. Use this after implementing agents to track whether they hit their success criteria.',
    {
      blueprintId: z.string().describe('The blueprint ID (UUID)'),
      metrics: z.array(z.object({
        metricName: z.string().describe('Metric name as defined in the blueprint (e.g., "Incident Resolution Time", "ROI")'),
        actualValue: z.string().describe('The measured actual value (e.g., "4.2 hours", "78%", "$150,000")'),
        metricType: z.enum(['operational', 'financial']).optional().describe('Metric category. Auto-detected from blueprint if omitted.'),
        metricUnit: z.string().optional().describe('Unit of measurement (e.g., "hours", "%", "USD/year")'),
        baselineValue: z.string().optional().describe('Pre-agent baseline value, if this is the first measurement'),
        notes: z.string().optional().describe('Context about how the measurement was taken'),
        measuredAt: z.string().optional().describe('ISO 8601 timestamp of when measured. Defaults to now.'),
      })).describe('One or more metrics to report'),
      customerOrgId: customerOrgParam,
    },
    async (args) => handleReportMetric(client, {
      blueprintId: args.blueprintId,
      metrics: args.metrics,
      customerOrgId: args.customerOrgId,
    })
  );

  server.tool(
    'get_progress',
    'Get implementation progress and performance metrics for a blueprint. Returns predicted targets, latest actual measurements with deviation analysis, and implementation state (if synced via sync_implementation_state). Use this to check how an implementation is tracking against the plan.',
    {
      blueprintId: z.string().describe('The blueprint ID (UUID)'),
      customerOrgId: customerOrgParam,
    },
    async (args) => handleGetProgress(client, {
      blueprintId: args.blueprintId,
      customerOrgId: args.customerOrgId,
    })
  );

  // ─── Registry write tools ────────────────────────────────────────────

  server.tool(
    'update_blueprint',
    'Update blueprint sections with actual implementation data. Sends full top-level sections that are shallow-merged into the existing blueprint. Creates a version snapshot before mutation and propagates staleness to business case and implementation plan. Use this when the implementation diverges from the original recommendation.',
    {
      blueprintId: z.string().describe('The blueprint ID (UUID)'),
      sections: z.record(z.string(), z.unknown()).describe('Top-level sections to merge. Valid keys: enhancedDigitalTeam, phases, executiveSummary, executiveSummaryDetails, platformRecommendation, agenticPattern, riskAssessment, successCriteria, feasibilityIndicators, laborAnalysis, title, blueprintTitle, roiBaseline, howItWorks, teams, kpis, digitalTeam, implementation, dataProvenance, architectureRationale, integrationGaps, customTables'),
      customerOrgId: customerOrgParam,
    },
    async (args) => handleUpdateBlueprint(client, {
      blueprintId: args.blueprintId,
      sections: args.sections,
      customerOrgId: args.customerOrgId,
    })
  );

  server.tool(
    'update_business_case',
    'Update business case sections. Shallow-merges provided sections into the existing business case data. Propagates staleness to implementation plan. After updating, consider calling recalculate_financials to refresh ROI projections.',
    {
      blueprintId: z.string().describe('The blueprint ID (UUID)'),
      sections: z.record(z.string(), z.unknown()).describe('Top-level sections to merge. Valid keys: executiveSummary, businessContext, objectives, proposedSolution, benefits, risks, recommendation'),
      customerOrgId: customerOrgParam,
    },
    async (args) => handleUpdateBusinessCase(client, {
      blueprintId: args.blueprintId,
      sections: args.sections,
      customerOrgId: args.customerOrgId,
    })
  );

  server.tool(
    'update_implementation_plan',
    'Update implementation plan sections. Shallow-merges provided sections into the existing plan. This is a terminal artifact with no downstream staleness propagation.',
    {
      blueprintId: z.string().describe('The blueprint ID (UUID)'),
      sections: z.record(z.string(), z.unknown()).describe('Top-level sections to merge. Valid keys: projectOverview, epics, dependencies, resources, risks, agentSpecifications'),
      customerOrgId: customerOrgParam,
    },
    async (args) => handleUpdateImplementationPlan(client, {
      blueprintId: args.blueprintId,
      sections: args.sections,
      customerOrgId: args.customerOrgId,
    })
  );

  server.tool(
    'update_use_case',
    'Update use case fields for a blueprint. Updates the use case linked to the specified blueprint. Propagates staleness to the blueprint.',
    {
      blueprintId: z.string().describe('The blueprint ID (UUID)'),
      sections: z.record(z.string(), z.unknown()).describe('Fields to update. Valid keys: title, description, businessChallenge, description5Ws, currentPainPoints, desiredBusinessOutcomes, processDocumentation, transformationStory, typedSuccessMetrics, organizationalConstraints, affectedDepartments'),
      customerOrgId: customerOrgParam,
    },
    async (args) => handleUpdateUseCase(client, {
      blueprintId: args.blueprintId,
      sections: args.sections,
      customerOrgId: args.customerOrgId,
    })
  );

  server.tool(
    'update_business_profile',
    'Update business profile fields. Updates company details, technology profile, strategic initiatives, etc. Propagates staleness to use cases. Also syncs company name to the organization record.',
    {
      fields: z.record(z.string(), z.unknown()).describe('Fields to update. Valid keys: companyName, industry, size, revenue, currency, description, companyWebsite, technology, capabilities, operations, constraints, strategicInitiatives'),
      customerOrgId: customerOrgParam,
    },
    async (args) => handleUpdateBusinessProfile(client, {
      fields: args.fields,
      customerOrgId: args.customerOrgId,
    })
  );

  server.tool(
    'recalculate_financials',
    'Recalculate business case financials from current blueprint and profile data. Use this after updating the blueprint to refresh ROI projections, labor savings, and payback period. Clears staleness on the business case.',
    {
      blueprintId: z.string().describe('The blueprint ID (UUID)'),
      customerOrgId: customerOrgParam,
    },
    async (args) => handleRecalculateFinancials(client, {
      blueprintId: args.blueprintId,
      customerOrgId: args.customerOrgId,
    })
  );

  // ─── Resources ──────────────────────────────────────────────────────

  server.resource(
    businessProfileResource.uri,
    businessProfileResource.uri,
    async () => readBusinessProfile(client)
  );

  server.resource(
    blueprintListResource.uri,
    blueprintListResource.uri,
    async () => readBlueprintList(client)
  );

  server.resource(
    blueprintResourceTemplate.uriTemplate,
    blueprintResourceTemplate.uriTemplate,
    async (uri) => {
      const match = uri.href.match(/agentblueprint:\/\/blueprints\/([^/]+)$/);
      const id = match?.[1] ?? '';
      return readBlueprint(client, id);
    }
  );

  server.resource(
    specResourceTemplate.uriTemplate,
    specResourceTemplate.uriTemplate,
    async (uri) => {
      const match = uri.href.match(/agentblueprint:\/\/blueprints\/([^/]+)\/spec$/);
      const id = match?.[1] ?? '';
      return readSpec(client, id);
    }
  );

  return server;
}
