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

## Available Tools

| Tool | Description |
|------|-------------|
| `list_blueprints` | List all blueprints (summaries) |
| `get_blueprint` | Full blueprint data by ID |
| `get_business_case` | Business case for a blueprint |
| `get_implementation_plan` | Implementation plan for a blueprint |
| `get_use_case` | Use case analysis for a blueprint |
| `get_implementation_spec` | Implementation spec metadata |

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
