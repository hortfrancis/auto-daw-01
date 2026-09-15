// Keeps this tab in sync with the server over the /ws WebSocket: receives the
// project and server events (play, stop, render), and sends messages back.
// A plain module rather than a React hook, so the audio engine can use it
// without going through React (see docs/architecture.md).

import type { Project } from '../shared/project.ts';
import type { AudioStatus, ClientMessage, ServerMessage, TransportState } from '../shared/protocol.ts';

export type ConnectionStatus = 'connecting' | 'live' | 'disconnected';

export type ProjectSnapshot = {
  status: ConnectionStatus;
  project?: Project;
  /** The project before the latest update, for highlighting what changed. */
  previous?: Project;
};

/** Every server message other than project updates. */
export type ServerEvent = Exclude<ServerMessage, { type: 'project' }>;

let snapshot: ProjectSnapshot = { status: 'connecting' };
const listeners = new Set<() => void>();
const eventListeners = new Set<(event: ServerEvent) => void>();
let lastStatus: ClientMessage | undefined;
let socket: WebSocket | undefined;
let retries = 0;
let stopped = false;

export function getSnapshot() {
  return snapshot;
}

/** Subscribes to project and connection changes. Opens the connection if needed. */
export function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!socket) connect();
  return () => {
    listeners.delete(listener);
  };
}

/** Subscribes to server events (play, stop, render). Opens the connection if needed. */
export function onServerEvent(listener: (event: ServerEvent) => void) {
  eventListeners.add(listener);
  if (!socket) connect();
  return () => {
    eventListeners.delete(listener);
  };
}

/** Sends a message to the server, if connected. */
export function send(message: ClientMessage) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

/** Tells the server what this tab's audio is doing. Re-sent after reconnecting. */
export function reportStatus(status: { audio: AudioStatus; transport: TransportState }) {
  lastStatus = { type: 'status', ...status };
  send(lastStatus);
}

function update(changes: Partial<ProjectSnapshot>) {
  snapshot = { ...snapshot, ...changes };
  for (const listener of listeners) listener();
}

function connect() {
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${scheme}://${location.host}/ws`);
  socket = ws;

  ws.addEventListener('open', () => {
    retries = 0;
    if (lastStatus) ws.send(JSON.stringify(lastStatus));
    update({ status: 'live' });
  });

  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data) as ServerMessage;
    if (message.type === 'project') {
      update({ project: message.project, previous: snapshot.project });
    } else {
      for (const listener of eventListeners) listener(message);
    }
  });

  // Also fires when the server restarts: keep retrying, backing off to 5s.
  ws.addEventListener('close', () => {
    if (stopped) return;
    update({ status: 'disconnected' });
    setTimeout(connect, Math.min(5000, 250 * 2 ** retries++));
  });
}

// When Vite hot-reloads this module, close the old connection.
import.meta.hot?.dispose(() => {
  stopped = true;
  socket?.close();
});
