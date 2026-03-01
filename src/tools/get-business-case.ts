import type { AgentBlueprintClient } from '../client.js';
import { formatError } from '../errors.js';

export const getBusinessCaseTool = {
  name: 'get_business_case',
  description: 'Get the latest business case for a blueprint. Returns financial analysis, ROI projections, cost breakdown, and executive summary.',
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

export async function handleGetBusinessCase(
  client: AgentBlueprintClient,
  args: { blueprintId: string }
) {
  try {
    const businessCase = await client.getBusinessCase(args.blueprintId);
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(businessCase, null, 2),
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
