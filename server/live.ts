// The link to browser tabs over a WebSocket at /ws. Tabs get a full project
// snapshot when they connect and after every change, receive commands (play,
// stop, render), and report back their audio status.

import type { Server } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import type { AudioStatus, ClientMessage, ServerMessage, TransportState } from '../shared/protocol.ts';
import * as store from './store.ts';

export type TabStatus = { audio: AudioStatus; transport: TransportState };

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);
const UNREPORTED: TabStatus = { audio: 'locked', transport: 'stopped' };

const wss = new WebSocketServer({ noServer: true });
const statuses = new Map<WebSocket, TabStatus>();
const statusListeners = new Set<() => void>();
const messageListeners = new Set<(message: ClientMessage) => void>();

/** What each open tab last reported. A tab that hasn't reported yet counts as locked. */
export function tabStatuses(): TabStatus[] {
  return [...wss.clients].map((client) => statuses.get(client) ?? UNREPORTED);
}

export function sendTransport(action: 'play' | 'stop') {
  broadcast({ type: 'transport', action });
}

/**
 * Sends a message to one tab, preferring a tab with audio enabled (most likely
 * the one the user is using). Returns false if no tab is open.
 */
export function sendToOneTab(message: ServerMessage) {
  const open = [...wss.clients].filter((client) => client.readyState === WebSocket.OPEN);
  const tab = open.find((client) => statuses.get(client)?.audio === 'ready') ?? open[0];
  if (!tab) return false;
  tab.send(JSON.stringify(message));
  return true;
}

export function onClientMessage(listener: (message: ClientMessage) => void) {
  messageListeners.add(listener);
  return () => messageListeners.delete(listener);
}

/** Resolves true as soon as `condition` holds for the tabs, or false after `timeoutMs`. */
export function waitForTabs(condition: (tabs: TabStatus[]) => boolean, timeoutMs: number) {
  return new Promise<boolean>((resolve) => {
    if (condition(tabStatuses())) return resolve(true);
    const check = () => {
      if (condition(tabStatuses())) finish(true);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    function finish(result: boolean) {
      clearTimeout(timer);
      statusListeners.delete(check);
      resolve(result);
    }
    statusListeners.add(check);
  });
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
      ws.on('message', (data) => {
        const message = parseClientMessage(data.toString());
        if (!message) return;
        if (message.type === 'status') {
          statuses.set(ws, { audio: message.audio, transport: message.transport });
          notifyStatusListeners();
        }
        for (const listener of messageListeners) listener(message);
      });
      ws.on('close', () => {
        statuses.delete(ws);
        notifyStatusListeners();
      });
      ws.send(projectMessage());
    });
  });

  store.subscribe(() => broadcast(projectMessage()));
}

function broadcast(message: ServerMessage | string) {
  const data = typeof message === 'string' ? message : JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(data);
  }
}

function projectMessage() {
  const message: ServerMessage = {
    type: 'project',
    version: store.getVersion(),
    project: store.getProject(),
  };
  return JSON.stringify(message);
}

function notifyStatusListeners() {
  for (const listener of [...statusListeners]) listener();
}

function parseClientMessage(data: string): ClientMessage | undefined {
  try {
    const message = JSON.parse(data);
    if (
      message?.type === 'status' &&
      ['locked', 'ready'].includes(message.audio) &&
      ['stopped', 'playing'].includes(message.transport)
    ) {
      return message;
    }
    if (message?.type === 'render-started' && typeof message.id === 'string') {
      return message;
    }
    if (message?.type === 'render-failed' && typeof message.id === 'string' && typeof message.message === 'string') {
      return message;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function isLocalOrigin(origin: string | undefined) {
  if (!origin) return true; // non-browser clients don't send one
  try {
    return LOCAL_HOSTNAMES.has(new URL(origin).hostname);
  } catch {
    return false;
  }
}
