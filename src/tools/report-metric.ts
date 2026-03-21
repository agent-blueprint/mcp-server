import type { AgentBlueprintClient, ReportMetricsResponse } from '../client.js';
import { formatError } from '../errors.js';

/**
 * Format a human-readable summary of the metric report for the agent.
 */
function formatReportSummary(result: ReportMetricsResponse): string {
  const lines: string[] = [];

  lines.push(`Reported ${result.summary.succeeded}/${result.summary.total} metrics.`);

  if (result.summary.failed > 0) {
    lines.push(`${result.summary.failed} failed.`);
  }

  lines.push('');

  for (const r of result.results) {
    if (r.error) {
      lines.push(`[FAIL] ${r.metricName}: ${r.error}`);
      continue;
    }

    const statusIcon =
      r.status === 'on_track' ? '[OK]'
      : r.status === 'minor_deviation' ? '[MINOR]'
      : '[MAJOR]';

    const target = r.predictedValue && r.predictedValue !== 'N/A'
      ? ` (target: ${r.predictedValue}, deviation: ${r.deviationPercent}%)`
      : ' (no target in blueprint)';

    lines.push(`${statusIcon} ${r.metricName}: ${r.actualValue}${target}`);

    for (const w of r.warnings) {
      lines.push(`  ! ${w}`);
    }
  }

  return lines.join('\n');
}

export async function handleReportMetric(
  client: AgentBlueprintClient,
  args: {
    blueprintId: string;
    metrics: Array<{
      metricName: string;
      actualValue: string;
      metricType?: 'operational' | 'financial';
      metricUnit?: string;
      baselineValue?: string;
      notes?: string;
      measuredAt?: string;
    }>;
    customerOrgId?: string;
  },
) {
  try {
    const result = await client.reportMetrics(
      args.blueprintId,
      args.metrics,
      'mcp',
      args.customerOrgId,
    );

    const summary = formatReportSummary(result);
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
