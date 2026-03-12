import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

interface StoredConfig {
  apiKey: string;
  apiUrl?: string;
}

function getConfigDir(): string {
  const base = process.env.APPDATA || join(homedir(), '.config');
  return join(base, 'agentblueprint');
}

function getConfigPath(): string {
  return join(getConfigDir(), 'config.json');
}

export function saveToken(token: string, apiUrl?: string): void {
  const dir = getConfigDir();
  mkdirSync(dir, { recursive: true });

  const data: StoredConfig = { apiKey: token };
  if (apiUrl) data.apiUrl = apiUrl;

  writeFileSync(getConfigPath(), JSON.stringify(data, null, 2), {
    encoding: 'utf-8',
    mode: 0o600,
  });
}

export function loadToken(): StoredConfig | null {
  try {
    const raw = readFileSync(getConfigPath(), 'utf-8');
    const parsed = JSON.parse(raw) as StoredConfig;
    if (parsed.apiKey) return parsed;
    return null;
  } catch {
    return null;
  }
}
