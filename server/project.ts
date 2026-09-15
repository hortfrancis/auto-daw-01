// A hard-coded project for spike 2. Real, editable state arrives in spike 3.

export type Note = {
  pitch: string; // scientific pitch notation, e.g. "C4"
  bar: number; // 1-based
  beat: number; // 1-based, fractional for off-beats
  lengthBeats: number;
  velocity: number; // 0–1
};

export type Clip = {
  id: string;
  startBar: number;
  lengthBars: number;
  notes: Note[];
};

export type Track = {
  id: string;
  name: string;
  instrument: string;
  clips: Clip[];
};

export type Project = {
  name: string;
  tempo: number;
  timeSignature: [number, number];
  tracks: Track[];
};

export const demoProject: Project = {
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
