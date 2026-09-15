import { describe, expect, it } from 'vitest';
import { checkNotes, type NoteInput } from './notes.ts';

const note = (overrides: Partial<NoteInput>): NoteInput => ({
  pitch: 'C4',
  bar: 1,
  beat: 1,
  lengthBeats: 1,
  velocity: 0.8,
  ...overrides,
});

describe('checkNotes', () => {
  it('tidies pitches and sorts notes by position, then pitch', () => {
    const { notes, problems } = checkNotes(
      [note({ pitch: 'g4', bar: 2 }), note({ pitch: 64, beat: 2.5 }), note({ pitch: 'C4', beat: 2.5 })],
      4,
    );

    expect(problems).toEqual([]);
    expect(notes.map((n) => `${n.bar}.${n.beat} ${n.pitch}`)).toEqual(['1.2.5 C4', '1.2.5 E4', '2.1 G4']);
  });

  it('explains each bad note, naming which one it is', () => {
    const { notes, problems } = checkNotes([note({ pitch: 'H4' }), note({ beat: 5, bar: 2 })], 4);

    expect(notes).toEqual([]);
    expect(problems).toEqual([
      'notes[0] ("H4" at bar 1, beat 1): "H4" isn\'t a pitch. Use a note name like "C4", "F#3" or "Bb2", or a MIDI number from 0 to 127.',
      'notes[1] ("C4" at bar 2, beat 5): beat 5 is past the end of the bar. With 4 beats in a bar, beats run from 1 to just under 5; for the first beat of the next bar, use bar 3, beat 1.',
    ]);
  });

  it('points out a missing octave number, with examples', () => {
    const { problems } = checkNotes([note({ pitch: 'bb' })], 4);

    expect(problems).toEqual([
      'notes[0] ("bb" at bar 1, beat 1): "bb" is missing an octave number, e.g. "Bb3" or "Bb4" (middle C is "C4").',
    ]);
  });

  it('allows off-beats right up to the end of the bar', () => {
    expect(checkNotes([note({ beat: 4.99 })], 4).problems).toEqual([]);
    expect(checkNotes([note({ beat: 3.5 })], 3).problems).toEqual([]);
    expect(checkNotes([note({ beat: 4 })], 3).problems).toHaveLength(1);
  });

  it('reports every problem at once, summarising beyond five', () => {
    const { problems } = checkNotes(Array.from({ length: 8 }, () => note({ pitch: 'X' })), 4);

    expect(problems).toHaveLength(6);
    expect(problems[5]).toBe('…and 3 more like these.');
  });
});
