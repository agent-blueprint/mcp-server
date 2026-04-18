# agentblueprint

CLI and MCP server for [Agent Blueprint](https://app.agentblueprint.ai) — 8 MCP tools for exploring and downloading AI agent blueprints. List blueprints, get summaries, download full Agent Skills directories for implementation by coding agents. Vendor-agnostic output works with ServiceNow, Salesforce, OpenClaw, or any platform.

## CLI Quick Start

```bash
# Install globally
npm install -g agentblueprint

# Store your API token (one-time)
agentblueprint login

# List blueprints
agentblueprint list

# Get a blueprint summary (JSON to stdout)
agentblueprint get blueprint <id>

# Get other artifacts
agentblueprint get business-case <id>
agentblueprint get use-case <id>
agentblueprint get implementation-plan <id>
agentblueprint get implementation-spec <id>
agentblueprint get business-profile

# Download as Agent Skills directory
agentblueprint download <id>

# Partner cross-org access
agentblueprint list --org <customer-org-id>
agentblueprint get blueprint <id> --org <customer-org-id>
```

Or run without installing via npx:

```bash
npx agentblueprint list --token <your-api-key>
npx agentblueprint get blueprint <id> --token <your-api-key>
```

## MCP Server Setup

The same binary auto-detects MCP mode when stdin is piped (non-interactive). No separate command needed.

Add to your Claude Code MCP config (`.claude/settings.json` or project settings):

```json
{
  "mcpServers": {
    "agent-blueprint": {
      "command": "npx",
      "args": ["@agentblueprint/mcp-server"],
      "env": {
        "AGENT_BLUEPRINT_API_KEY": "<your-api-key>"
      }
    }
  }
}
```

You can also start the MCP server explicitly with `agentblueprint serve`.

## Get an API Key

1. Go to [Agent Blueprint Settings > API Tokens](https://app.agentblueprint.ai/settings/api-tokens)
2. Click "Create Token"
3. Copy the token (shown once)

## Download Blueprint as Agent Skills

Download a blueprint as a local Agent Skills directory that any coding agent can read from the filesystem. This is the recommended way to work with blueprints.

```bash
# Using the CLI (after `agentblueprint login`)
agentblueprint download <id>
agentblueprint download <id> --dir ./my-skills

# Or via npx
npx agentblueprint download --token <key> --blueprint <id>
```

This creates an Agent Skills directory structure:

```
.agent-blueprint/<blueprint-slug>/
├── SKILL.md                              # Overview + frontmatter (auto-discovered by agents)
├── references/
│   ├── business-context.md               # Use case, pain points, transformation story
│   ├── agent-specifications.md           # Full agent specs with tools, guardrails, metrics
│   ├── financial-case.md                 # ROI, cost breakdown, sensitivity, 5-year projection
│   ├── implementation-roadmap.md         # Epics, stories, timeline, roles, dependencies
│   ├── architecture-decisions.md         # Platform, pattern, integration gaps, feasibility
│   └── guardrails-and-governance.md      # Risks, mitigation, per-agent guardrails
└── scripts/
    └── validate-spec.sh                  # Structure completeness checker
```

The [Agent Skills](https://agentskills.io) standard is supported by Claude Code, Codex, Cursor, GitHub Copilot, Windsurf, and 18+ other coding agents. SKILL.md loads automatically at activation (~100 tokens), reference files load on demand.

## Available Tools

| Tool | Description |
|------|-------------|
| `list_blueprints` | List all blueprints (summaries) |
| `get_blueprint` | Blueprint summary — title, agents, phases, pattern |
| `get_business_case` | Business case summary — ROI, pilot economics, recommendation |
| `get_implementation_plan` | Implementation plan summary — epics, timeline, story counts |
| `get_use_case` | Use case analysis for a blueprint |
| `get_implementation_spec` | Implementation spec metadata |
| `get_business_profile` | Organization business profile |
| `download_blueprint` | Download full blueprint as Agent Skills file manifest |

The `get_blueprint`, `get_business_case`, and `get_implementation_plan` tools return concise summaries optimized for agent context windows. For full details (agent specs, financial projections, user stories), use `download_blueprint` to get the complete Agent Skills directory.

## Available Resources

| URI | Description |
|-----|-------------|
| `agentblueprint://blueprints` | Blueprint list (JSON) |
| `agentblueprint://blueprints/{id}` | Blueprint detail (Markdown) |
| `agentblueprint://blueprints/{id}/spec` | Implementation spec (Markdown) |

## Authentication

Three ways to provide your API token (checked in this order):

1. `--token <key>` flag on any command
2. `AGENT_BLUEPRINT_API_KEY` environment variable
3. `agentblueprint login` (saved to `~/.config/agentblueprint/config.json`)

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AGENT_BLUEPRINT_API_KEY` | No | — | Your API token (alternative to `agentblueprint login`) |
| `AGENT_BLUEPRINT_API_URL` | No | `https://app.agentblueprint.ai` | API base URL |
