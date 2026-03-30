import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';

import { AgentBlueprintClient } from './client.js';
import type { Config } from './config.js';
import { getNextActionDirective } from './directives.js';
import { fetchAndRenderBlueprint } from './fetch-blueprint.js';

export interface DownloadArgs {
  blueprintId?: string;
  dir: string;
  list: boolean;
  customerOrgId?: string;
  platform?: string;
}

// Flags that moved to `agentblueprint setup` — log deprecation if used
const DEPRECATED_FLAGS = new Set(['--no-mcp', '--sn-instance', '--sn-user', '--sn-pass']);

export function parseDownloadArgs(args: string[]): DownloadArgs {
  const result: DownloadArgs = {
    dir: '.agent-blueprint',
    list: false,
  };

  let hasDeprecatedFlags = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (DEPRECATED_FLAGS.has(arg)) {
      hasDeprecatedFlags = true;
      // Skip value for flags that take one
      if (arg !== '--no-mcp') i++;
      continue;
    }
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

  if (hasDeprecatedFlags) {
    console.error('Warning: --no-mcp, --sn-instance, --sn-user, --sn-pass have moved to `agentblueprint setup`.');
    console.error('These flags on `download` are deprecated and will be removed in a future version.\n');
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
  platform?: string,
): Promise<void> {
  blueprintId = await resolveId(client, blueprintId, customerOrgId);
  console.error(`Fetching blueprint ${blueprintId}...`);

  const result = await fetchAndRenderBlueprint(client, blueprintId, {
    customerOrgId,
    platform,
  });

  const outDir = join(baseDir, result.slug);

  // Write files
  let totalSize = 0;
  for (const [relativePath, content] of result.files) {
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
  console.error(`Downloaded ${result.files.size} files to ${outDir}/`);
  console.error(`Total size: ${(totalSize / 1024).toFixed(1)} KB`);
  console.error('');
  console.error('Files:');
  for (const [path] of result.files) {
    if (path.startsWith('.claude/skills/')) {
      console.error(`  ${path} (project root)`);
    } else {
      console.error(`  ${path}`);
    }
  }
  if (result.hasBaseSkill) {
    console.error('');
    console.error('Base skill installed: .claude/skills/agent-blueprint/');
    console.error('Claude Code will auto-discover this skill in all future sessions.');
  }
  if (result.vendorSkillName) {
    console.error('');
    console.error(`Expert skill installed: .claude/skills/${result.vendorSkillName}/`);
    console.error('Claude Code will auto-discover this skill in all future sessions.');
  }
  if (result.hasImplementationState) {
    console.error('');
    console.error('Return visit detected: includes implementation state and/or metrics.');
  }
  // Check platform credentials before printing directive
  let platformNotConfigured = false;
  if (platform === 'servicenow') {
    const { isServiceNowConfigured } = await import('./mcp-setup.js');
    const configured = await isServiceNowConfigured();
    if (!configured) {
      platformNotConfigured = true;
      console.error('ServiceNow instance not configured.');
      console.error('Run: agentblueprint setup');
      console.error('Or set: SN_INSTANCE, SN_USER, SN_PASS environment variables.');
    }
  }

  console.error('');
  console.error(getNextActionDirective({
    hasImplementationState: result.hasImplementationState,
    hasBaseSkill: result.hasBaseSkill,
    vendorSkillName: result.vendorSkillName,
    platformNotConfigured,
  }));
}
