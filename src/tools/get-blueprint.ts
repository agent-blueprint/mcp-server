import type { AgentBlueprintClient, BlueprintDetail } from '../client.js';
import { formatError } from '../errors.js';

/**
 * Build a concise summary from a full blueprint response.
 * Strips verbose tool samples, full agent details, and reasoning
 * to produce a ~5-8K char overview suitable for agent context windows.
 */
function summarizeBlueprint(blueprint: BlueprintDetail): Record<string, unknown> {
  const data = blueprint.data as Record<string, unknown>;

  // Agent summary (names + roles, no tools/guardrails/instructions)
  const team = Array.isArray(data.enhancedDigitalTeam) ? data.enhancedDigitalTeam : [];
  const agents = team.map((agent: Record<string, unknown>, i: number) => ({
    name: agent.name || `Agent ${i + 1}`,
    role: agent.role || (agent.instructions as Record<string, unknown>)?.role || '',
    type: agent.agentRole || agent.orchestrationRole || agent.type || 'Worker',
    supervisionLevel: agent.supervisionLevel || 'Supervised',
  }));

  // Phase summary (names + durations, no workstream details)
  const phases = Array.isArray(data.phases) ? data.phases : [];
  const phaseSummary = phases.map((p: Record<string, unknown>) => ({
    name: p.name || '',
    durationWeeks: p.durationWeeks,
    phaseCost: p.phaseCost || '',
  }));

  // Platform snapshot
  const pr = data.platformRecommendation && typeof data.platformRecommendation === 'object'
    ? data.platformRecommendation as Record<string, unknown>
    : {};
  const pp = pr.primaryPlatform && typeof pr.primaryPlatform === 'object'
    ? pr.primaryPlatform as Record<string, unknown>
    : {};

  return {
    id: blueprint.id,
    version: blueprint.version,
    lifecycleStatus: blueprint.lifecycleStatus,
    title: data.title || data.blueprintTitle || '',
    executiveSummary: data.executiveSummary || '',
    agenticPattern: data.agenticPattern || 'Multi-Agent',
    platform: pp.name || 'Vendor-Agnostic',
    agentCount: agents.length,
    agents,
    phases: phaseSummary,
    hint: 'For full agent specs, tools, guardrails, and architecture details, use download_blueprint to get the complete Agent Skills directory.',
  };
}

export async function handleGetBlueprint(
  client: AgentBlueprintClient,
  args: { blueprintId: string }
) {
  try {
    const blueprint = await client.getBlueprint(args.blueprintId);
    const summary = summarizeBlueprint(blueprint);
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
