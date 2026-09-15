// The project state: the single source of truth. MCP tools (and later the UI)
// change it only through the commands below, which notify subscribers.
// In memory for now; saving to disk arrives in spike 8.

import type { Instrument, Project, Track } from '../shared/project.ts';

export const INSTRUMENTS = ['basic-synth'] as const satisfies readonly Instrument[];
export const TEMPO_RANGE = { min: 20, max: 400 } as const;

/**
 * A problem with the caller's request. The message goes straight back to the
 * agent, so it must say what was wrong and how to fix it.
 */
export class CommandError extends Error {}

let project: Project = createDemoProject();
let version = 1;
const listeners = new Set<() => void>();

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

function changed() {
  version++;
  for (const listener of listeners) listener();
}

export function setTempo(bpm: number) {
  if (!(bpm >= TEMPO_RANGE.min && bpm <= TEMPO_RANGE.max)) {
    throw new CommandError(
      `Tempo ${bpm} BPM is out of range. Use ${TEMPO_RANGE.min}–${TEMPO_RANGE.max} BPM.`,
    );
  }
  const previous = project.tempo;
  project.tempo = bpm;
  changed();
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

  let nextId = Math.max(0, ...project.tracks.map((t) => Number(t.id.replace('track-', '')) || 0)) + 1;
  const added = specs.map(({ name, instrument }) => ({
    id: `track-${nextId++}`,
    name,
    instrument,
    clips: [],
  }));
  project.tracks.push(...added);
  changed();
  return added;
}

export function trackNames() {
  return project.tracks.map((t) => t.name).join(', ') || '(none)';
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
