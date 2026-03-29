import type { AgentBlueprintClient } from '../client.js';
import type { StrategicRecommendationsResponse } from '../types.js';
import { formatError } from '../errors.js';

/**
 * Format recommendations into a human-readable summary for the agent.
 */
function formatRecommendations(result: StrategicRecommendationsResponse): string {
  const recs = result.recommendations;
  const lines: string[] = [];

  lines.push(`Strategic Recommendations for blueprint ${result.blueprintId}`);
  lines.push(`Generated: ${recs.generatedAt}`);
  lines.push('');
  lines.push(recs.summary);
  lines.push('');

  // Context
  const ctx = recs.contextSnapshot;
  lines.push(`Implementation: ${ctx.implementationProgress}`);
  lines.push(`Performance: ${ctx.performanceStatus}`);
  lines.push('');

  // Recommendations grouped by priority
  const priorityOrder = ['critical', 'high', 'medium', 'low'];
  for (const priority of priorityOrder) {
    const group = recs.recommendations.filter(r => r.priority === priority);
    if (group.length === 0) continue;

    lines.push(`[${priority.toUpperCase()}]`);
    for (const rec of group) {
      lines.push(`  ${rec.id}: ${rec.title}`);
      lines.push(`    What: ${rec.what}`);
      lines.push(`    Why: ${rec.why}`);
      lines.push(`    Impact: ${rec.expectedImpact}`);
      if (rec.financialImpact?.estimatedValue) {
        lines.push(`    Financial: ${rec.financialImpact.estimatedValue} (${rec.financialImpact.type.replace(/_/g, ' ')})`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

export async function handleGetRecommendations(
  client: AgentBlueprintClient,
  args: {
    blueprintId: string;
    customerOrgId?: string;
  },
) {
  try {
    const result = await client.getRecommendations(
      args.blueprintId,
      args.customerOrgId,
    );

    if (!result) {
      return {
        content: [{
          type: 'text' as const,
          text: 'No recommendations available. Sync implementation state first using sync_implementation_state, then try again.',
        }],
      };
    }

    const text = formatRecommendations(result);
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
