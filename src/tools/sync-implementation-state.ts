import type { AgentBlueprintClient, ImplementationStateSyncResponse } from '../client.js';
import { formatError } from '../errors.js';

/**
 * Format a human-readable summary of the sync result for the agent.
 */
function formatSyncSummary(result: ImplementationStateSyncResponse): string {
  const { state, diff, warnings } = result;
  const lines: string[] = [];

  if (diff.isFirstSync) {
    lines.push('Implementation state synced (first sync).');
  } else {
    lines.push('Implementation state synced (updated).');
  }

  lines.push(`State ID: ${state.id}`);
  lines.push(`Synced at: ${state.syncedAt}`);

  // Overall status change
  if (diff.overallStatusChange) {
    const { from, to } = diff.overallStatusChange;
    if (from) {
      lines.push(`Overall status: ${from} -> ${to}`);
    } else {
      lines.push(`Overall status: ${to}`);
    }
  }

  // Agent changes
  const changed = diff.agentChanges.filter(
    (a) => a.statusChange || a.isNew || a.isRemoved,
  );
  if (changed.length > 0) {
    lines.push('');
    lines.push('Agent changes:');
    for (const agent of changed) {
      if (agent.isRemoved) {
        lines.push(`  - ${agent.name}: removed`);
      } else if (agent.isNew && agent.statusChange) {
        lines.push(`  - ${agent.name}: ${agent.statusChange.to} (new)`);
      } else if (agent.statusChange) {
        lines.push(`  - ${agent.name}: ${agent.statusChange.from} -> ${agent.statusChange.to}`);
      }
    }
  }

  // Count summary
  const agents = (state.stateData as Record<string, unknown>).agents;
  if (Array.isArray(agents)) {
    const total = agents.length;
    const implemented = agents.filter(
      (a: Record<string, unknown>) => a.status === 'implemented' || a.status === 'modified',
    ).length;
    lines.push('');
    lines.push(`Progress: ${implemented}/${total} agents implemented`);
  }

  // Warnings
  if (warnings.length > 0) {
    lines.push('');
    lines.push('Warnings:');
    for (const w of warnings) {
      lines.push(`  ! ${w}`);
    }
  }

  return lines.join('\n');
}

export async function handleSyncImplementationState(
  client: AgentBlueprintClient,
  args: {
    blueprintId: string;
    stateData: Record<string, unknown>;
    customerOrgId?: string;
  },
) {
  try {
    const result = await client.syncImplementationState(
      args.blueprintId,
      args.stateData,
      'mcp',
      args.customerOrgId,
    );

    const summary = formatSyncSummary(result);
    return {
      content: [{ type: 'text' as const, text: summary }],
    };
  } catch (err) {
    return {
      content: [{ type: 'text' as const, text: formatError(err) }],
      isError: true,
    };
  }
}
