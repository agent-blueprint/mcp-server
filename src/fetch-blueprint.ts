/**
 * Shared blueprint data fetching and render input assembly.
 *
 * SINGLE SOURCE OF TRUTH. Both the CLI (download.ts) and MCP tool
 * (download-blueprint.ts) use this. All data fetching, title extraction,
 * vendor resolution, and SkillRenderInput assembly lives here.
 */

import type { AgentBlueprintClient } from './client.js';
import { renderSkillDirectory, slugify } from './renderers.js';
import type { SkillRenderInput } from './renderers.js';

export interface BlueprintDownloadResult {
  input: SkillRenderInput;
  files: Map<string, string>;
  slug: string;
  title: string;
  hasImplementationState: boolean;
  vendorSkillName?: string;
}

export async function fetchAndRenderBlueprint(
  client: AgentBlueprintClient,
  blueprintId: string,
  opts: { customerOrgId?: string; platform?: string }
): Promise<BlueprintDownloadResult> {
  const orgId = opts.customerOrgId;

  // Fetch all data in parallel
  const [blueprint, businessCase, implementationPlan, useCase, businessProfile] = await Promise.all([
    client.getBlueprint(blueprintId, orgId),
    client.getBusinessCase(blueprintId, orgId).catch(() => null),
    client.getImplementationPlan(blueprintId, orgId).catch(() => null),
    client.getUseCase(blueprintId, orgId).catch(() => null),
    client.getBusinessProfile(orgId).catch(() => null),
  ]);

  // Fetch reality data for return visits
  const [implementationState, progress] = await Promise.all([
    client.getImplementationState(blueprintId, orgId).catch(() => null),
    client.getProgress(blueprintId, orgId).catch(() => null),
  ]);

  // Extract title
  const bpData = blueprint.data as Record<string, unknown>;
  const title = (bpData.title as string)
    || (bpData.blueprintTitle as string)
    || `Blueprint ${blueprintId.slice(0, 8)}`;

  // Resolve vendor deployment guides and expert skills
  const generalGuideData = await client.getVendorGuide('general');
  let vendorGuideInput: { platform: string; content: string } | undefined;
  let vendorSkillInput: { platform: string; skillName: string; content: string } | undefined;
  if (opts.platform && opts.platform !== 'skip') {
    const vendorSkillData = await client.getVendorSkill(opts.platform);
    if (vendorSkillData) {
      vendorSkillInput = {
        platform: vendorSkillData.platform,
        skillName: vendorSkillData.skillName,
        content: vendorSkillData.content,
      };
    } else {
      const vendorGuideData = await client.getVendorGuide(opts.platform);
      if (vendorGuideData) {
        vendorGuideInput = { platform: vendorGuideData.platform, content: vendorGuideData.content };
      }
    }
  }

  const input: SkillRenderInput = {
    blueprintTitle: title,
    blueprintId,
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

  return {
    input,
    files,
    slug,
    title,
    hasImplementationState: !!implementationState,
    vendorSkillName: vendorSkillInput?.skillName,
  };
}
