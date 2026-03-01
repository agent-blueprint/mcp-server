import type { AgentBlueprintClient, BlueprintDetail } from '../client.js';
import { formatError } from '../errors.js';

export const getBlueprintTool = {
  name: 'get_blueprint',
  description: 'Get full blueprint data by ID. Returns the complete blueprint including agents, patterns, architecture, and all configuration.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      blueprintId: {
        type: 'string',
        description: 'The blueprint ID (UUID)',
      },
    },
    required: ['blueprintId'],
  },
};

/**
 * Strip verbose tool sample data from the blueprint to reduce response size.
 * enhancedTools carry sampleOutput/expectedOutput/expectedInput (~35K chars)
 * that are useful in the UI but not for coding agents consuming via MCP.
 */
function stripToolSamples(blueprint: BlueprintDetail): BlueprintDetail {
  const data = blueprint.data as Record<string, unknown>;
  const team = data.enhancedDigitalTeam;
  if (!Array.isArray(team)) return blueprint;

  const stripped = team.map((agent: Record<string, unknown>) => {
    const tools = agent.enhancedTools;
    if (!Array.isArray(tools)) return agent;
    return {
      ...agent,
      enhancedTools: tools.map((tool: Record<string, unknown>) => {
        const { sampleOutput, expectedOutput, expectedInput, ...rest } = tool;
        return rest;
      }),
    };
  });

  return {
    ...blueprint,
    data: { ...data, enhancedDigitalTeam: stripped },
  };
}

export async function handleGetBlueprint(
  client: AgentBlueprintClient,
  args: { blueprintId: string }
) {
  try {
    const blueprint = await client.getBlueprint(args.blueprintId);
    const slim = stripToolSamples(blueprint);
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(slim, null, 2),
        },
      ],
    };
  } catch (err) {
    return {
      content: [{ type: 'text' as const, text: formatError(err) }],
      isError: true,
    };
  }
}
