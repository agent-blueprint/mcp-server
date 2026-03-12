#!/usr/bin/env node

import { createInterface } from 'node:readline';
import { createRequire } from 'node:module';

import { AgentBlueprintClient } from './client.js';
import { loadConfig } from './config.js';
import { formatError } from './errors.js';
import { parseDownloadArgs, runDownload } from './download.js';
import { saveToken } from './token-store.js';
import { handleGetBlueprint } from './tools/get-blueprint.js';
import { handleGetBusinessCase } from './tools/get-business-case.js';
import { handleGetBusinessProfile } from './tools/get-business-profile.js';
import { handleGetImplementationPlan } from './tools/get-implementation-plan.js';
import { handleGetImplementationSpec } from './tools/get-implementation-spec.js';
import { handleGetUseCase } from './tools/get-use-case.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string };

// ─── Arg helpers ──────────────────────────────────────────────────

function findFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  return undefined;
}

function hasFlag(args: string[], ...flags: string[]): boolean {
  return flags.some(f => args.includes(f));
}

// ─── Help text ────────────────────────────────────────────────────

const HELP = `
Agent Blueprint CLI v${pkg.version}

Usage:
  agentblueprint login [--token <token>]                Store API token
  agentblueprint list [--org <id>]                      List blueprints
  agentblueprint get blueprint <id> [--org <id>]        Blueprint summary
  agentblueprint get business-case <id> [--org <id>]    Business case summary
  agentblueprint get use-case <id> [--org <id>]         Use case analysis
  agentblueprint get implementation-plan <id> [--org <id>]  Implementation plan summary
  agentblueprint get implementation-spec <id> [--org <id>]  Implementation spec metadata
  agentblueprint get business-profile [--org <id>]      Business profile
  agentblueprint download <id> [--org <id>] [--dir <path>]  Download as Agent Skills
  agentblueprint --help                                 Show this help
  agentblueprint --version                              Show version

Environment:
  AGENT_BLUEPRINT_API_KEY    API token (alternative to login)
  AGENT_BLUEPRINT_API_URL    API base URL (default: https://app.agentblueprint.ai)

Output goes to stdout (JSON). Status messages go to stderr.
When stdin is piped (non-interactive), starts the MCP server instead.
`.trim();

// ─── Commands ─────────────────────────────────────────────────────

