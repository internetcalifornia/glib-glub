/**
 * @glib-glub/mcp-tools — pure tool registration for the MCP surface. The
 * transport (HTTP in apps/web) resolves the caller and builds the deps;
 * this package only says what the tools are.
 */

export { errorResult, textResult } from './common';
export type { ToolContext, ToolText } from './common';
export { CURRICULUM_TOOL_NAMES, registerCurriculumTools } from './curriculum-tools';
