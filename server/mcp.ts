import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod';
import { plural } from '../shared/format.ts';
import { midiFromPitch } from '../shared/pitch.ts';
import type { Clip, Project } from '../shared/project.ts';
import { noteCount, songLengthBars } from '../shared/timing.ts';
import { UI_URL } from './config.ts';
import { CommandError } from './errors.ts';
import { sendTransport, tabStatuses, waitForTabs } from './live.ts';
import * as store from './store.ts';

// Tool design follows docs/agentic-usability.md: self-evident descriptions,
// short text results, and errors that say how to fix the problem.

/** How long to wait for a browser tab to confirm a transport command. */
const TAB_CONFIRM_MS = 2000;

// Called once per MCP request: the HTTP handler is stateless, so each request
// gets a fresh McpServer. State lives in store.ts and live.ts.
export function createMcpServer() {
  const server = new McpServer({ name: 'auto-daw', version: '0.0.0' });

  server.registerTool(
    'get_project',
    {
      title: 'Get project overview',
      description:
        'Start here. Short overview of the project: tempo, time signature, the browser UI (open? audio enabled? playing?), and each track with its clips.',
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

  server.registerTool(
    'play',
    {
      title: 'Play',
      description:
        "Play the song in the user's browser tab, from bar 1, looping. Restarts if already playing. Only the user hears it. Edits made while playing are heard straight away. If the tab can't play yet, the result says what the user needs to do.",
    },
    async () =>
      run(async () => {
        const project = store.getProject();
        const tabs = tabStatuses();
        if (tabs.length === 0) {
          throw new CommandError(
            `Nothing played: the browser UI isn't open. Ask the user to open ${UI_URL} and click "Enable audio".`,
          );
        }
        if (!tabs.some((tab) => tab.audio === 'ready')) {
          throw new CommandError(
            'Nothing played: audio isn\'t enabled in the browser tab yet (browsers need a click before they make sound). Ask the user to click "Enable audio" in the Auto DAW tab, then try again.',
          );
        }
        if (noteCount(project) === 0) {
          throw new CommandError('Nothing played: the project has no notes yet.');
        }

        sendTransport('play');
        const started = await waitForTabs((all) => all.some((tab) => tab.transport === 'playing'), TAB_CONFIRM_MS);
        if (!started) {
          throw new CommandError(
            'The browser tab didn\'t confirm playback within 2 seconds. Check get_project to see whether the tab is still open.',
          );
        }
        const playing = tabStatuses().filter((tab) => tab.transport === 'playing').length;
        return `Playing from bar 1 at ${project.tempo} BPM, looping the ${plural(songLengthBars(project), 'bar')} of the song, in ${plural(playing, 'tab')}.`;
      }),
  );

  server.registerTool(
    'stop',
    {
      title: 'Stop',
      description: "Stop playback in the user's browser tab. Safe to call when nothing is playing.",
      annotations: { idempotentHint: true },
    },
    async () =>
      run(async () => {
        if (!tabStatuses().some((tab) => tab.transport === 'playing')) return 'Already stopped.';
        sendTransport('stop');
        const stopped = await waitForTabs((all) => all.every((tab) => tab.transport === 'stopped'), TAB_CONFIRM_MS);
        if (!stopped) {
          throw new CommandError(
            'The browser tab didn\'t confirm it stopped within 2 seconds. Check get_project to see its state.',
          );
        }
        return 'Stopped.';
      }),
  );

  return server;
}

function text(message: string) {
  return { content: [{ type: 'text' as const, text: message }] };
}

/** Runs a command, turning a CommandError into a tool error the agent can act on. */
async function run(command: () => string | Promise<string>) {
  try {
    return text(await command());
  } catch (err) {
    if (err instanceof CommandError) return { ...text(err.message), isError: true };
    throw err;
  }
}

function describeProject(project: Readonly<Project>) {
  const [beats, unit] = project.timeSignature;
  const lines = [
    `Project "${project.name}": ${project.tempo} BPM, ${beats}/${unit}`,
    describeBrowser(),
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

function describeBrowser() {
  const tabs = tabStatuses();
  if (tabs.length === 0) {
    return `Browser UI: not open, so the user can't see or hear anything. They can open ${UI_URL}`;
  }
  const open = `Browser UI: open in ${plural(tabs.length, 'tab')}`;
  if (!tabs.some((tab) => tab.audio === 'ready')) {
    return `${open}, audio not enabled yet (the user must click "Enable audio" before anything can play)`;
  }
  const playing = tabs.some((tab) => tab.transport === 'playing');
  return `${open}, audio enabled, ${playing ? 'playing' : 'stopped'}`;
}

function describeClip(clip: Clip) {
  const end = clip.startBar + clip.lengthBars - 1;
  const bars = clip.lengthBars === 1 ? `bar ${clip.startBar}` : `bars ${clip.startBar}–${end}`;
  const pitches = clip.notes.map((n) => n.pitch).sort((a, b) => (midiFromPitch(a) ?? 0) - (midiFromPitch(b) ?? 0));
  const range = pitches.length > 0 ? `, ${pitches[0]}–${pitches.at(-1)}` : '';
  return `${clip.id}: ${bars}, ${plural(clip.notes.length, 'note')}${range}`;
}
