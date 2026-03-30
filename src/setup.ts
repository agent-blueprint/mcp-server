import { createInterface } from 'node:readline';
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

import { AgentBlueprintClient } from './client.js';
import { loadConfig } from './config.js';
import { saveToken } from './token-store.js';
import { formatError } from './errors.js';

// ─── Types ───────────────────────────────────────────────────────

export interface SetupArgs {
  token?: string;
  apiUrl?: string;
  tokenOnly?: boolean;
  snInstance?: string;
  snUser?: string;
  snPass?: string;
}

// ─── Arg parsing ─────────────────────────────────────────────────

export function parseSetupArgs(args: string[]): SetupArgs {
  const result: SetupArgs = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--token':
        result.token = args[++i];
        break;
      case '--api-url':
        result.apiUrl = args[++i];
        break;
      case '--token-only':
        result.tokenOnly = true;
        break;
      case '--sn-instance':
        result.snInstance = args[++i];
        break;
      case '--sn-user':
        result.snUser = args[++i];
        break;
      case '--sn-pass':
        result.snPass = args[++i];
        break;
    }
  }

  return result;
}

// ─── Helpers ─────────────────────────────────────────────────────

function getShellConfigPath(): string {
  const shell = process.env.SHELL || '';
  if (shell.endsWith('/zsh')) return join(homedir(), '.zshrc');
  if (shell.endsWith('/bash')) return join(homedir(), '.bashrc');
  // Fallback: try .zshrc on macOS, .bashrc on Linux
  if (process.platform === 'darwin') return join(homedir(), '.zshrc');
  return join(homedir(), '.bashrc');
}

const MARKER = '# Added by agentblueprint setup';

function readShellConfig(path: string): string {
  try {
    return readFileSync(path, 'utf-8');
  } catch {
    return '';
  }
}

/**
 * Append or update SN_* exports in the user's shell config.
 * Uses a marker comment to identify our block.
 */
function writeShellCredentials(
  shellPath: string,
  instance: string,
  username: string,
  password: string,
): void {
  const block = [
    '',
    MARKER,
    `export SN_INSTANCE="${instance}"`,
    `export SN_USER="${username}"`,
    `export SN_PASS="${password}"`,
  ].join('\n');

  const existing = readShellConfig(shellPath);

  // Remove existing block if present
  const markerIdx = existing.indexOf(MARKER);
  if (markerIdx !== -1) {
    // Find the end of the block (next empty line or 3 exports after marker)
    const lines = existing.split('\n');
    const markerLine = lines.findIndex(l => l.includes(MARKER));
    // Remove marker line + up to 3 export lines after it
    let endLine = markerLine + 1;
    while (endLine < lines.length && lines[endLine].startsWith('export SN_')) {
      endLine++;
    }
    lines.splice(markerLine, endLine - markerLine);
    // Remove trailing blank line if we left one
    if (markerLine > 0 && lines[markerLine - 1] === '') {
      lines.splice(markerLine - 1, 1);
    }
    writeFileSync(shellPath, lines.join('\n'), 'utf-8');
  }

  appendFileSync(shellPath, block + '\n', 'utf-8');
}

function maskPassword(pass: string): string {
  if (pass.length <= 4) return '****';
  return pass.slice(0, 2) + '*'.repeat(pass.length - 4) + pass.slice(-2);
}

// ─── Token validation (shared with login) ────────────────────────

export async function validateAndSaveToken(
  token: string,
  apiUrl?: string,
): Promise<void> {
  console.error('Validating token...');
  try {
    const config = loadConfig(token);
    const client = new AgentBlueprintClient(config);
    const identity = await client.getIdentity();
    const label = identity.email
      ? `${identity.email} (${identity.organizationName ?? identity.organizationId})`
      : identity.organizationName ?? identity.organizationId;
    console.error(`Authenticated as: ${label}`);
  } catch (err) {
    console.error(`Error: Token validation failed. ${formatError(err)}`);
    process.exit(1);
  }

  saveToken(token, apiUrl);
  console.error('Token saved to ~/.config/agentblueprint/config.json');
}

// ─── Main setup command ──────────────────────────────────────────

