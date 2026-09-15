import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod';
import { plural } from '../../shared/format.ts';
import { songLengthBars } from '../../shared/timing.ts';
import { clipSummary, noteTable } from '../describe.ts';
import * as store from '../store.ts';
import { run } from './results.ts';

const noteSchema = z.object({
  pitch: z
    .union([z.string(), z.number()])
    .describe('Note name like "C4" (middle C), "F#3" or "Bb2", or a MIDI number 0–127'),
  bar: z.number().int().min(1).describe('Bar within the clip, counting from 1'),
  beat: z
    .number()
    .min(1)
    .describe('Beat within the bar, counting from 1. Fractions for off-beats: 1.5 is the "and" of beat 1'),
  lengthBeats: z.number().positive().default(1).describe('How long the note lasts, in beats. Default 1'),
  velocity: z.number().min(0).max(1).default(0.8).describe('How hard the note is played, 0–1. Default 0.8'),
});

export function registerClipTools(server: McpServer) {
  server.registerTool(
    'write_clip',
    {
      title: 'Write clip',
      description:
        "Create or replace a clip: a block of bars on a track, holding notes. Writing to an existing clip name replaces all of its notes. Note bars and beats count from the clip's start, so bar 1, beat 1 is the clip's first beat. Clips on one track can't overlap. Heard straight away if playing.",
      inputSchema: z.object({
        track: z.string().describe('Track name, e.g. "Bass"'),
        clip: z.string().trim().min(1).max(40).describe('Clip name, unique on its track, e.g. "Verse riff"'),
        startBar: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe(
            "Song bar where the clip starts. Omit to keep an existing clip where it is, or to put a new clip after the track's last clip",
          ),
        lengthBars: z.number().int().min(1).max(256).optional().describe('Clip length in bars. Omit to fit the notes'),
        notes: z.array(noteSchema).max(2000).describe('Every note in the clip, in any order'),
      }),
      annotations: { idempotentHint: true },
    },
    async (args) =>
      run(() => {
        const { track, clip, previousNoteCount } = store.writeClip(args);
        const verb = previousNoteCount === undefined ? 'Created' : 'Replaced';
        const songBars = songLengthBars(store.getProject());
        return `${verb} clip "${clip.name}" [${clip.id}] on ${track.name}: ${clipSummary(clip, previousNoteCount)}. Song length: ${plural(songBars, 'bar')}.`;
      }),
  );

  server.registerTool(
    'get_clip',
    {
      title: 'Get clip notes',
      description: 'List every note in a clip, one per line, using the same fields write_clip takes.',
      inputSchema: z.object({
        track: z.string().describe('Track name, e.g. "Bass"'),
        clip: z.string().describe('Clip name, e.g. "Verse riff"'),
      }),
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      run(() => {
        const { track, clip } = store.findClip(args.track, args.clip);
        const [beats, unit] = store.getProject().timeSignature;
        return [
          `Clip "${clip.name}" [${clip.id}] on ${track.name}: ${clipSummary(clip)}. Time ${beats}/${unit}; bars and beats count from the clip's start.`,
          '',
          clip.notes.length > 0 ? noteTable(clip.notes) : '(no notes)',
        ].join('\n');
      }),
  );
}
