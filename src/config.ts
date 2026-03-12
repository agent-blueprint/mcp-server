import { loadToken } from './token-store.js';

export interface Config {
  apiKey: string;
  apiUrl: string;
}

export function loadConfig(tokenOverride?: string): Config {
  const stored = loadToken();
  const apiKey = tokenOverride || process.env.AGENT_BLUEPRINT_API_KEY || stored?.apiKey || '';
  const apiUrl = process.env.AGENT_BLUEPRINT_API_URL || stored?.apiUrl || 'https://app.agentblueprint.ai';

  if (!apiKey) {
    throw new Error(
      'Missing API key. Set AGENT_BLUEPRINT_API_KEY environment variable, run `agentblueprint login`, or pass --token flag.'
    );
  }

  return { apiKey, apiUrl };
}
