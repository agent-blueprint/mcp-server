import type { AgentBlueprintClient, BusinessProfileUpsertResponse } from '../client.js';
import { formatError } from '../errors.js';

function formatSummary(result: BusinessProfileUpsertResponse): string {
  const lines: string[] = [
    result.isNew ? 'Business profile created.' : 'Business profile updated via create-or-upsert.',
    `ID: ${result.id}`,
    `Company: ${result.companyName}`,
  ];

  if (result.aiReadinessScore !== null) {
    lines.push(`AI readiness score: ${result.aiReadinessScore}`);
  }

  lines.push('Next: call generate_use_cases, generate_blueprint, or trigger_full_pipeline.');
  return lines.join('\n');
}

export async function handleCreateBusinessProfile(
  client: AgentBlueprintClient,
  args: {
    fields: Record<string, unknown>;
    customerOrgId?: string;
  },
) {
  try {
    const result = await client.createBusinessProfile(args.fields, args.customerOrgId);
    return {
      content: [{ type: 'text' as const, text: formatSummary(result) }],
    };
  } catch (err) {
    return {
      content: [{ type: 'text' as const, text: formatError(err) }],
      isError: true,
    };
  }
}
