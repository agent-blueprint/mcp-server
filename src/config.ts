export interface Config {
  apiKey: string;
  apiUrl: string;
}

export function loadConfig(tokenOverride?: string): Config {
  const apiKey = tokenOverride || process.env.AGENT_BLUEPRINT_API_KEY || '';
  const apiUrl = process.env.AGENT_BLUEPRINT_API_URL || 'https://app.agentblueprint.ai';

  if (!apiKey) {
    throw new Error(
      'Missing API key. Set AGENT_BLUEPRINT_API_KEY environment variable or pass --token flag.'
    );
  }

  return { apiKey, apiUrl };
}
