// Pitches use scientific pitch notation: "C4" is middle C (MIDI 60), "A4" is 440 Hz.

const SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
// The accidental is case-sensitive, so "Bb3" is B-flat but "BB3" is rejected.
const PITCH_PATTERN = /^([A-Ga-g])([#b]?)(-?\d+)$/;

function parse(pitch: string) {
  return PITCH_PATTERN.exec(pitch.trim().replace('♯', '#').replace('♭', 'b'));
}

/** The MIDI note number for a pitch like "C4", "F#3" or "Bb2", or undefined if it isn't one. */
export function midiFromPitch(pitch: string): number | undefined {
  const match = parse(pitch);
  if (!match) return undefined;
  const [, letter, accidental, octave] = match;
  const offset = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0;
  return (Number(octave) + 1) * 12 + SEMITONES[letter.toUpperCase()] + offset;
}

/** The name for a MIDI note number, using sharps: 61 is "C#4". */
export function pitchFromMidi(midi: number) {
  return `${SHARP_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

/**
 * Accepts harmless variations ("c#4", " E2 ", "B♭3") or a MIDI number 0–127,
 * and returns a tidy pitch name. Returns undefined for anything else.
 */
export function normalizePitch(input: string | number): string | undefined {
  if (typeof input === 'number') {
    return Number.isInteger(input) && input >= 0 && input <= 127 ? pitchFromMidi(input) : undefined;
  }
  const match = parse(input);
  const midi = midiFromPitch(input);
  if (!match || midi === undefined || midi < 0 || midi > 127) return undefined;
  const [, letter, accidental, octave] = match;
  return `${letter.toUpperCase()}${accidental}${octave}`;
}

export function frequencyFromMidi(midi: number) {
  return 440 * 2 ** ((midi - 69) / 12);
}
