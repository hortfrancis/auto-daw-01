import { createServer } from 'node:http';
import path from 'node:path';
import express from 'express';
import { localhostHostValidation, localhostOriginValidation } from '@modelcontextprotocol/express';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { createServer as createViteServer } from 'vite';
import { createMcpServer } from './mcp.ts';

const PORT = Number(process.env.PORT ?? 4747);
const startedAt = Date.now();

const app = express();
const httpServer = createServer(app);

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    node: process.version,
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
  });
});

// MCP over Streamable HTTP. The Host and Origin checks stop other websites from
// reaching this local server through the browser (DNS rebinding).
const mcpHandler = toNodeHandler(
  createMcpHandler(createMcpServer, { onerror: (err) => console.error('[mcp]', err) }),
);
app.all(
  '/mcp',
  localhostHostValidation(),
  localhostOriginValidation(),
  express.json({ limit: '10mb' }),
  (req, res) => mcpHandler(req, res, req.body),
);

// The web UI is served by Vite running inside this process, so the UI, the API
// (and later MCP and the WebSocket) all share one port. Vite's hot-reload
// socket shares the same HTTP server.
const vite = await createViteServer({
  root: path.resolve(import.meta.dirname, '../web'),
  configFile: false,
  appType: 'spa',
  server: { middlewareMode: true, hmr: { server: httpServer } },
});
app.use(vite.middlewares);

httpServer.listen(PORT, () => {
  console.log(`Auto DAW running at http://localhost:${PORT}`);
});
