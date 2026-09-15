import type { Project } from './project.ts';

/** Messages the server sends to browser tabs over the /ws WebSocket. */
export type ServerMessage = {
  type: 'project';
  version: number;
  project: Project;
};
