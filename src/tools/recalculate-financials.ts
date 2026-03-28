import type { AgentBlueprintClient } from '../client.js';
import { formatError } from '../errors.js';

export async function handleRecalculateFinancials(
  client: AgentBlueprintClient,
  args: {
    blueprintId: string;
    customerOrgId?: string;
  },
) {
  try {
    const result = await client.recalculateFinancials(
      args.blueprintId,
      args.customerOrgId,
    );

    const lines: string[] = ['Financial recalculation complete.'];
    if (result.id) lines.push(`Business case ID: ${result.id}`);
    if (result.updatedAt) lines.push(`Updated at: ${result.updatedAt}`);
    lines.push('Business case staleness cleared.');

    // Extract headline numbers if available
    const data = result.data as Record<string, unknown> | undefined;
    const benefits = data?.benefits as Record<string, unknown> | undefined;
    const roi = benefits?.quantifiedROI as Record<string, unknown> | undefined;
    if (roi) {
      lines.push('');
      lines.push('Updated financials:');
      if (roi.roi) lines.push(`  ROI: ${roi.roi}`);
      if (roi.paybackPeriod) lines.push(`  Payback: ${roi.paybackPeriod}`);
      const labor = roi.laborCostDetail as Record<string, unknown> | undefined;
      if (labor?.annualLaborSavings) lines.push(`  Annual labor savings: ${labor.annualLaborSavings}`);
    }

    return {
      content: [{ type: 'text' as const, text: lines.join('\n') }],
    };
  } catch (err) {
    return {
      content: [{ type: 'text' as const, text: formatError(err) }],
      isError: true,
    };
  }
}
