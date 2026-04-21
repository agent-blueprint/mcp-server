import type { AgentBlueprintClient } from '../client.js';
import { formatError } from '../errors.js';

export async function handleTriggerFullPipeline(
  client: AgentBlueprintClient,
  args: {
    businessProfileId: string;
    specialInstructions?: string;
    platform?: string;
    strategicInitiativeId?: string;
    customerOrgId?: string;
  },
) {
  try {
    const result = await client.triggerFullPipeline({
      businessProfileId: args.businessProfileId,
      specialInstructions: args.specialInstructions,
      platform: args.platform,
      strategicInitiativeId: args.strategicInitiativeId,
    }, args.customerOrgId);

    return {
      content: [{
        type: 'text' as const,
        text: `Full pipeline started.\nJob ID: ${result.jobId}\nNext: call get_generation_status with jobId="${result.jobId}".`,
      }],
    };
  } catch (err) {
    return {
      content: [{ type: 'text' as const, text: formatError(err) }],
      isError: true,
    };
  }
}
