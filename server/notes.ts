import { midiFromPitch, normalizePitch } from '../shared/pitch.ts';
import type { Note } from '../shared/project.ts';

/** A note as an agent writes it: pitch may be a name or a MIDI number. */
export type NoteInput = {
  pitch: string | number;
  bar: number;
  beat: number;
  lengthBeats: number;
  velocity: number;
};

/** Beyond this many problems, the rest are summarised in one line. */
const MAX_PROBLEMS = 5;

/**
 * Checks and tidies notes for a clip. Collects every problem (up to a limit)
 * rather than stopping at the first, so the agent can fix them all in one retry.
 * Range checks the schema already covers (bar ≥ 1, velocity 0–1…) aren't repeated.
 */
export function checkNotes(inputs: NoteInput[], beatsInBar: number): { notes: Note[]; problems: string[] } {
  const notes: Note[] = [];
  const problems: string[] = [];

  inputs.forEach((input, index) => {
    const where = `notes[${index}] (${JSON.stringify(input.pitch)} at bar ${input.bar}, beat ${input.beat})`;
    const pitch = normalizePitch(input.pitch);
    const beatFits = input.beat < beatsInBar + 1;

    if (pitch === undefined) {
      problems.push(`${where}: ${describePitchProblem(input.pitch)}`);
    }
    if (!beatFits) {
      problems.push(
        `${where}: beat ${input.beat} is past the end of the bar. With ${beatsInBar} beats in a bar, beats run from 1 to just under ${beatsInBar + 1}; for the first beat of the next bar, use bar ${input.bar + 1}, beat 1.`,
      );
    }
    if (pitch !== undefined && beatFits) {
      notes.push({ pitch, bar: input.bar, beat: input.beat, lengthBeats: input.lengthBeats, velocity: input.velocity });
    }
  });

  notes.sort((a, b) => a.bar - b.bar || a.beat - b.beat || midiFromPitch(a.pitch)! - midiFromPitch(b.pitch)!);

  if (problems.length > MAX_PROBLEMS) {
    const extra = problems.length - MAX_PROBLEMS;
    problems.splice(MAX_PROBLEMS, extra, `…and ${extra} more like these.`);
  }

  return { notes, problems };
}

function describePitchProblem(pitch: string | number) {
  const trimmed = typeof pitch === 'string' ? pitch.trim() : '';
  if (/^[A-Ga-g][#b♯♭]?$/.test(trimmed)) {
    const name = trimmed[0].toUpperCase() + trimmed.slice(1);
    return `"${pitch}" is missing an octave number, e.g. "${name}3" or "${name}4" (middle C is "C4").`;
  }
  return `${JSON.stringify(pitch)} isn't a pitch. Use a note name like "C4", "F#3" or "Bb2", or a MIDI number from 0 to 127.`;
}
