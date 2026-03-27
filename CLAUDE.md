# CLAUDE.md — Agent Blueprint MCP Server

This is the MCP server and CLI for Agent Blueprint. npm package: `agentblueprint`.

## Commands

```bash
npm run build    # TypeScript compile (tsc)
npm test         # Vitest (1 pre-existing failure in config.test.ts is expected)
npm run dev      # Watch mode
```

## Architecture

Two entry points, one shared core:

```
src/cli.ts              CLI entry (TTY → help, piped → MCP server)
src/download.ts         CLI download handler (writes files to disk)
src/mcp-setup.ts        ServiceNow MCP server setup (credentials, install, config)
src/tools/*.ts          MCP tool handlers (return JSON manifests)
src/fetch-blueprint.ts  SHARED: data fetching + rendering (used by both CLI and MCP)
src/directives.ts       SHARED: post-download agent directives (used by both CLI and MCP)
src/renderers.ts        Agent Skills renderer (GETTING-STARTED, SKILL.md, all references/)
src/server.ts           MCP server setup + tool registration
src/client.ts           HTTP client for Agent Blueprint v1 API
src/config.ts           Config resolution (flag > env > token store)
src/token-store.ts      Persistent token storage
```

## Critical Rules

1. **Vendor-agnostic output.** All rendered content (`renderers.ts`) ships to every customer on every platform. No platform-specific language. No ServiceNow (GlideRecord, sys_app, Agent Studio). No Salesforce. Vendor-specific guidance belongs in expert skills (`docs/kb/vendor-skills/` in the main app repo), delivered via `--platform` flag.

2. **Single source of truth.** CLI and MCP tool paths must share logic, not duplicate it. `fetch-blueprint.ts` handles data fetching + rendering. `directives.ts` handles post-download text. If you need to change behavior that affects both paths, change the shared module. Never put the same string or logic in both `download.ts` and `tools/download-blueprint.ts`.

3. **Test before shipping.** Run `npm test`. 160/161 passing (1 pre-existing config.test.ts failure). If you add new behavior, add tests.

## Publishing

Cannot publish from Claude Code (WebAuthn 2FA). The user runs `npm version patch && npm publish` manually. Always bump the version before asking the user to publish.

## Related Repos

- **Main app** (`~/projects/agent-blueprint`): v1 API, vendor skills (`docs/kb/vendor-skills/`), internal skills (`.claude/skills/`), pipeline
- The vendor skill content served to customers comes from the main app's API (`GET /api/vendor-skill/{platform}`), not from this repo. This repo fetches it at download time.
