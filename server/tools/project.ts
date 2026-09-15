import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod';
import { plural } from '../../shared/format.ts';
import { describeProject } from '../describe.ts';
import * as store from '../store.ts';
import { run, text } from './results.ts';

export function registerProjectTools(server: McpServer) {
  server.registerTool(
    'get_project',
    {
      title: 'Get project overview',
      description:
        "Start here. Short overview of the project: tempo, time signature, the browser UI (open? audio enabled? playing?), and each track with its clips. Use get_clip to see a clip's notes.",
      annotations: { readOnlyHint: true },
    },
    async () => text(describeProject(store.getProject())),
  );

  server.registerTool(
    'set_tempo',
    {
      title: 'Set tempo',
      description: `Set the project tempo in BPM (${store.TEMPO_RANGE.min}–${store.TEMPO_RANGE.max}, decimals allowed). Takes effect immediately, even while playing.`,
      inputSchema: z.object({
        bpm: z.number().describe('Beats per minute, e.g. 120 or 92.5'),
      }),
      annotations: { idempotentHint: true },
    },
    async ({ bpm }) =>
      run(() => {
        const { previous } = store.setTempo(bpm);
        return `Tempo set to ${bpm} BPM (was ${previous}).`;
      }),
  );

  server.registerTool(
    'add_tracks',
    {
      title: 'Add tracks',
      description: `Add one or more empty tracks to the end of the track list. Track names must be unique; if any name is taken, no tracks are added. Instruments: ${store.INSTRUMENTS.join(', ')}.`,
      inputSchema: z.object({
        tracks: z
          .array(
            z.object({
              name: z.string().trim().min(1).max(40).describe('Unique track name, e.g. "Bass"'),
              instrument: z.enum(store.INSTRUMENTS).default('basic-synth'),
            }),
          )
          .min(1),
      }),
    },
    async ({ tracks }) =>
      run(() => {
        const added = store.addTracks(tracks);
        const list = added.map((t) => `${t.name} [${t.id}]`).join(', ');
        return `Added ${plural(added.length, 'track')}: ${list}. Tracks now: ${store.trackNames()}.`;
      }),
  );
}
