import type { AgentBlueprintClient, ArtifactUpdateResponse } from '../client.js';
import { formatError } from '../errors.js';

function formatUpdateSummary(result: ArtifactUpdateResponse): string {
  const lines: string[] = ['Implementation plan updated successfully.'];
  lines.push(`ID: ${result.id}`);
  lines.push(`Updated at: ${result.updatedAt}`);
  return lines.join('\n');
}

export async function handleUpdateImplementationPlan(
  client: AgentBlueprintClient,
  args: {
    blueprintId: string;
    sections: Record<string, unknown>;
    customerOrgId?: string;
  },
) {
  try {
    const result = await client.updateImplementationPlan(
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
