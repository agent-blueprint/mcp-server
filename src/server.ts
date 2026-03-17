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
