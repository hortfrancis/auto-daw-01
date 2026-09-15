// The project state: the single source of truth. MCP tools (and later the UI)
// change it only through the commands below. Every change is labelled for
// undo, saved to disk, and sent to subscribers.

import { barRange } from '../shared/format.ts';
import type { Clip, Instrument, Project, Track } from '../shared/project.ts';
import { beatsPerBar } from '../shared/timing.ts';
import { PROJECT_FILE } from './config.ts';
import { CommandError } from './errors.ts';
import { createHistory } from './history.ts';
import { checkNotes, type NoteInput } from './notes.ts';
import { loadProject, saveProject } from './persistence.ts';

export const INSTRUMENTS = ['basic-synth'] as const satisfies readonly Instrument[];
export const TEMPO_RANGE = { min: 20, max: 400 } as const;
/**
 * How many changes undo can go back. History is kept in memory (snapshots of
 * a big song would be heavy to save), so it starts empty when the server starts.
 */
const HISTORY_LIMIT = 100;

export type ClipSpec = {
  track: string;
  clip: string;
  startBar?: number;
  lengthBars?: number;
  notes: NoteInput[];
};

const saved = loadProject(PROJECT_FILE);
let project: Project = saved ?? createDemoProject();
/** True if the project was loaded from disk when the server started, false for a new demo project. */
export const startedFromSave = saved !== undefined;
let version = 1;
const listeners = new Set<() => void>();
const history = createHistory<Project>(HISTORY_LIMIT);

export function getProject(): Readonly<Project> {
  return project;
}

