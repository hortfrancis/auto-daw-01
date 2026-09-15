// Turns the project into timed note events. Pure functions with no Web Audio,
// so the timing can be unit-tested, and the same code can drive both live
// playback and (from spike 6) offline rendering.

import { frequencyFromMidi, midiFromPitch } from '../../shared/pitch.ts';
import type { Instrument, Project } from '../../shared/project.ts';
import { beatsPerBar, noteStartBeat, secondsPerBeat, songLengthBars } from '../../shared/timing.ts';

/** One note, ready for an instrument to play. Times are AudioContext seconds. */
export type NoteEvent = {
  trackId: string;
  instrument: Instrument;
  frequency: number;
  velocity: number;
  time: number;
  duration: number;
};

/**
 * How far ahead of the audio clock live playback schedules notes. Long enough
 * to survive a late timer, short enough that edits are heard almost at once.
 */
export const LOOKAHEAD_SECONDS = 0.1;

/**
 * Notes starting in the beat range [fromBeat, toBeat), timed so that
 * `fromBeat` falls at `startTime` seconds. Beat 0 is the start of bar 1.
 */
export function notesInRange(project: Project, fromBeat: number, toBeat: number, startTime: number): NoteEvent[] {
  const beatsInBar = beatsPerBar(project);
  const beatSeconds = secondsPerBeat(project);
  const events: NoteEvent[] = [];

  for (const track of project.tracks) {
    for (const clip of track.clips) {
      for (const note of clip.notes) {
        const beat = noteStartBeat(clip, note, beatsInBar);
        if (beat < fromBeat || beat >= toBeat) continue;
        const midi = midiFromPitch(note.pitch);
        if (midi === undefined) continue;
        events.push({
          trackId: track.id,
          instrument: track.instrument,
          frequency: frequencyFromMidi(midi),
          velocity: note.velocity,
          time: startTime + (beat - fromBeat) * beatSeconds,
          duration: note.lengthBeats * beatSeconds,
        });
      }
    }
  }

  return events.sort((a, b) => a.time - b.time);
}

/**
 * The live playback position, looping the whole song from bar 1. Each call to
 * `advance` returns the notes due before `now + lookahead` that haven't been
 * returned yet. The project is read on every call, so tempo and note changes
 * apply from the next beat not yet scheduled.
 */
export function createPlaybackCursor(startTime: number) {
  let beat = 0; // the next beat not yet scheduled
  let time = startTime; // when that beat plays

  return {
    advance(project: Project, now: number, lookahead = LOOKAHEAD_SECONDS): NoteEvent[] {
      const loopEndBeat = songLengthBars(project) * beatsPerBar(project);
      if (loopEndBeat <= 0) return [];
      if (beat >= loopEndBeat) beat = 0; // the song got shorter while playing

      const beatSeconds = secondsPerBeat(project);
      const horizon = now + lookahead;
      const events: NoteEvent[] = [];

      // Every pass either reaches the horizon exactly or wraps at the loop end,
      // so floating-point rounding can never leave it spinning in place.
      while (time < horizon) {
        const horizonBeat = beat + (horizon - time) / beatSeconds;
        if (horizonBeat < loopEndBeat) {
          events.push(...notesInRange(project, beat, horizonBeat, time));
          beat = horizonBeat;
          time = horizon;
        } else {
          events.push(...notesInRange(project, beat, loopEndBeat, time));
          time += (loopEndBeat - beat) * beatSeconds;
          beat = 0;
        }
      }

      return events;
    },
  };
}
