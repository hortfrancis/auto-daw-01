import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod';
import type { Clip, Project } from '../shared/project.ts';
import { UI_URL } from './config.ts';
import { connectedTabCount } from './live.ts';
import * as store from './store.ts';

// Tool design follows docs/agentic-usability.md: self-evident descriptions,
// short text results, and errors that say how to fix the problem.

// Called once per MCP request: the HTTP handler is stateless, so each request
// gets a fresh McpServer. State lives in store.ts.
export function createMcpServer() {
  const server = new McpServer({ name: 'auto-daw', version: '0.0.0' });

  server.registerTool(
    'get_project',
    {
      title: 'Get project overview',
      description:
        'Start here. Short overview of the project: tempo, time signature, whether the user has the browser UI open, and each track with its clips.',
      annotations: { readOnlyHint: true },
    },
    async () => text(describeProject(store.getProject())),
  );

  server.registerTool(
    'set_tempo',
    {
      title: 'Set tempo',
      description: `Set the project tempo in BPM (${store.TEMPO_RANGE.min}–${store.TEMPO_RANGE.max}, decimals allowed).`,
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

  return server;
}

function text(message: string) {
  return { content: [{ type: 'text' as const, text: message }] };
}

/** Runs a command, turning a CommandError into a tool error the agent can act on. */
function run(command: () => string) {
  try {
    return text(command());
  } catch (err) {
    if (err instanceof store.CommandError) return { ...text(err.message), isError: true };
    throw err;
  }
}

function describeProject(project: Readonly<Project>) {
  const [beats, unit] = project.timeSignature;
  const tabs = connectedTabCount();
  const lines = [
    `Project "${project.name}": ${project.tempo} BPM, ${beats}/${unit}`,
    tabs > 0
      ? `Browser UI: open in ${plural(tabs, 'tab')}`
      : `Browser UI: not open, so the user can't see changes. They can open ${UI_URL}`,
    '',
    `Tracks (${project.tracks.length}):`,
  ];
  if (project.tracks.length === 0) lines.push('(none)');
  project.tracks.forEach((track, i) => {
    const clips = track.clips.length === 0 ? 'no clips' : plural(track.clips.length, 'clip');
    lines.push(`${i + 1}. ${track.name} [${track.id}]: ${track.instrument}, ${clips}`);
    for (const clip of track.clips) lines.push(`   - ${describeClip(clip)}`);
  });
  return lines.join('\n');
}

function describeClip(clip: Clip) {
  const end = clip.startBar + clip.lengthBars - 1;
  const bars = clip.lengthBars === 1 ? `bar ${clip.startBar}` : `bars ${clip.startBar}–${end}`;
  const pitches = clip.notes.map((n) => n.pitch).sort((a, b) => midi(a) - midi(b));
  const range = pitches.length > 0 ? `, ${pitches[0]}–${pitches.at(-1)}` : '';
  return `${clip.id}: ${bars}, ${plural(clip.notes.length, 'note')}${range}`;
}

const SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function midi(pitch: string) {
  const match = /^([A-G])([#b]?)(-?\d+)$/i.exec(pitch);
  if (!match) return 0;
  const [, letter, accidental, octave] = match;
  const offset = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0;
  return (Number(octave) + 1) * 12 + SEMITONES[letter.toUpperCase()] + offset;
}

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