export function getVersion() {
  return version;
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function historySummary() {
  return history.summary();
}

/** Undoes up to `steps` changes, newest first. Returns the labels of what was undone. */
export function undo(steps: number) {
  const { state, labels } = history.undo(project, steps);
  if (labels.length > 0) {
    project = state;
    publish();
  }
  return labels;
}

/** Redoes up to `steps` undone changes. Returns the labels of what was redone. */
export function redo(steps: number) {
  const { state, labels } = history.redo(project, steps);
  if (labels.length > 0) {
    project = state;
    publish();
  }
  return labels;
}

export function setTempo(bpm: number) {
  if (!(bpm >= TEMPO_RANGE.min && bpm <= TEMPO_RANGE.max)) {
    throw new CommandError(
      `Tempo ${bpm} BPM is out of range. Use ${TEMPO_RANGE.min}–${TEMPO_RANGE.max} BPM.`,
    );
  }
  const before = structuredClone(project);
  const previous = project.tempo;
  project.tempo = bpm;
  changed(`set tempo to ${bpm} BPM`, before);
  return { previous };
}

/** Adds tracks to the end of the list. All or nothing: one bad name adds none. */
export function addTracks(specs: { name: string; instrument: Instrument }[]): Track[] {
  const existing = new Map(project.tracks.map((t) => [t.name.toLowerCase(), t.name]));
  const inRequest = new Set<string>();
  for (const { name } of specs) {
    const key = name.toLowerCase();
    const taken = existing.get(key);
    if (taken) {
      throw new CommandError(
        `No tracks added: "${name}" clashes with the existing track "${taken}" (names are case-insensitive). Existing tracks: ${trackNames()}.`,
      );
    }
    if (inRequest.has(key)) {
      throw new CommandError(
        `No tracks added: "${name}" appears more than once in this request. Track names must be unique.`,
      );
    }
    inRequest.add(key);
  }

  const before = structuredClone(project);
  let nextId = Math.max(0, ...project.tracks.map((t) => Number(t.id.replace('track-', '')) || 0)) + 1;
  const added = specs.map(({ name, instrument }) => ({
    id: `track-${nextId++}`,
    name,
    instrument,
    clips: [],
  }));
  project.tracks.push(...added);
  changed(`add ${added.length === 1 ? 'track' : 'tracks'} ${added.map((t) => `"${t.name}"`).join(', ')}`, before);
  return added;
}

/**
 * Creates a clip, or replaces the notes (and position, if given) of the clip
 * with that name. Nothing changes unless every note is valid and the clip fits.
 */
export function writeClip(spec: ClipSpec) {
  const track = findTrack(spec.track);
  const existing = matchClip(track, spec.clip);

  const { notes, problems } = checkNotes(spec.notes, beatsPerBar(project));

  // Placement is checked in the same pass as the notes, so one response lists
  // everything to fix (a staged check cost an extra round trip in spike 5).
  const barsNeeded = Math.max(1, ...spec.notes.map((n) => n.bar));
  if (spec.lengthBars !== undefined && spec.lengthBars < barsNeeded) {
    problems.push(
      `The notes reach bar ${barsNeeded} of the clip, but lengthBars is ${spec.lengthBars}. Use lengthBars: ${barsNeeded} or more, or move those notes earlier.`,
    );
  }

  const otherClips = track.clips.filter((c) => c !== existing);
  const afterLastClip = Math.max(1, ...otherClips.map((c) => c.startBar + c.lengthBars));
  const startBar = spec.startBar ?? existing?.startBar ?? afterLastClip;
  const lengthBars = spec.lengthBars ?? Math.max(existing?.lengthBars ?? 1, barsNeeded);

  const clash = otherClips.find((c) => startBar < c.startBar + c.lengthBars && c.startBar < startBar + lengthBars);
  if (clash) {
    problems.push(
      `This clip (${barRange(startBar, lengthBars)}) would overlap clip "${clash.name}" (${barRange(clash.startBar, clash.lengthBars)}) on ${track.name}. Clips on a track can't overlap. Use startBar: ${afterLastClip} (after the last clip), or rewrite "${clash.name}" instead.`,
    );
  }

  if (problems.length > 0) {
    throw new CommandError(`Clip not written. Fix these and try again:\n${problems.map((p) => `- ${p}`).join('\n')}`);
  }

  const before = structuredClone(project);
  const previousNoteCount = existing?.notes.length;
  const clip: Clip = existing ?? { id: nextClipId(), name: spec.clip.trim(), startBar, lengthBars, notes };
  Object.assign(clip, { startBar, lengthBars, notes });
  if (!existing) track.clips.push(clip);
  track.clips.sort((a, b) => a.startBar - b.startBar);

  changed(`${existing ? 'replace' : 'create'} clip "${clip.name}" on ${track.name}`, before);
  return { track, clip, previousNoteCount };
}

/** Finds a track by name (case-insensitive) or id. */
export function findTrack(ref: string): Track {
  const key = ref.trim().toLowerCase();
  const track = project.tracks.find((t) => t.id === key || t.name.toLowerCase() === key);
  if (!track) {
    throw new CommandError(`No track named "${ref}". Tracks: ${trackNames()}. Add a track with add_tracks.`);
  }
  return track;
}

/** Finds a clip on a track by name (case-insensitive) or id. */
export function findClip(trackRef: string, clipRef: string) {
  const track = findTrack(trackRef);
  const clip = matchClip(track, clipRef);
  if (!clip) {
    throw new CommandError(
      track.clips.length === 0
        ? `${track.name} has no clips yet. Create one with write_clip.`
        : `No clip named "${clipRef}" on ${track.name}. Clips on ${track.name}: ${clipList(track)}.`,
    );
  }
  return { track, clip };
}

export function trackNames() {
  return project.tracks.map((t) => t.name).join(', ') || '(none)';
}

/** Records a change for undo, then saves and publishes it. `before` is the project as it was. */
function changed(label: string, before: Project) {
  history.record(label, before);
  publish();
}

function publish() {
  version++;
  saveProject(PROJECT_FILE, project);
  for (const listener of listeners) listener();
}

function matchClip(track: Track, ref: string) {
  const key = ref.trim().toLowerCase();
  return track.clips.find((c) => c.id === key || c.name.toLowerCase() === key);
}

function clipList(track: Track) {
  return track.clips.map((c) => `"${c.name}" (${barRange(c.startBar, c.lengthBars)})`).join(', ');
}

function nextClipId() {
  const ids = project.tracks.flatMap((t) => t.clips.map((c) => Number(c.id.replace('clip-', '')) || 0));
  return `clip-${Math.max(0, ...ids) + 1}`;
}

function createDemoProject(): Project {
  return {
    name: 'Demo',
    tempo: 120,
    timeSignature: [4, 4],
    tracks: [
      {
        id: 'track-1',
        name: 'Lead',
        instrument: 'basic-synth',
        clips: [
          {
            id: 'clip-1',
            name: 'Arpeggio',
            startBar: 1,
            lengthBars: 1,
            notes: [
              { pitch: 'C4', bar: 1, beat: 1, lengthBeats: 1, velocity: 0.8 },
              { pitch: 'E4', bar: 1, beat: 2, lengthBeats: 1, velocity: 0.8 },
              { pitch: 'G4', bar: 1, beat: 3, lengthBeats: 1, velocity: 0.8 },
              { pitch: 'C5', bar: 1, beat: 4, lengthBeats: 1, velocity: 0.8 },
            ],
          },
        ],
      },
    ],
  };
}
