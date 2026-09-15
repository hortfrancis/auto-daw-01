import { createServer } from 'node:http';
import path from 'node:path';
import express from 'express';
import { localhostHostValidation, localhostOriginValidation } from '@modelcontextprotocol/express';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { createMcpHandler } from '@modelcontextprotocol/server';
import react from '@vitejs/plugin-react';
import { createServer as createViteServer } from 'vite';
import { PORT, UI_URL } from './config.ts';
import { attachLiveUpdates } from './live.ts';
import { createMcpServer } from './mcp.ts';
import { receiveRender } from './renders.ts';

const startedAt = Date.now();

const app = express();
const httpServer = createServer(app);
attachLiveUpdates(httpServer);

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

// Browser tabs upload finished renders here. Large binary bodies are a better
// fit for HTTP than for the WebSocket.
app.post(
  '/api/renders/:id',
  localhostHostValidation(),
  localhostOriginValidation(),
  express.raw({ type: 'audio/wav', limit: '1gb' }),
  (req, res) => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      res.status(400).json({ error: 'Expected a WAV body with Content-Type: audio/wav' });
    } else if (!receiveRender(String(req.params.id), req.body)) {
      res.status(404).json({ error: 'Unknown or expired render id' });
    } else {
      res.status(204).end();
    }
  },
);

// The web UI is served by Vite running inside this process, so the UI, the API,
// MCP and the WebSocket all share one port. Vite's hot-reload socket shares the
// same HTTP server.
const vite = await createViteServer({
  root: path.resolve(import.meta.dirname, '../web'),
  configFile: false,
  plugins: [react()],
  appType: 'spa',
  server: { middlewareMode: true, hmr: { server: httpServer } },
});
app.use(vite.middlewares);

httpServer.listen(PORT, () => {
  console.log(`Auto DAW running at ${UI_URL}`);
});
