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
