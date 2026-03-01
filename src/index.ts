#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { loadConfig } from './config.js';
import { createServer } from './server.js';
import { parseDownloadArgs, runDownload } from './download.js';

function parseArgs(args: string[]): { token?: string } {
  const tokenIdx = args.indexOf('--token');
  if (tokenIdx !== -1 && args[tokenIdx + 1]) {
    return { token: args[tokenIdx + 1] };
  }
  return {};
}

async function main() {
  const rawArgs = process.argv.slice(2);

  // Route to download subcommand
  if (rawArgs[0] === 'download') {
    const subArgs = rawArgs.slice(1);
    const { token } = parseArgs(subArgs);
    try {
      const config = loadConfig(token);
      const downloadArgs = parseDownloadArgs(subArgs);
      await runDownload(config, downloadArgs);
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
    return;
  }

  // Default: MCP stdio mode
  const { token } = parseArgs(rawArgs);

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
