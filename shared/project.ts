// The project data model, shared by the server and the web UI.

export type Instrument = 'basic-synth';

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
  instrument: Instrument;
  clips: Clip[];
};

export type Project = {
  name: string;
  tempo: number;
  timeSignature: [number, number];
  tracks: Track[];
};
