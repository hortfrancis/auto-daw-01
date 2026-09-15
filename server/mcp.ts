import { McpServer } from '@modelcontextprotocol/server';
import { registerClipTools } from './tools/clips.ts';
import { registerProjectTools } from './tools/project.ts';
import { registerRenderTools } from './tools/render.ts';
import { registerTransportTools } from './tools/transport.ts';

// Tool design follows docs/agentic-usability.md: self-evident descriptions,
// short text results, and errors that say how to fix the problem.

// Called once per MCP request: the HTTP handler is stateless, so each request
// gets a fresh McpServer. State lives in store.ts and live.ts.
export function createMcpServer() {
  const server = new McpServer({ name: 'auto-daw', version: '0.0.0' });
  registerProjectTools(server);
  registerClipTools(server);
  registerTransportTools(server);
  registerRenderTools(server);
  return server;
}
