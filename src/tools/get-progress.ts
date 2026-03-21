import type { AgentBlueprintClient, ProgressResponse } from '../client.js';
import { formatError } from '../errors.js';

/**
 * Format a human-readable progress summary for the agent.
 */
function formatProgress(result: ProgressResponse): string {
  const lines: string[] = [];

  lines.push(`Progress: ${result.blueprintTitle}`);
  lines.push(`Blueprint: ${result.blueprintId}`);
  lines.push('');

  // Implementation state (Phase 2A)
  if (result.implementationState) {
    const is = result.implementationState;
    lines.push(
      `Implementation: ${is.implementedCount}/${is.agentCount} agents (${is.overallStatus})`,
    );
    lines.push(`Last synced: ${is.lastSyncedAt}`);
    lines.push('');
  }

  // Summary
  const { summary } = result;
  lines.push(`Metrics: ${summary.metricsRecorded}/${summary.totalTargets} targets measured`);
  if (summary.metricsRecorded > 0) {
    lines.push(`  On track: ${summary.onTrack}`);
    if (summary.minorDeviation > 0) lines.push(`  Minor deviation: ${summary.minorDeviation}`);
    if (summary.majorDeviation > 0) lines.push(`  Major deviation: ${summary.majorDeviation}`);
  }

  // Per-metric detail
  if (result.actuals.length > 0) {
    lines.push('');
    lines.push('Latest measurements:');
    for (const actual of result.actuals) {
      const statusIcon =
        actual.status === 'on_track' ? '[OK]'
        : actual.status === 'minor_deviation' ? '[MINOR]'
        : '[MAJOR]';

      const target = actual.predictedValue && actual.predictedValue !== 'N/A'
        ? ` (target: ${actual.predictedValue}, deviation: ${actual.deviationPercent}%)`
        : '';
      const count = actual.recordingCount > 1 ? ` [${actual.recordingCount} recordings]` : '';

      lines.push(`  ${statusIcon} ${actual.metricName}: ${actual.actualValue}${target}${count}`);
    }
  }

  // Unmeasured targets
  const allTargetNames = [
    ...result.targets.operational.map((t) => t.name),
    ...result.targets.financial.map((t) => t.name),
  ];
  const measuredNames = new Set(result.actuals.map((a) => a.metricName.toLowerCase()));
  const unmeasured = allTargetNames.filter((n) => !measuredNames.has(n.toLowerCase()));

  if (unmeasured.length > 0) {
    lines.push('');
    lines.push('Not yet measured:');
    for (const name of unmeasured) {
      lines.push(`  - ${name}`);
    }
  }

  return lines.join('\n');
}

export async function handleGetProgress(
  client: AgentBlueprintClient,
  args: {
    blueprintId: string;
    customerOrgId?: string;
  },
) {
  try {
    const result = await client.getProgress(
      args.blueprintId,
      args.customerOrgId,
    );

    const text = formatProgress(result);
    return {
      content: [{ type: 'text' as const, text }],
    };
  } catch (err) {
    return {
      content: [{ type: 'text' as const, text: formatError(err) }],
      isError: true,
    };
  }
}
