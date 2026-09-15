import type { Project } from './project.ts';

/** Browsers keep audio locked until the user clicks something on the page. */
export type AudioStatus = 'locked' | 'ready';
export type TransportState = 'stopped' | 'playing';

/** Messages the server sends to browser tabs over the /ws WebSocket. */
export type ServerMessage =
  | { type: 'project'; version: number; project: Project }
  | { type: 'transport'; action: 'play' | 'stop' }
  /** Render this exact project offline, then POST the WAV to /api/renders/:id. */
  | { type: 'render'; id: string; project: Project; sampleRate: number };

/** Messages browser tabs send to the server, so MCP tools can tell the agent what the tab is doing. */
export type ClientMessage =
  | { type: 'status'; audio: AudioStatus; transport: TransportState }
  /** Sent as soon as a tab receives a render job, so a tab that can't render is caught quickly. */
  | { type: 'render-started'; id: string }
  | { type: 'render-failed'; id: string; message: string };
