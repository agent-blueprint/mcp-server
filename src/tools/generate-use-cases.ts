import type { AgentBlueprintClient, UseCaseGenerationResponse } from '../client.js';
import { formatError } from '../errors.js';

function formatResult(result: UseCaseGenerationResponse) {
  return {
    useCaseCount: Array.isArray(result.useCases) ? result.useCases.length : 0,
    useCases: result.useCases,
    hint: 'Pick a useCaseId and call generate_blueprint, or call trigger_full_pipeline to continue automatically.',
  };
}

export async function handleGenerateUseCases(
  client: AgentBlueprintClient,
  args: {
    count?: number;
    guidanceText?: string;
    guidance?: string[];
    strategicInitiativeId?: string;
    additionalContext?: string;
    customerOrgId?: string;
  },
) {
  try {
    const result = await client.generateUseCases({
      count: args.count,
      guidanceText: args.guidanceText,
      guidance: args.guidance,
      strategicInitiativeId: args.strategicInitiativeId,
      additionalContext: args.additionalContext,
    }, args.customerOrgId);

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(formatResult(result), null, 2) }],
    };
  } catch (err) {
    return {
      content: [{ type: 'text' as const, text: formatError(err) }],
      isError: true,
    };
  }
}
