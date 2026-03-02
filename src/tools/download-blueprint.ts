import type { AgentBlueprintClient } from '../client.js';
import { formatError } from '../errors.js';
import { renderSkillDirectory, slugify } from '../renderers.js';
import type { SkillRenderInput } from '../renderers.js';

export async function handleDownloadBlueprint(
  client: AgentBlueprintClient,
  args: { blueprintId: string }
) {
  try {
    // Fetch all data in parallel
    const [blueprint, businessCase, implementationPlan, useCase, businessProfile] = await Promise.all([
      client.getBlueprint(args.blueprintId),
      client.getBusinessCase(args.blueprintId).catch(() => null),
      client.getImplementationPlan(args.blueprintId).catch(() => null),
      client.getUseCase(args.blueprintId).catch(() => null),
      client.getBusinessProfile().catch(() => null),
    ]);

    const bpData = blueprint.data as Record<string, unknown>;
    const title = (bpData.title as string)
      || (bpData.blueprintTitle as string)
      || `Blueprint ${args.blueprintId.slice(0, 8)}`;

    const input: SkillRenderInput = {
      blueprintTitle: title,
      blueprintId: args.blueprintId,
      blueprintData: bpData,
      businessCaseData: businessCase?.data,
      implementationPlanData: implementationPlan?.data,
      useCaseData: useCase as Record<string, unknown> | undefined,
      businessProfileData: (businessProfile as unknown as Record<string, unknown>) ?? undefined,
    };

    const files = renderSkillDirectory(input);
    const slug = slugify(title) || 'blueprint';

    // Convert Map to JSON manifest
    const fileList = Array.from(files.entries()).map(([path, content]) => ({
      path,
      content,
    }));

    const manifest = {
      directory: slug,
      files: fileList,
      installHint: `Write these files to .agent-blueprint/${slug}/ or .claude/skills/${slug}/`,
    };

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(manifest, null, 2),
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
