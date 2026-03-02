import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { AgentBlueprintClient } from './client.js';
import type { Config } from './config.js';
import { renderSkillDirectory, slugify } from './renderers.js';
import type { SkillRenderInput } from './renderers.js';

interface DownloadArgs {
  blueprintId?: string;
  dir: string;
  list: boolean;
}

export function parseDownloadArgs(args: string[]): DownloadArgs {
  const result: DownloadArgs = {
    dir: '.agent-blueprint',
    list: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--blueprint':
        result.blueprintId = args[++i];
        break;
      case '--dir':
        result.dir = args[++i];
        break;
      case '--list':
        result.list = true;
        break;
    }
  }

  return result;
}

export async function runDownload(config: Config, args: DownloadArgs): Promise<void> {
  const client = new AgentBlueprintClient(config);

  if (args.list) {
    await listBlueprints(client);
    return;
  }

  if (!args.blueprintId) {
    console.error('Error: --blueprint <id> is required. Use --list to see available blueprints.');
    process.exit(1);
  }

  await downloadBlueprint(client, args.blueprintId, args.dir);
}

async function listBlueprints(client: AgentBlueprintClient): Promise<void> {
  const blueprints = await client.listBlueprints();

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

  console.error(`Use: npx @agentblueprint/mcp-server download --blueprint <id>`);
}

async function downloadBlueprint(
  client: AgentBlueprintClient,
  blueprintId: string,
  baseDir: string
): Promise<void> {
  console.error(`Fetching blueprint ${blueprintId}...`);

  // Fetch all data in parallel
  const [blueprint, businessCase, implementationPlan, useCase, businessProfile] = await Promise.all([
    client.getBlueprint(blueprintId),
    client.getBusinessCase(blueprintId).catch(() => null),
    client.getImplementationPlan(blueprintId).catch(() => null),
    client.getUseCase(blueprintId).catch(() => null),
    client.getBusinessProfile().catch(() => null),
  ]);

  const title = (blueprint.data as Record<string, unknown>).title as string
    || blueprint.data.blueprintTitle as string
    || `Blueprint ${blueprintId.slice(0, 8)}`;

  const input: SkillRenderInput = {
    blueprintTitle: title,
    blueprintId,
    blueprintData: blueprint.data,
    businessCaseData: businessCase?.data,
    implementationPlanData: implementationPlan?.data,
    useCaseData: useCase as Record<string, unknown> | undefined,
    businessProfileData: (businessProfile as unknown as Record<string, unknown>) ?? undefined,
  };

  // Render
  const files = renderSkillDirectory(input);
  const slug = slugify(title) || 'blueprint';
  const outDir = join(baseDir, slug);

  // Write files
  let totalSize = 0;
  for (const [relativePath, content] of files) {
    const fullPath = join(outDir, relativePath);
    const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
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
    console.error(`  ${path}`);
  }
  console.error('');
  console.error('Usage:');
  console.error(`  Claude Code: Reads SKILL.md automatically from ${outDir}/`);
  console.error(`  Other agents: Point your agent at ${outDir}/SKILL.md`);
}
