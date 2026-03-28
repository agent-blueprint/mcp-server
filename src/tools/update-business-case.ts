import type { AgentBlueprintClient, ArtifactUpdateResponse } from '../client.js';
import { formatError } from '../errors.js';

function formatUpdateSummary(result: ArtifactUpdateResponse): string {
  const lines: string[] = ['Business case updated successfully.'];
  lines.push(`ID: ${result.id}`);
  lines.push(`Updated at: ${result.updatedAt}`);
  if (result.message) lines.push(result.message);
  if (result.downstreamStale.length > 0) {
    lines.push('');
    lines.push('Downstream artifacts now stale:');
    for (const table of result.downstreamStale) {
      lines.push(`  - ${table}`);
    }
  }
  return lines.join('\n');
}

export async function handleUpdateBusinessCase(
  client: AgentBlueprintClient,
  args: {
    blueprintId: string;
    sections: Record<string, unknown>;
    customerOrgId?: string;
  },
) {
  try {
    const result = await client.updateBusinessCase(
      args.blueprintId,
      args.sections,
      args.customerOrgId,
    );
    return {
      content: [{ type: 'text' as const, text: formatUpdateSummary(result) }],
    };
  } catch (err) {
    return {
      content: [{ type: 'text' as const, text: formatError(err) }],
      isError: true,
    };
  }
}
