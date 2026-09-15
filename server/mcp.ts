import { McpServer } from '@modelcontextprotocol/server';
import { demoProject } from './project.ts';

// Called once per MCP request: the HTTP handler is stateless, so each request
// gets a fresh McpServer. Shared state must live outside this function.
export function createMcpServer() {
  const server = new McpServer({ name: 'auto-daw', version: '0.0.0' });

  server.registerTool(
    'get_project',
    {
      title: 'Get project',
      description:
        'Returns the current project: tempo, time signature, and tracks with their clips and notes. Positions are 1-based bars and beats.',
      annotations: { readOnlyHint: true },
    },
    async () => ({
      content: [{ type: 'text', text: JSON.stringify(demoProject, null, 2) }],
    }),
  );

  return server;
}
