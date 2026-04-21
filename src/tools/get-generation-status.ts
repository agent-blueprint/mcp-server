import type {
  AgentBlueprintClient,
  BlueprintGenerationStatusResponse,
  FullPipelineStatusResponse,
} from '../client.js';
import { formatError } from '../errors.js';

function formatStatus(
  result: BlueprintGenerationStatusResponse | FullPipelineStatusResponse,
): Record<string, unknown> {
  if (result.kind === 'blueprint') {
    return {
      ...result,
      hint: result.status === 'completed' && result.blueprintId
        ? `Blueprint ready. Call download_blueprint with blueprintId="${result.blueprintId}".`
        : 'Poll again until status is completed or failed.',
    };
  }

  const blueprintId = result.generatedArtifactIds.blueprintId;
  return {
    ...result,
    hint: result.status === 'completed' && blueprintId
      ? `Pipeline complete. Call download_blueprint with blueprintId="${blueprintId}".`
      : 'Poll again until status is completed or failed.',
  };
}

export async function handleGetGenerationStatus(
  client: AgentBlueprintClient,
  args: {
    auditId?: string;
    jobId?: string;
    customerOrgId?: string;
  },
) {
  try {
    if ((args.auditId && args.jobId) || (!args.auditId && !args.jobId)) {
      return {
        content: [{ type: 'text' as const, text: 'Provide exactly one of auditId or jobId.' }],
        isError: true,
      };
    }

    const result = args.auditId
      ? await client.getBlueprintGenerationStatus(args.auditId, args.customerOrgId)
      : await client.getFullPipelineStatus(args.jobId!, args.customerOrgId);

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(formatStatus(result), null, 2) }],
    };
  } catch (err) {
    return {
      content: [{ type: 'text' as const, text: formatError(err) }],
      isError: true,
    };
  }
}
