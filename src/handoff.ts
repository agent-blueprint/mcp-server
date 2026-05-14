import { AgentBlueprintClient } from './client.js';
import { runDownload } from './download.js';
import { saveToken } from './token-store.js';

export interface HandoffArgs {
  token?: string;
  apiUrl?: string;
  dir: string;
}

export interface HandoffAcceptResponse {
  apiToken: string;
  apiUrl?: string;
  organizationId: string;
  customerOrgId?: string | null;
  blueprintId?: string | null;
  platform?: string | null;
  expiresAt?: string | null;
  suggestedNextAction?: string;
}

export function parseHandoffArgs(args: string[]): HandoffArgs {
  const result: HandoffArgs = {
    dir: '.agent-blueprint',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--token':
        result.token = args[++i];
        break;
      case '--api-url':
        result.apiUrl = args[++i];
        break;
      case '--dir':
        result.dir = args[++i];
        break;
      default:
        break;
    }
  }

  return result;
}

export async function acceptHandoffToken(
  apiUrl: string,
  token: string,
): Promise<HandoffAcceptResponse> {
  const url = new URL('/api/v1/handoffs/accept', apiUrl);
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    const message = typeof body?.error === 'string'
      ? body.error
      : `Handoff exchange failed: ${response.status}`;
    throw new Error(message);
  }

  const json = await response.json() as {
    success?: boolean;
    data?: HandoffAcceptResponse;
    error?: string;
  };

  if (!json.success || !json.data?.apiToken) {
    throw new Error(json.error || 'Handoff exchange did not return an API token');
  }

  return json.data;
}

export async function runHandoffAccept(args: HandoffArgs): Promise<void> {
  if (!args.token) {
    console.error('Error: --token <handoff-token> is required.');
    console.error('Usage: agentblueprint handoff accept --token <token> [--api-url <url>] [--dir <path>]');
    process.exit(1);
  }

  const apiUrl = args.apiUrl || process.env.AGENT_BLUEPRINT_API_URL || 'https://app.agentblueprint.ai';
  console.error('Accepting Agent Blueprint handoff...');

  const result = await acceptHandoffToken(apiUrl, args.token);
  const resolvedApiUrl = result.apiUrl || apiUrl;
  saveToken(result.apiToken, resolvedApiUrl);

  console.error('Agent Blueprint credentials saved locally.');
  if (result.expiresAt) {
    console.error(`Local credential expires: ${result.expiresAt}`);
  }
  console.error('');

  const customerOrgId = result.customerOrgId || result.organizationId;

  if (result.blueprintId) {
    console.error('Blueprint context found. Downloading implementation workspace...');
    await runDownload(
      { apiKey: result.apiToken, apiUrl: resolvedApiUrl },
      {
        blueprintId: result.blueprintId,
        customerOrgId,
        platform: result.platform || undefined,
        dir: args.dir,
        list: false,
      },
    );
    return;
  }

  const client = new AgentBlueprintClient({ apiKey: result.apiToken, apiUrl: resolvedApiUrl });
  const identity = await client.getIdentity().catch(() => null);
  if (identity?.email || identity?.organizationName) {
    const label = identity.email
      ? `${identity.email} (${identity.organizationName ?? identity.organizationId})`
      : identity.organizationName ?? identity.organizationId;
    console.error(`Connected as: ${label}`);
  }

  console.error('No blueprint exists for this handoff yet.');
  console.error('');
  console.error('Next steps for the coding agent:');
  console.error('1. Read the business profile with `agentblueprint get business-profile`.');
  console.error('2. Interview the user for missing profile facts and update via MCP/CLI write tools.');
  console.error('3. Generate or update use cases, then trigger blueprint generation when ready.');
  console.error('4. After a blueprint exists, run `agentblueprint download <blueprint-id>`.');
  if (result.suggestedNextAction) {
    console.error('');
    console.error(result.suggestedNextAction);
  }
}
