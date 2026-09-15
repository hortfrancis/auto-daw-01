import { E2E_PORT } from './port.ts';

export type ToolResult = {
  isError: boolean;
  /** All text blocks, joined with newlines. */
  text: string;
  images: { data: string; mimeType: string }[];
};

type ContentBlock = { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string };

/** Calls an MCP tool on the test server (or another port), the same way an agent would. */
export async function callTool(name: string, args: Record<string, unknown> = {}, port = E2E_PORT): Promise<ToolResult> {
  const response = await fetch(`http://localhost:${port}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': '2025-06-18',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  });

  // Responses arrive as a single server-sent event: "data: {json}".
  const body = await response.text();
  const dataLine = body.split('\n').find((line) => line.startsWith('data: '));
  const message = JSON.parse(dataLine ? dataLine.slice('data: '.length) : body);

  if (message.error) return { isError: true, text: `JSON-RPC error: ${message.error.message}`, images: [] };
  const content: ContentBlock[] = message.result.content;
  return {
    isError: Boolean(message.result.isError),
    text: content.flatMap((block) => (block.type === 'text' ? [block.text] : [])).join('\n'),
    images: content.flatMap((block) => (block.type === 'image' ? [{ data: block.data, mimeType: block.mimeType }] : [])),
  };
}
