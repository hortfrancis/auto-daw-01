// Pitches use scientific pitch notation: "C4" is middle C, "A4" is 440 Hz.

const SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** The MIDI note number for a pitch like "C4", "F#3" or "Bb2", or undefined if it isn't one. */
export function midiFromPitch(pitch: string): number | undefined {
  const match = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(pitch.trim());
  if (!match) return undefined;
  const [, letter, accidental, octave] = match;
  const offset = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0;
  return (Number(octave) + 1) * 12 + SEMITONES[letter.toUpperCase()] + offset;
}

export function frequencyFromMidi(midi: number) {
  return 440 * 2 ** ((midi - 69) / 12);
}
