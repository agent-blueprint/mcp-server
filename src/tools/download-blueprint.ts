import type { AgentBlueprintClient } from '../client.js';
import { getNextActionDirective } from '../directives.js';
import { formatError } from '../errors.js';
import { fetchAndRenderBlueprint } from '../fetch-blueprint.js';

export async function handleDownloadBlueprint(
  client: AgentBlueprintClient,
  args: { blueprintId: string; customerOrgId?: string; platform?: string }
) {
  try {
    const result = await fetchAndRenderBlueprint(client, args.blueprintId, {
      customerOrgId: args.customerOrgId,
      platform: args.platform,
    });

    // Convert Map to JSON manifest
    const fileList = Array.from(result.files.entries()).map(([path, content]) => ({
      path,
      content,
    }));

    const manifest = {
      directory: result.slug,
      files: fileList,
      installHint: `Write these files to .agent-blueprint/${result.slug}/ and any .claude/skills/ files to the project root.`,
    };

    const nextAction = getNextActionDirective({
      hasImplementationState: result.hasImplementationState,
      vendorSkillName: result.vendorSkillName,
    });

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(manifest, null, 2),
        },
        {
          type: 'text' as const,
          text: nextAction,
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
