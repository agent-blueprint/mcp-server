# Renderer Rules

NEVER put vendor-specific language in renderers.ts. All rendered output (GETTING-STARTED.md, SKILL.md, reference files) ships to every customer on every platform. No ServiceNow terms (GlideRecord, sys_app, Agent Studio, Now Assist, ReAct, compiled_handbook). No Salesforce terms. No platform-specific examples. When fixing a platform-specific issue, ask: "Would this make sense to a customer on a different platform?" If no, it belongs in the vendor expert skill (served from the main app), not in renderers.ts.

NEVER duplicate logic between CLI (download.ts) and MCP (tools/download-blueprint.ts). Both paths use fetch-blueprint.ts for data fetching and directives.ts for post-download text. If you need to change shared behavior, change the shared module. If you find yourself writing the same string or logic in both files, extract it first.

NEVER change directive text without checking both code paths still use the shared source. Grep for any hardcoded "ACTION REQUIRED", "NEXT:", or "Read GETTING-STARTED" strings in download.ts and tools/download-blueprint.ts. They should only import from directives.ts.
