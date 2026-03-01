import type { AgentBlueprintClient } from '../client.js';
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

export async function handleGetBlueprint(
  client: AgentBlueprintClient,
  args: { blueprintId: string }
) {
  try {
    const blueprint = await client.getBlueprint(args.blueprintId);
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(blueprint, null, 2),
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
