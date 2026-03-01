import type { AgentBlueprintClient } from '../client.js';
import { formatError } from '../errors.js';

export const specResourceTemplate = {
  uriTemplate: 'agentblueprint://blueprints/{id}/spec',
  name: 'Implementation Spec',
  description: 'Implementation spec metadata for a blueprint',
  mimeType: 'text/markdown',
};

export async function readSpec(client: AgentBlueprintClient, id: string) {
  const uri = `agentblueprint://blueprints/${id}/spec`;
  try {
    const spec = await client.getImplementationSpec(id);
    const m = spec.metadata;

    let md = `# Implementation Spec: ${spec.filename}\n\n`;
    md += `**Blueprint ID:** ${spec.blueprintId}\n`;
    md += `**Platform:** ${m.platform}\n`;
    md += `**Agents:** ${m.agentCount}\n`;
    md += `**Total Files:** ${m.totalFileCount}\n\n`;
    md += `## Included Artifacts\n\n`;
    md += `- Business Case: ${m.hasBusinessCase ? 'Yes' : 'No'}\n`;
    md += `- Implementation Plan: ${m.hasImplementationPlan ? 'Yes' : 'No'}\n`;
    md += `- Use Case: ${m.hasUseCase ? 'Yes' : 'No'}\n`;
    md += `- Reference Files: ${m.referenceFileCount}\n`;

    return {
      contents: [{ uri, mimeType: 'text/markdown', text: md }],
    };
  } catch (err) {
    return {
      contents: [{ uri, mimeType: 'text/plain', text: `Error: ${formatError(err)}` }],
    };
  }
}
