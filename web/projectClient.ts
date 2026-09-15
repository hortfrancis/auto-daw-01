// Keeps this tab in sync with the server's project over the /ws WebSocket.
// A plain module rather than a React hook, so the audio engine can follow the
// same state without going through React (see docs/architecture.md).

import type { Project } from '../shared/project.ts';
import type { ServerMessage } from '../shared/protocol.ts';

export type ConnectionStatus = 'connecting' | 'live' | 'disconnected';

export type ProjectSnapshot = {
  status: ConnectionStatus;
  project?: Project;
  /** The project before the latest update, for highlighting what changed. */
  previous?: Project;
};

let snapshot: ProjectSnapshot = { status: 'connecting' };
const listeners = new Set<() => void>();
let socket: WebSocket | undefined;
let retries = 0;
let stopped = false;

export function getSnapshot() {
  return snapshot;
}

/** Subscribes to changes. The first subscriber opens the connection. */
export function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!socket) connect();
  return () => {
    listeners.delete(listener);
  };
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
    update({ status: 'live' });
  });

  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data) as ServerMessage;
    if (message.type === 'project') update({ project: message.project, previous: snapshot.project });
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
