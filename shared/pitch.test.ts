import { describe, expect, it } from 'vitest';
import { midiFromPitch, normalizePitch, pitchFromMidi } from './pitch.ts';

describe('midiFromPitch', () => {
  it('reads note names in scientific pitch notation', () => {
    expect(midiFromPitch('C4')).toBe(60);
    expect(midiFromPitch('A4')).toBe(69);
    expect(midiFromPitch('F#3')).toBe(54);
    expect(midiFromPitch('Bb2')).toBe(46);
    expect(midiFromPitch('C-1')).toBe(0);
  });

  it('rejects things that are not pitches', () => {
    for (const pitch of ['H4', 'C', '4', 'BB3', 'C#', 'middle C']) {
      expect(midiFromPitch(pitch), pitch).toBeUndefined();
    }
  });
});

describe('pitchFromMidi', () => {
  it('names notes with sharps', () => {
    expect(pitchFromMidi(60)).toBe('C4');
    expect(pitchFromMidi(61)).toBe('C#4');
    expect(pitchFromMidi(0)).toBe('C-1');
  });
});

describe('normalizePitch', () => {
  it('forgives harmless variations', () => {
    expect(normalizePitch('c#4')).toBe('C#4');
    expect(normalizePitch(' E2 ')).toBe('E2');
    expect(normalizePitch('C♯4')).toBe('C#4');
    expect(normalizePitch('B♭3')).toBe('Bb3');
    expect(normalizePitch(60)).toBe('C4');
  });

  it('rejects anything outside MIDI range or not a pitch', () => {
    for (const input of [128, -1, 60.5, 'G#9', 'H4']) {
      expect(normalizePitch(input), String(input)).toBeUndefined();
    }
  });
});
