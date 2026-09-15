import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod';
import { plural } from '../../shared/format.ts';
import { describeHistory } from '../describe.ts';
import * as store from '../store.ts';
import { run } from './results.ts';

const stepsSchema = (description: string) =>
  z.object({ steps: z.number().int().min(1).max(100).default(1).describe(description) });

export function registerHistoryTools(server: McpServer) {
  server.registerTool(
    'undo',
    {
      title: 'Undo',
      description:
        'Undo recent changes to the project (tempo, tracks, clips), newest first. Changes can be undone back to when the server last started. Returns what was undone and what can still be undone or redone.',
      inputSchema: stepsSchema('How many changes to undo, newest first. Default 1'),
    },
    async ({ steps }) =>
      run(() => {
        const labels = store.undo(steps);
        if (labels.length === 0) return `Nothing to undo. ${describeHistory()}`;
        const allOfThem = labels.length < steps ? ' That was everything there was to undo.' : '';
        return `Undid ${plural(labels.length, 'change')}: ${labels.join('; ')}.${allOfThem} ${describeHistory()}`;
      }),
  );

  server.registerTool(
    'redo',
    {
      title: 'Redo',
      description:
        'Redo changes that were just undone, oldest first. Making any new change clears what can be redone. Returns what was redone.',
      inputSchema: stepsSchema('How many undone changes to redo, in the order they were made. Default 1'),
    },
    async ({ steps }) =>
      run(() => {
        const labels = store.redo(steps);
        if (labels.length === 0) return `Nothing to redo. ${describeHistory()}`;
        const allOfThem = labels.length < steps ? ' That was everything there was to redo.' : '';
        return `Redid ${plural(labels.length, 'change')}: ${labels.join('; ')}.${allOfThem} ${describeHistory()}`;
      }),
  );
}
