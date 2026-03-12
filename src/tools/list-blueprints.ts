import type { AgentBlueprintClient } from '../client.js';
import { formatError } from '../errors.js';

export const listBlueprintsTool = {
  name: 'list_blueprints',
  description: 'List all blueprints for the organization. Returns summaries with id, title, platform, agent count, and lifecycle status.',
  inputSchema: {
    type: 'object' as const,
    properties: {},
  },
};

export async function handleListBlueprints(client: AgentBlueprintClient, customerOrgId?: string) {
  try {
    const blueprints = await client.listBlueprints(customerOrgId);
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(blueprints, null, 2),
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
