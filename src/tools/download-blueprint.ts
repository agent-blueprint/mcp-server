import type { AgentBlueprintClient } from '../client.js';
import { formatError } from '../errors.js';
import { renderSkillDirectory, slugify } from '../renderers.js';
import type { SkillRenderInput } from '../renderers.js';

export async function handleDownloadBlueprint(
  client: AgentBlueprintClient,
  args: { blueprintId: string; customerOrgId?: string; platform?: string }
) {
  try {
    const orgId = args.customerOrgId;
    // Fetch all data in parallel
    const [blueprint, businessCase, implementationPlan, useCase, businessProfile] = await Promise.all([
      client.getBlueprint(args.blueprintId, orgId),
      client.getBusinessCase(args.blueprintId, orgId).catch(() => null),
      client.getImplementationPlan(args.blueprintId, orgId).catch(() => null),
      client.getUseCase(args.blueprintId, orgId).catch(() => null),
      client.getBusinessProfile(orgId).catch(() => null),
    ]);

    // Fetch reality data for return visits (non-blocking)
    const [implementationState, progress] = await Promise.all([
      client.getImplementationState(args.blueprintId, orgId).catch(() => null),
      client.getProgress(args.blueprintId, orgId).catch(() => null),
    ]);

    const bpData = blueprint.data as Record<string, unknown>;
    const title = (bpData.title as string)
      || (bpData.blueprintTitle as string)
      || `Blueprint ${args.blueprintId.slice(0, 8)}`;

    // Fetch vendor deployment guides and expert skills
    const generalGuideData = await client.getVendorGuide('general');
    let vendorGuideInput: { platform: string; content: string } | undefined;
    let vendorSkillInput: { platform: string; skillName: string; content: string } | undefined;
    if (args.platform) {
      // Try vendor skill first (replaces vendor guide when present)
      const vendorSkillData = await client.getVendorSkill(args.platform);
      if (vendorSkillData) {
        vendorSkillInput = {
          platform: vendorSkillData.platform,
          skillName: vendorSkillData.skillName,
          content: vendorSkillData.content,
        };
      } else {
        // Fall back to vendor deployment guide
        const vendorGuideData = await client.getVendorGuide(args.platform);
        if (vendorGuideData) {
          vendorGuideInput = { platform: vendorGuideData.platform, content: vendorGuideData.content };
        }
      }
    }

    const input: SkillRenderInput = {
      blueprintTitle: title,
      blueprintId: args.blueprintId,
      blueprintData: bpData,
      businessCaseData: businessCase?.data,
      implementationPlanData: implementationPlan?.data,
      useCaseData: useCase as Record<string, unknown> | undefined,
      businessProfileData: (businessProfile as unknown as Record<string, unknown>) ?? undefined,
      generalGuide: generalGuideData?.content,
      vendorGuide: vendorGuideInput,
      vendorSkill: vendorSkillInput,
      implementationState,
      progress,
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
      installHint: `Write these files to .agent-blueprint/${slug}/ and any .claude/skills/ files to the project root.`,
    };

    let nextAction: string;
    if (implementationState) {
      nextAction = 'ACTION REQUIRED NOW: Read CURRENT-STATE.md for where things stand, then RECOMMENDATIONS.md for what to do next. You are continuing an implementation. Do not ask the user what to do — read the files and resume working.';
    } else if (vendorSkillInput) {
      nextAction = `ACTION REQUIRED NOW: Read GETTING-STARTED.md immediately, then load the expert skill at .claude/skills/${vendorSkillInput.skillName}/SKILL.md. You are the implementer. Do not summarize these files to the user. Do not ask what to do next. Read them and start building.`;
    } else {
      nextAction = 'ACTION REQUIRED NOW: Read GETTING-STARTED.md immediately and start implementation. You are the implementer. Do not summarize the files to the user. Do not ask what to do next. Read and start building.';
    }

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
