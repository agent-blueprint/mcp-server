# @agentblueprint/mcp-server

MCP server for [Agent Blueprint](https://app.agentblueprint.ai) — gives your coding agent read access to your AI blueprints, business cases, implementation plans, and specs.

## Quick Start

```bash
npx @agentblueprint/mcp-server --token <your-api-key>
```

## Claude Code Setup

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

## Get an API Key

1. Go to [Agent Blueprint Settings > API Tokens](https://app.agentblueprint.ai/settings/api-tokens)
2. Click "Create Token"
3. Copy the token (shown once)

## Download Blueprint as Agent Skills

Download a blueprint as a local Agent Skills directory that any coding agent can read from the filesystem. This is the recommended way to work with blueprints — it keeps your agent's context window small while giving it access to all the details on demand.

```bash
# List available blueprints
npx @agentblueprint/mcp-server download --token <key> --list

# Download a blueprint
npx @agentblueprint/mcp-server download --token <key> --blueprint <id>

# Download to a custom directory
npx @agentblueprint/mcp-server download --token <key> --blueprint <id> --dir ./my-skills
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

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AGENT_BLUEPRINT_API_KEY` | Yes | — | Your API token |
| `AGENT_BLUEPRINT_API_URL` | No | `https://app.agentblueprint.ai` | API base URL |
