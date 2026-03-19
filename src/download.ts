import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';

import { AgentBlueprintClient } from './client.js';
import type { Config } from './config.js';
import { renderSkillDirectory, slugify } from './renderers.js';
import type { SkillRenderInput } from './renderers.js';

export interface DownloadArgs {
  blueprintId?: string;
  dir: string;
  list: boolean;
  customerOrgId?: string;
  platform?: string;
}

export function parseDownloadArgs(args: string[]): DownloadArgs {
  const result: DownloadArgs = {
    dir: '.agent-blueprint',
    list: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--blueprint':
        result.blueprintId = args[++i];
        break;
      case '--dir':
        result.dir = args[++i];
        break;
      case '--list':
        result.list = true;
        break;
      case '--org':
        result.customerOrgId = args[++i];
        break;
      case '--platform':
        result.platform = args[++i];
        break;
      default:
        // Positional arg: treat as blueprint ID if it doesn't start with --
        if (!arg.startsWith('--') && !result.blueprintId) {
          result.blueprintId = arg;
        }
        break;
    }
  }

  return result;
}

export async function runDownload(config: Config, args: DownloadArgs): Promise<void> {
  const client = new AgentBlueprintClient(config);

  if (args.list) {
    await listBlueprints(client, args.customerOrgId);
    return;
  }

  if (!args.blueprintId) {
    console.error('Error: --blueprint <id> is required. Use --list to see available blueprints.');
    process.exit(1);
  }

  await downloadBlueprint(client, args.blueprintId, args.dir, args.customerOrgId, args.platform);
}

async function listBlueprints(client: AgentBlueprintClient, customerOrgId?: string): Promise<void> {
  const blueprints = await client.listBlueprints(customerOrgId);

  if (blueprints.length === 0) {
    console.error('No blueprints found.');
    return;
  }

  console.error('Available blueprints:\n');
  for (const bp of blueprints) {
    console.error(`  ${bp.id}`);
    console.error(`    Title: ${bp.title}`);
    console.error(`    Platform: ${bp.platform}`);
    console.error(`    Agents: ${bp.agentCount}`);
    console.error(`    Status: ${bp.lifecycleStatus}`);
    console.error('');
  }

  console.error(`Use: agentblueprint download <id>`);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolves a blueprint ID that may be a short prefix (e.g. "dbbf3118")
 * into a full UUID by listing blueprints and matching.
 */
async function resolveId(client: AgentBlueprintClient, input: string, customerOrgId?: string): Promise<string> {
  if (UUID_RE.test(input)) return input;

  const prefix = input.toLowerCase();
  const blueprints = await client.listBlueprints(customerOrgId);
  const matches = blueprints.filter(bp => bp.id.toLowerCase().startsWith(prefix));

  if (matches.length === 1) {
    console.error(`Resolved "${input}" → ${matches[0].id}`);
    return matches[0].id;
  }
  if (matches.length === 0) {
    throw new Error(`No blueprint found matching prefix "${input}". Use --list to see available blueprints.`);
  }
  const ids = matches.map(m => `  ${m.id}  ${m.title}`).join('\n');
  throw new Error(`Prefix "${input}" is ambiguous (${matches.length} matches):\n${ids}\nUse a longer prefix or the full ID.`);
}

async function downloadBlueprint(
  client: AgentBlueprintClient,
  blueprintId: string,
  baseDir: string,
  customerOrgId?: string,
  platform?: string
): Promise<void> {
  blueprintId = await resolveId(client, blueprintId, customerOrgId);
  console.error(`Fetching blueprint ${blueprintId}...`);

  // Fetch all data in parallel
  const [blueprint, businessCase, implementationPlan, useCase, businessProfile] = await Promise.all([
    client.getBlueprint(blueprintId, customerOrgId),
    client.getBusinessCase(blueprintId, customerOrgId).catch(() => null),
    client.getImplementationPlan(blueprintId, customerOrgId).catch(() => null),
    client.getUseCase(blueprintId, customerOrgId).catch(() => null),
    client.getBusinessProfile(customerOrgId).catch(() => null),
  ]);

  const title = (blueprint.data as Record<string, unknown>).title as string
    || blueprint.data.blueprintTitle as string
    || `Blueprint ${blueprintId.slice(0, 8)}`;

  // Fetch vendor deployment guides and expert skills
  const generalGuideData = await client.getVendorGuide('general');
  let vendorGuideInput: { platform: string; content: string } | undefined;
  let vendorSkillInput: { platform: string; skillName: string; content: string } | undefined;
  if (platform && platform !== 'skip') {
    // Try vendor skill first (replaces vendor guide when present)
    const vendorSkillData = await client.getVendorSkill(platform);
    if (vendorSkillData) {
      vendorSkillInput = {
        platform: vendorSkillData.platform,
        skillName: vendorSkillData.skillName,
        content: vendorSkillData.content,
      };
    } else {
      // Fall back to vendor deployment guide
      const vendorGuideData = await client.getVendorGuide(platform);
      if (vendorGuideData) {
        vendorGuideInput = { platform: vendorGuideData.platform, content: vendorGuideData.content };
      } else {
        console.error(`Warning: No vendor skill or guide found for platform "${platform}". Continuing without it.`);
      }
    }
  }

  const input: SkillRenderInput = {
    blueprintTitle: title,
    blueprintId,
    blueprintData: blueprint.data,
    businessCaseData: businessCase?.data,
    implementationPlanData: implementationPlan?.data,
    useCaseData: useCase as Record<string, unknown> | undefined,
    businessProfileData: (businessProfile as unknown as Record<string, unknown>) ?? undefined,
    generalGuide: generalGuideData?.content,
    vendorGuide: vendorGuideInput,
    vendorSkill: vendorSkillInput,
  };

  // Render
  const files = renderSkillDirectory(input);
  const slug = slugify(title) || 'blueprint';
  const outDir = join(baseDir, slug);

  // Write files
  let totalSize = 0;
  for (const [relativePath, content] of files) {
    // Vendor skill files go to project root (not inside outDir)
    const isSkillFile = relativePath.startsWith('.claude/skills/');
    const fullPath = isSkillFile ? join(process.cwd(), relativePath) : join(outDir, relativePath);
    const dir = dirname(fullPath);
    await mkdir(dir, { recursive: true });
    await writeFile(fullPath, content, 'utf-8');
    totalSize += Buffer.byteLength(content, 'utf-8');
  }

  // Summary
  console.error('');
  console.error(`Downloaded ${files.size} files to ${outDir}/`);
  console.error(`Total size: ${(totalSize / 1024).toFixed(1)} KB`);
  console.error('');
  console.error('Files:');
  for (const [path] of files) {
    if (path.startsWith('.claude/skills/')) {
      console.error(`  ${path} (project root)`);
    } else {
      console.error(`  ${path}`);
    }
  }
  if (vendorSkillInput) {
    console.error('');
    console.error(`Expert skill installed: .claude/skills/${vendorSkillInput.skillName}/SKILL.md`);
    console.error('Claude Code will auto-discover this skill in all future sessions.');
  }
  console.error('');
  console.error('Next: Read GETTING-STARTED.md and start implementation.');
}
