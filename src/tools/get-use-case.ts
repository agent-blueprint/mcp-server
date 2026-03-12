import type { AgentBlueprintClient } from '../client.js';
import { formatError } from '../errors.js';

export const getUseCaseTool = {
  name: 'get_use_case',
  description: 'Get the use case analysis linked to a blueprint. Returns business challenge, success metrics, ROI estimate, and strategic alignment.',
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

export async function handleGetUseCase(
  client: AgentBlueprintClient,
  args: { blueprintId: string; customerOrgId?: string }
) {
  try {
    const useCase = await client.getUseCase(args.blueprintId, args.customerOrgId);
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(useCase, null, 2),
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
