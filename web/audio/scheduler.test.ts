import { describe, expect, it } from 'vitest';
import type { Note, Project } from '../../shared/project.ts';
import { createPlaybackCursor, notesInRange } from './scheduler.ts';

function project(options: { tempo?: number; startBar?: number; lengthBars?: number; notes?: Note[] } = {}): Project {
  return {
    name: 'Test',
    tempo: options.tempo ?? 120,
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
            startBar: options.startBar ?? 1,
            lengthBars: options.lengthBars ?? 1,
            notes: options.notes ?? [
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

/** Calls `advance` like a real timer: every ~25ms, deliberately late by varying amounts. */
function runTimer(cursor: ReturnType<typeof createPlaybackCursor>, getProject: (now: number) => Project, seconds: number) {
  const jitter = [0, 0.004, 0.011, 0.002, 0.019, 0.007];
  const events = [];
  for (let tick = 0; tick * 0.025 < seconds; tick++) {
    const now = tick * 0.025 + jitter[tick % jitter.length];
    events.push(...cursor.advance(getProject(now), now));
  }
  return events;
}

describe('notesInRange', () => {
  it('times each beat at 60/tempo seconds', () => {
    const events = notesInRange(project(), 0, 4, 10);

    expect(events.map((e) => e.time)).toEqual([10, 10.5, 11, 11.5]);
    expect(events.map((e) => e.duration)).toEqual([0.5, 0.5, 0.5, 0.5]);
    expect(events[0].frequency).toBeCloseTo(261.626, 3); // C4
  });

  it('counts note bars from the start of the clip', () => {
    const [event] = notesInRange(project({ startBar: 3 }), 0, 16, 0);

    expect(event.time).toBe(4); // bar 3 starts at beat 8, which is 4s at 120 BPM
  });

  it('includes the start of the range but not the end, so ranges never double up', () => {
    expect(notesInRange(project(), 1, 2, 0)).toHaveLength(1);
    expect(notesInRange(project(), 0.5, 1, 0)).toHaveLength(0);
  });
});

describe('createPlaybackCursor', () => {
  it('schedules every note exactly once, on time, across loops despite a jittery timer', () => {
    const cursor = createPlaybackCursor(0);

    const events = runTimer(cursor, () => project(), 10);

    // The one-bar song loops every 2s: a note every 0.5s, never late, never twice.
    const times = events.map((e) => e.time);
    expect(times.length).toBeGreaterThanOrEqual(20);
    times.forEach((time, i) => expect(time).toBeCloseTo(i * 0.5, 9));
  });

  it('applies a tempo change from the next unscheduled beat', () => {
    const cursor = createPlaybackCursor(0);

    const events = runTimer(cursor, (now) => project({ tempo: now < 1 ? 120 : 60 }), 4);

    const times = events.map((e) => e.time);
    // Beats 0–2 were scheduled at 120 BPM (0, 0.5, 1). Scheduling had reached
    // beat 2.2 at 1.1s when the tempo halved, so beat 3 lands 0.8s later.
    expect(times[0]).toBeCloseTo(0, 9);
    expect(times[1]).toBeCloseTo(0.5, 9);
    expect(times[2]).toBeCloseTo(1, 9);
    expect(times[3]).toBeGreaterThan(1.5);
    expect(times[4] - times[3]).toBeCloseTo(1, 9); // one beat at 60 BPM
  });

  it('returns nothing for a song with no clips, instead of looping forever', () => {
    const empty = { ...project(), tracks: [] };

    expect(createPlaybackCursor(0).advance(empty, 5)).toEqual([]);
  });
});
