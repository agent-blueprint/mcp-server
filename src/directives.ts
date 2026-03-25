/**
 * Post-download directives for the coding agent.
 *
 * SINGLE SOURCE OF TRUTH. Both the CLI (download.ts) and MCP tool
 * (download-blueprint.ts) use these. If you need to change the
 * directive text, change it here and both paths get it.
 */

export function getNextActionDirective(opts: {
  hasImplementationState: boolean;
  hasBaseSkill?: boolean;
  vendorSkillName?: string;
}): string {
  if (opts.hasImplementationState) {
    return 'ACTION REQUIRED NOW: Read CURRENT-STATE.md for where things stand, then RECOMMENDATIONS.md for what to do next. You are continuing an implementation. Do not ask the user what to do — read the files and resume working.';
  }
  if (opts.vendorSkillName) {
    return `ACTION REQUIRED NOW: Read GETTING-STARTED.md immediately, then load the base skill at .claude/skills/agent-blueprint/SKILL.md and the expert skill at .claude/skills/${opts.vendorSkillName}/SKILL.md. You are the implementer. Do not summarize these files to the user. Do not ask what to do next. Read them and start building.`;
  }
  if (opts.hasBaseSkill) {
    return 'ACTION REQUIRED NOW: Read GETTING-STARTED.md immediately, then load the base skill at .claude/skills/agent-blueprint/SKILL.md. You are the implementer. Do not summarize these files to the user. Do not ask what to do next. Read them and start building.';
  }
  return 'ACTION REQUIRED NOW: Read GETTING-STARTED.md immediately and start implementation. You are the implementer. Do not summarize the files to the user. Do not ask what to do next. Read and start building.';
}
