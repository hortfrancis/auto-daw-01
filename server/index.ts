import { createServer } from 'node:http';
import path from 'node:path';
import express from 'express';
import { createServer as createViteServer } from 'vite';

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
