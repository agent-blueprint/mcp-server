import type { AgentBlueprintClient } from '../client.js';
import { formatError } from '../errors.js';

export const getImplementationPlanTool = {
  name: 'get_implementation_plan',
  description: 'Get the latest implementation plan for a blueprint. Returns epics, stories, dependencies, timeline, and resource requirements.',
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

export async function handleGetImplementationPlan(
  client: AgentBlueprintClient,
  args: { blueprintId: string }
) {
  try {
    const plan = await client.getImplementationPlan(args.blueprintId);
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(plan, null, 2),
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
