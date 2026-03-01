#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { loadConfig } from './config.js';
import { createServer } from './server.js';

function parseArgs(args: string[]): { token?: string } {
  const tokenIdx = args.indexOf('--token');
  if (tokenIdx !== -1 && args[tokenIdx + 1]) {
    return { token: args[tokenIdx + 1] };
  }
  return {};
}

async function main() {
  const { token } = parseArgs(process.argv.slice(2));

  try {
    const config = loadConfig(token);
    const server = createServer(config);
    const transport = new StdioServerTransport();
    await server.connect(transport);
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
}

main();
