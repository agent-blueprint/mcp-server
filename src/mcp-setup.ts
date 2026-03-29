import { writeFile, mkdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createInterface } from 'node:readline';
import { join } from 'node:path';

const execFileAsync = promisify(execFile);

export interface McpSetupCredentials {
  instance?: string;
  username?: string;
  password?: string;
}

/**
 * Resolve credentials from flags, env vars, or interactive prompts.
 * Priority: explicit option > env var > interactive prompt.
 */
function resolveCredential(
  option: string | undefined,
  envVar: string,
  fallback?: string
): string | undefined {
  return option || process.env[envVar] || fallback;
}

/**
 * Setup for the ServiceNow MCP server.
 *
 * When credentials are provided via options or env vars (SN_INSTANCE,
 * SN_USER, SN_PASS), runs non-interactively. Otherwise falls back to
 * interactive prompts.
 *
 * Installs the `servicenow-mcp-server` npm package globally if needed,
 * writes instance credentials, and prints the MCP config snippet for
 * the user to add to their coding agent of choice.
 */
export async function setupServiceNowMcp(credentials?: McpSetupCredentials): Promise<void> {
  console.error('\n--- ServiceNow MCP Server Setup ---\n');

  // Resolve from flags/env first
  let instanceName = resolveCredential(credentials?.instance, 'SN_INSTANCE');
  let username = resolveCredential(credentials?.username, 'SN_USER', 'admin');
  let password = resolveCredential(credentials?.password, 'SN_PASS');

  // If all resolved non-interactively, skip prompts entirely
  const nonInteractive = !!(instanceName && password);

  if (!nonInteractive) {
    // Fall back to interactive prompts
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    const ask = (prompt: string): Promise<string> =>
      new Promise((resolve) => {
        rl.question(prompt, (answer) => resolve(answer.trim()));
      });

    try {
      if (!instanceName) {
        instanceName = await ask('ServiceNow instance name (press enter to skip): ');
        if (!instanceName) {
          console.error('Skipping ServiceNow MCP setup.');
          return;
        }
      }

      if (!username || username === 'admin') {
        const prompted = await ask('Username [admin]: ');
        if (prompted) username = prompted;
      }

      if (!password) {
        password = await ask('Password: ');
        if (!password) {
          console.error('Error: Password is required. Aborting MCP setup.');
          return;
        }
      }
    } finally {
      rl.close();
    }
  }

  if (nonInteractive) {
    console.error('Using credentials from flags/environment (non-interactive mode).');
  }

  // 2. Check if servicenow-mcp-server is installed
  let installed = false;
  try {
    await execFileAsync('which', ['servicenow-mcp-server']);
    installed = true;
  } catch {
    installed = false;
  }

  if (!installed) {
    console.error('Installing servicenow-mcp-server globally...');
    try {
      await execFileAsync('npm', ['install', '-g', 'servicenow-mcp-server']);
    } catch {
      console.error(
        `Failed to install servicenow-mcp-server globally. Install manually with:\n  npm install -g servicenow-mcp-server`
      );
      return;
    }
  }

  // 3. Resolve absolute binary path (avoids nvm/fnm/volta PATH issues)
  let binaryPath: string;
  try {
    const { stdout } = await execFileAsync('which', ['servicenow-mcp-server']);
    binaryPath = stdout.trim();
  } catch {
    console.error('Error: Could not resolve servicenow-mcp-server binary path.');
    return;
  }

  // 4. Resolve global package directory
  let pkgDir: string;
  try {
    const { stdout } = await execFileAsync('npm', ['root', '-g']);
    pkgDir = join(stdout.trim(), 'servicenow-mcp-server');
  } catch {
    console.error('Error: Could not resolve global npm root.');
    return;
  }

  // 5. Write config file with instance credentials
  const configDir = join(pkgDir, 'config');
  await mkdir(configDir, { recursive: true });

  const configContent = JSON.stringify(
    {
      instances: [
        {
          name: instanceName,
          url: `https://${instanceName}.service-now.com`,
          username,
          password,
          default: true,
        },
      ],
    },
    null,
    2
  );

  const configPath = join(configDir, 'servicenow-instances.json');
  await writeFile(configPath, configContent, { encoding: 'utf-8', mode: 0o600 });

  // 6. Print success and MCP config snippet
  console.error('');
  console.error('ServiceNow MCP server configured:');
  console.error(`  Instance:    ${instanceName}`);
  console.error(`  Config:      ${configPath}`);
  console.error(`  Binary:      ${binaryPath}`);
  console.error('');
  console.error('Add this to your coding agent\'s MCP config:');
  console.error('');
  console.error(JSON.stringify({
    mcpServers: {
      servicenow: {
        command: binaryPath,
        args: [],
      },
    },
  }, null, 2));
  console.error('');
  console.error('Add to your coding agent\'s MCP config and restart to connect.');
}
