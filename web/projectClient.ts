// Keeps this tab in sync with the server over the /ws WebSocket: receives the
// project and transport commands, and reports this tab's audio status.
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

export type TransportCommand = Extract<ServerMessage, { type: 'transport' }>;

let snapshot: ProjectSnapshot = { status: 'connecting' };
const listeners = new Set<() => void>();
const commandListeners = new Set<(command: TransportCommand) => void>();
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

/** Subscribes to play/stop commands from the server. Opens the connection if needed. */
export function onCommand(listener: (command: TransportCommand) => void) {
  commandListeners.add(listener);
  if (!socket) connect();
  return () => {
    commandListeners.delete(listener);
  };
}

/** Tells the server what this tab's audio is doing. Re-sent after reconnecting. */
export function reportStatus(status: { audio: AudioStatus; transport: TransportState }) {
  lastStatus = { type: 'status', ...status };
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(lastStatus));
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
    switch (message.type) {
      case 'project':
        update({ project: message.project, previous: snapshot.project });
        break;
      case 'transport':
        for (const listener of commandListeners) listener(message);
        break;
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
