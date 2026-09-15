/**
 * A problem with the caller's request. MCP tools send the message straight back
 * to the agent, so it must say what was wrong and how to fix it.
 */
export class CommandError extends Error {}