async function cmdLogin(args: string[]): Promise<void> {
  let token = findFlag(args, '--token');

  if (!token) {
    console.error('Get a token at: https://app.agentblueprint.ai/settings/api-tokens\n');
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    token = await new Promise<string>((resolve) => {
      rl.question('API token: ', (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }

  if (!token) {
    console.error('Error: No token provided.');
    process.exit(1);
  }

  // Validate by making a test call
  console.error('Validating token...');
  try {
    const config = loadConfig(token);
    const client = new AgentBlueprintClient(config);
    await client.listBlueprints();
  } catch (err) {
    console.error(`Error: Token validation failed. ${formatError(err)}`);
    process.exit(1);
  }

  const apiUrl = findFlag(args, '--api-url');
  saveToken(token, apiUrl);
  console.error('Token saved. You can now run commands without --token.');
}

async function cmdList(args: string[]): Promise<void> {
  const config = loadConfig(findFlag(args, '--token'));
  const client = new AgentBlueprintClient(config);
  const customerOrgId = findFlag(args, '--org');

  const blueprints = await client.listBlueprints(customerOrgId);
  process.stdout.write(JSON.stringify(blueprints, null, 2) + '\n');
}

async function cmdGet(args: string[]): Promise<void> {
  const subtype = args[0];
  if (!subtype) {
    console.error('Error: Missing artifact type. Usage: agentblueprint get <type> [<id>]');
    console.error('Types: blueprint, business-case, use-case, implementation-plan, implementation-spec, business-profile');
    process.exit(1);
  }

  const rest = args.slice(1);
  const token = findFlag(rest, '--token');
  const customerOrgId = findFlag(rest, '--org');

  // Find positional ID: first arg not starting with -- and not a value of a flag
  const flagValues = new Set<number>();
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--token' || rest[i] === '--org') flagValues.add(i + 1);
  }
  const positionalId = rest.find((a, i) => !a.startsWith('--') && !flagValues.has(i));

  const config = loadConfig(token);
  const client = new AgentBlueprintClient(config);

  let result: { content: { type: string; text: string }[]; isError?: boolean };

  switch (subtype) {
    case 'blueprint': {
      if (!positionalId) {
        console.error('Error: Missing blueprint ID. Usage: agentblueprint get blueprint <id>');
        process.exit(1);
      }
      result = await handleGetBlueprint(client, { blueprintId: positionalId, customerOrgId });
      break;
    }
    case 'business-case': {
      if (!positionalId) {
        console.error('Error: Missing blueprint ID. Usage: agentblueprint get business-case <id>');
        process.exit(1);
      }
      result = await handleGetBusinessCase(client, { blueprintId: positionalId, customerOrgId });
      break;
    }
    case 'use-case': {
      if (!positionalId) {
        console.error('Error: Missing blueprint ID. Usage: agentblueprint get use-case <id>');
        process.exit(1);
      }
      result = await handleGetUseCase(client, { blueprintId: positionalId, customerOrgId });
      break;
    }
    case 'implementation-plan': {
      if (!positionalId) {
        console.error('Error: Missing blueprint ID. Usage: agentblueprint get implementation-plan <id>');
        process.exit(1);
      }
      result = await handleGetImplementationPlan(client, { blueprintId: positionalId, customerOrgId });
      break;
    }
    case 'implementation-spec': {
      if (!positionalId) {
        console.error('Error: Missing blueprint ID. Usage: agentblueprint get implementation-spec <id>');
        process.exit(1);
      }
      result = await handleGetImplementationSpec(client, { blueprintId: positionalId, customerOrgId });
      break;
    }
    case 'business-profile': {
      result = await handleGetBusinessProfile(client, customerOrgId);
      break;
    }
    default:
      console.error(`Error: Unknown type "${subtype}". Valid types: blueprint, business-case, use-case, implementation-plan, implementation-spec, business-profile`);
      process.exit(1);
  }

  if (result.isError) {
    console.error(result.content[0].text);
    process.exit(1);
  }

  process.stdout.write(result.content[0].text + '\n');
}

async function cmdDownload(args: string[]): Promise<void> {
  const token = findFlag(args, '--token');
  const config = loadConfig(token);
  const downloadArgs = parseDownloadArgs(args.filter(a => a !== '--token' && args[args.indexOf(a) - 1] !== '--token'));
  await runDownload(config, downloadArgs);
}

async function startMcpServer(args: string[]): Promise<void> {
  // Dynamic import so the MCP SDK is only loaded when actually serving
  const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
  const { createServer } = await import('./server.js');

  const token = findFlag(args, '--token');
  const config = loadConfig(token);
  const server = createServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// ─── Main ─────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const isTTY = process.stdin.isTTY;

  // No args: show help on TTY, start MCP server on pipe
  if (args.length === 0) {
    if (isTTY) {
      console.error(HELP);
      process.exit(0);
    }
    await startMcpServer(args);
    return;
  }

  if (hasFlag(args, '--help', '-h')) {
    console.error(HELP);
    process.exit(0);
  }

  if (hasFlag(args, '--version', '-v')) {
    console.log(pkg.version);
    process.exit(0);
  }

  const command = args[0];
  const rest = args.slice(1);

  try {
    switch (command) {
      case 'login':
        await cmdLogin(rest);
        break;
      case 'list':
        await cmdList(rest);
        break;
      case 'get':
        await cmdGet(rest);
        break;
      case 'download':
        await cmdDownload(rest);
        break;
      case 'serve':
        await startMcpServer(rest);
        break;
      default:
        console.error(`Unknown command: ${command}\n`);
        console.error(HELP);
        process.exit(1);
    }
  } catch (err) {
    console.error(formatError(err));
    process.exit(1);
  }
}

main();
