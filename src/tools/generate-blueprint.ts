import type { AgentBlueprintClient } from '../client.js';
import { formatError } from '../errors.js';

export async function handleGenerateBlueprint(
  client: AgentBlueprintClient,
  args: {
    useCaseId: string;
    platform?: string;
    guidanceText?: string;
    guidance?: string[];
    assumeMissing?: boolean;
    customerOrgId?: string;
  },
) {
  try {
    const result = await client.triggerBlueprintGeneration({
      useCaseId: args.useCaseId,
      platform: args.platform,
      guidanceText: args.guidanceText,
      guidance: args.guidance,
      assumeMissing: args.assumeMissing,
    }, args.customerOrgId);

    return {
      content: [{
        type: 'text' as const,
        text: `Blueprint generation started.\nAudit ID: ${result.auditId}\nNext: call get_generation_status with auditId="${result.auditId}".`,
      }],
    };
  } catch (err) {
    return {
      content: [{ type: 'text' as const, text: formatError(err) }],
      isError: true,
    };
  }
}
