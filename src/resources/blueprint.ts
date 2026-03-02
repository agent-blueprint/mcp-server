import type { AgentBlueprintClient } from '../client.js';
import { formatError } from '../errors.js';

export const blueprintResourceTemplate = {
  uriTemplate: 'agentblueprint://blueprints/{id}',
  name: 'Blueprint Detail',
  description: 'Full blueprint data as markdown summary',
  mimeType: 'text/markdown',
};

export async function readBlueprint(client: AgentBlueprintClient, id: string) {
  const uri = `agentblueprint://blueprints/${id}`;
  try {
    const bp = await client.getBlueprint(id);
    const data = bp.data as Record<string, unknown>;
    const team = (data.enhancedDigitalTeam ?? data.digitalTeam ?? []) as Array<Record<string, unknown>>;

    let md = `# ${data.blueprintTitle ?? data.title ?? 'Blueprint'}\n\n`;
    md += `**ID:** ${bp.id}\n`;
    md += `**Version:** ${bp.version}\n`;
    md += `**Status:** ${bp.lifecycleStatus}\n`;
    md += `**Updated:** ${bp.updatedAt}\n\n`;

    if (team.length > 0) {
      md += `## Agents (${team.length})\n\n`;
      for (const agent of team) {
        md += `### ${agent.name ?? 'Unnamed Agent'}\n`;
        const instr = (agent.instructions ?? {}) as Record<string, unknown>;
        const role = agent.role || instr.role || '';
        const desc = agent.description || instr.description || '';
        if (role) md += `**Role:** ${role}\n`;
        if (desc) md += `${desc}\n`;
        md += '\n';
      }
    }

    if (data.executiveSummary) {
      md += `## Executive Summary\n\n${data.executiveSummary}\n\n`;
    }

    return {
      contents: [{ uri, mimeType: 'text/markdown', text: md }],
    };
  } catch (err) {
    return {
      contents: [{ uri, mimeType: 'text/plain', text: `Error: ${formatError(err)}` }],
    };
  }
}
