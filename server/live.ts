// Pushes project state to browser tabs over a WebSocket at /ws. Every tab gets
// a full snapshot when it connects and again after every change.

import type { Server } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import type { ServerMessage } from '../shared/protocol.ts';
import * as store from './store.ts';

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

const wss = new WebSocketServer({ noServer: true });

export function connectedTabCount() {
  return wss.clients.size;
}

export function attachLiveUpdates(httpServer: Server) {
  httpServer.on('upgrade', (req, socket, head) => {
    const { pathname } = new URL(req.url ?? '/', 'http://localhost');
    // Leave other upgrades alone: Vite's hot-reload socket shares this server.
    if (pathname !== '/ws') return;

    // WebSockets aren't covered by CORS, so refuse pages from other sites.
    if (!isLocalOrigin(req.headers.origin)) {
      socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      ws.send(snapshot());
    });
  });

  store.subscribe(() => {
    const message = snapshot();
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(message);
    }
  });
}

function snapshot() {
  const message: ServerMessage = {
    type: 'project',
    version: store.getVersion(),
    project: store.getProject(),
  };
  return JSON.stringify(message);
}

function isLocalOrigin(origin: string | undefined) {
  if (!origin) return true; // non-browser clients don't send one
  try {
    return LOCAL_HOSTNAMES.has(new URL(origin).hostname);
  } catch {
    return false;
  }
}
