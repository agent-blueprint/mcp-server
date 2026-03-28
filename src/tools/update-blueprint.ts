import type { AgentBlueprintClient, ArtifactUpdateResponse } from '../client.js';
import { formatError } from '../errors.js';

function formatUpdateSummary(result: ArtifactUpdateResponse): string {
  const lines: string[] = ['Blueprint updated successfully.'];
  lines.push(`ID: ${result.id}`);
  lines.push(`Updated at: ${result.updatedAt}`);
  if (result.versionSnapshot) {
    lines.push(`Previous version snapshot: v${result.versionSnapshot}`);
  }
  if (result.downstreamStale.length > 0) {
    lines.push('');
    lines.push('Downstream artifacts now stale:');
    for (const table of result.downstreamStale) {
      lines.push(`  - ${table}`);
    }
    lines.push('');
    lines.push('Consider running recalculate_financials if the business case is stale.');
  }
  return lines.join('\n');
}

export async function handleUpdateBlueprint(
  client: AgentBlueprintClient,
  args: {
    blueprintId: string;
    sections: Record<string, unknown>;
    customerOrgId?: string;
  },
) {
  try {
    const result = await client.updateBlueprint(
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
