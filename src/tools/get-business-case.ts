import type { AgentBlueprintClient, ArtifactResponse } from '../client.js';
import { formatError } from '../errors.js';

/**
 * Build a concise summary from a full business case response.
 * Returns ~3-5K: executive summary, headline ROI, recommendation.
 */
function summarizeBusinessCase(bc: ArtifactResponse): Record<string, unknown> {
  const data = bc.data as Record<string, unknown>;

  const es = data.executiveSummary && typeof data.executiveSummary === 'object'
    ? data.executiveSummary as Record<string, unknown>
    : {};

  const benefits = data.benefits && typeof data.benefits === 'object'
    ? data.benefits as Record<string, unknown>
    : {};
  const qROI = benefits.quantifiedROI && typeof benefits.quantifiedROI === 'object'
    ? benefits.quantifiedROI as Record<string, unknown>
    : {};

  const pilotROI = qROI.pilotROI && typeof qROI.pilotROI === 'object'
    ? qROI.pilotROI as Record<string, unknown>
    : {};

  const recommendation = data.recommendation && typeof data.recommendation === 'object'
    ? data.recommendation as Record<string, unknown>
    : {};

  return {
    id: bc.id,
    version: bc.version,
    blueprintId: bc.blueprintId,
    executiveSummary: es,
    roi: {
      roi: qROI.roi || '',
      npv: qROI.npv || '',
      paybackPeriod: qROI.paybackPeriod || '',
    },
    pilotEconomics: {
      pilotCost: pilotROI.pilotCost || '',
      pilotBenefit: pilotROI.pilotBenefit || '',
      pilotROI: pilotROI.pilotROI || '',
      pilotDuration: pilotROI.pilotDuration || '',
    },
    recommendation: {
      summary: recommendation.summary || recommendation.decision || '',
      nextSteps: recommendation.nextSteps || recommendation.immediateActions || [],
    },
    hint: 'For full financial analysis, sensitivity, 5-year projection, and cost breakdown, use download_blueprint to get the complete Agent Skills directory.',
  };
}

export async function handleGetBusinessCase(
  client: AgentBlueprintClient,
  args: { blueprintId: string }
) {
  try {
    const businessCase = await client.getBusinessCase(args.blueprintId);
    const summary = summarizeBusinessCase(businessCase);
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(summary, null, 2),
        },
      ],
    };
  } catch (err) {
    return {
      content: [{ type: 'text' as const, text: formatError(err) }],
      isError: true,
    };
  }
}
