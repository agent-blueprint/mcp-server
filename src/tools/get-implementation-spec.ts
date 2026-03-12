import type { AgentBlueprintClient } from '../client.js';
import { formatError } from '../errors.js';

export const getImplementationSpecTool = {
  name: 'get_implementation_spec',
  description: 'Get the compiled implementation spec for a blueprint. Returns metadata about the spec package including agent count, platform, and what artifacts are included.',
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

export async function handleGetImplementationSpec(
  client: AgentBlueprintClient,
  args: { blueprintId: string; customerOrgId?: string }
) {
  try {
    const spec = await client.getImplementationSpec(args.blueprintId, args.customerOrgId);
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(spec, null, 2),
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
