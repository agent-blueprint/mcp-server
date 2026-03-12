import type { AgentBlueprintClient, ArtifactResponse } from '../client.js';
import { formatError } from '../errors.js';

/**
 * Build a concise summary from a full implementation plan response.
 * Returns ~3-5K: project overview, epic names + phases + story counts, timeline.
 */
function summarizeImplementationPlan(plan: ArtifactResponse): Record<string, unknown> {
  const data = plan.data as Record<string, unknown>;

  const overview = data.projectOverview && typeof data.projectOverview === 'object'
    ? data.projectOverview as Record<string, unknown>
    : {};

  // Epic summaries (name, phase, priority, story count — no full stories)
  const epics = Array.isArray(data.epics) ? data.epics : [];
  const epicSummaries = epics.map((e: Record<string, unknown>) => ({
    name: e.name || '',
    phase: e.phase || '',
    priority: e.priority || '',
    estimatedDuration: e.estimatedDuration || '',
    storyCount: Array.isArray(e.stories) ? e.stories.length : 0,
  }));

  // Timeline
  const resources = data.resources && typeof data.resources === 'object'
    ? data.resources as Record<string, unknown>
    : {};
  const timeline = resources.timeline && typeof resources.timeline === 'object'
    ? resources.timeline as Record<string, unknown>
    : {};

  // Agent spec count
  const agentSpecs = Array.isArray(data.agentSpecifications) ? data.agentSpecifications.length : 0;

  return {
    id: plan.id,
    version: plan.version,
    blueprintId: plan.blueprintId,
    projectOverview: {
      projectName: overview.projectName || '',
      executiveSummary: overview.executiveSummary || '',
      scope: overview.scope || '',
    },
    epicCount: epicSummaries.length,
    epics: epicSummaries,
    timeline: {
      totalDuration: timeline.totalDuration || '',
    },
    agentSpecificationCount: agentSpecs,
    hint: 'For full stories, acceptance criteria, agent build specs, and dependencies, use download_blueprint to get the complete Agent Skills directory.',
  };
}

export async function handleGetImplementationPlan(
  client: AgentBlueprintClient,
  args: { blueprintId: string; customerOrgId?: string }
) {
  try {
    const plan = await client.getImplementationPlan(args.blueprintId, args.customerOrgId);
    const summary = summarizeImplementationPlan(plan);
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