export async function runSetup(args: SetupArgs): Promise<void> {
  const isInteractive = process.stdin.isTTY && !args.token && !process.env.AGENT_BLUEPRINT_API_KEY;

  if (isInteractive) {
    console.error('Agent Blueprint Setup\n');
  }

  // ── Step 1: API Token ──────────────────────────────────────────

  let token = args.token || process.env.AGENT_BLUEPRINT_API_KEY;

  if (!token) {
    // Check if we already have a stored token
    try {
      loadConfig();
      if (isInteractive) {
        console.error('Step 1: API Token');
        console.error('API token already configured.\n');
      }
    } catch {
      // No stored token, need one
      if (isInteractive) {
        console.error('Step 1: API Token');
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
        console.error('Error: No API token provided. Pass --token or set AGENT_BLUEPRINT_API_KEY.');
        process.exit(1);
      }

      await validateAndSaveToken(token, args.apiUrl);
      console.error('');
    }
  } else {
    // Token provided via flag or env var
    await validateAndSaveToken(token, args.apiUrl);
    console.error('');
  }

  if (args.tokenOnly) {
    console.error('Setup complete (token only).');
    return;
  }

  // ── Step 2: Platform Access ────────────────────────────────────

  // Resolve credentials: flags > env vars > interactive
  let snInstance = args.snInstance || process.env.SN_INSTANCE;
  let snUser = args.snUser || process.env.SN_USER || 'admin';
  let snPass = args.snPass || process.env.SN_PASS;

  // If all credentials already in env, just confirm
  if (process.env.SN_INSTANCE && process.env.SN_PASS && !args.snInstance) {
    if (isInteractive) {
      console.error('Step 2: Platform Access');
      console.error(`ServiceNow already configured via environment variables:`);
      console.error(`  SN_INSTANCE=${process.env.SN_INSTANCE}`);
      console.error(`  SN_USER=${process.env.SN_USER || 'admin'}`);
      console.error(`  SN_PASS=${maskPassword(process.env.SN_PASS)}\n`);
    }
  } else if (snInstance && snPass) {
    // Provided via flags, write to shell config
    const shellPath = getShellConfigPath();
    writeShellCredentials(shellPath, snInstance, snUser, snPass);

    const shellName = shellPath.endsWith('.zshrc') ? '~/.zshrc' : '~/.bashrc';
    console.error(`Added to ${shellName}:`);
    console.error(`  export SN_INSTANCE=${snInstance}`);
    console.error(`  export SN_USER=${snUser}`);
    console.error(`  export SN_PASS=${maskPassword(snPass)}`);
    console.error('');
    console.error(`Run: source ${shellName} (or open a new terminal)\n`);

    // Side effect: write MCP server config if installed
    await writeMcpConfigIfInstalled(snInstance, snUser, snPass);
  } else if (isInteractive) {
    console.error('Step 2: Platform Access');
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    const ask = (prompt: string): Promise<string> =>
      new Promise((resolve) => {
        rl.question(prompt, (answer) => resolve(answer.trim()));
      });

    try {
      const connectSn = await ask('Connect to a ServiceNow instance? (y/n): ');
      if (connectSn.toLowerCase() === 'y' || connectSn.toLowerCase() === 'yes') {
        snInstance = await ask('Instance name: ');
        if (!snInstance) {
          console.error('Skipping ServiceNow setup.\n');
        } else {
          const promptedUser = await ask('Username [admin]: ');
          if (promptedUser) snUser = promptedUser;

          snPass = await ask('Password: ');
          if (!snPass) {
            console.error('Error: Password is required. Skipping ServiceNow setup.\n');
          } else {
            const shellPath = getShellConfigPath();
            writeShellCredentials(shellPath, snInstance, snUser, snPass);

            const shellName = shellPath.endsWith('.zshrc') ? '~/.zshrc' : '~/.bashrc';
            console.error('');
            console.error(`Added to ${shellName}:`);
            console.error(`  export SN_INSTANCE=${snInstance}`);
            console.error(`  export SN_USER=${snUser}`);
            console.error(`  export SN_PASS=${maskPassword(snPass)}`);
            console.error('');
            console.error(`Run: source ${shellName} (or open a new terminal)\n`);

            await writeMcpConfigIfInstalled(snInstance, snUser, snPass);
          }
        }
      } else {
        console.error('');
      }
    } finally {
      rl.close();
    }
  }

  console.error('Setup complete.');
}

/**
 * If servicenow-mcp-server is installed globally, write its config file
 * as a convenience side effect. If not installed, skip silently.
 */
async function writeMcpConfigIfInstalled(
  instance: string,
  username: string,
  password: string,
): Promise<void> {
  try {
    const { setupServiceNowMcp } = await import('./mcp-setup.js');
    // Pass credentials so it runs non-interactively
    await setupServiceNowMcp({ instance, username, password });
  } catch {
    // MCP server not installed or setup failed — not an error
  }
}
