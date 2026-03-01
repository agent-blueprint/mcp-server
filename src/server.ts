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

export function createServer(config: Config): McpServer {
  const client = new AgentBlueprintClient(config);

  const server = new McpServer({
    name: 'agent-blueprint',
    version: '0.1.0',
  });

  // ─── Tools ──────────────────────────────────────────────────────────

  server.tool(
    'get_business_profile',
    'Get the business profile for the organization. Returns company details, industry, strategic initiatives, technology profile, and AI readiness score.',
    {},
    async () => handleGetBusinessProfile(client)
  );

  server.tool(
    'list_blueprints',
    'List all blueprints for the organization. Returns summaries with id, title, platform, agent count, and lifecycle status.',
    {},
    async () => handleListBlueprints(client)
  );

  server.tool(
    'get_blueprint',
    'Get full blueprint data by ID. Returns the complete blueprint including agents, patterns, architecture, and all configuration.',
    { blueprintId: z.string().describe('The blueprint ID (UUID)') },
    async (args) => handleGetBlueprint(client, args)
  );

  server.tool(
    'get_business_case',
    'Get the latest business case for a blueprint. Returns financial analysis, ROI projections, cost breakdown, and executive summary.',
    { blueprintId: z.string().describe('The blueprint ID (UUID)') },
    async (args) => handleGetBusinessCase(client, args)
  );

  server.tool(
    'get_implementation_plan',
    'Get the latest implementation plan for a blueprint. Returns epics, stories, dependencies, timeline, and resource requirements.',
    { blueprintId: z.string().describe('The blueprint ID (UUID)') },
    async (args) => handleGetImplementationPlan(client, args)
  );

  server.tool(
    'get_use_case',
    'Get the use case analysis linked to a blueprint. Returns business challenge, success metrics, ROI estimate, and strategic alignment.',
    { blueprintId: z.string().describe('The blueprint ID (UUID)') },
    async (args) => handleGetUseCase(client, args)
  );

  server.tool(
    'get_implementation_spec',
    'Get the compiled implementation spec for a blueprint. Returns metadata about the spec package including agent count, platform, and what artifacts are included.',
    { blueprintId: z.string().describe('The blueprint ID (UUID)') },
    async (args) => handleGetImplementationSpec(client, args)
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
