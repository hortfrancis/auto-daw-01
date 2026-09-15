// The parts of the audio graph shared by live playback and offline rendering.
// Anything that shapes the sound belongs here, so both paths stay identical.

import { playBasicSynthNote } from './basicSynth.ts';
import type { NoteEvent } from './scheduler.ts';

const MASTER_GAIN = 0.8;

/** The master bus every note plays through. */
export function createMasterBus(context: BaseAudioContext, destination: AudioNode) {
  const master = new GainNode(context, { gain: MASTER_GAIN });
  master.connect(destination);
  return master;
}

/** Plays a note on its track's instrument. */
export function playNote(context: BaseAudioContext, destination: AudioNode, note: NoteEvent) {
  switch (note.instrument) {
    case 'basic-synth':
      playBasicSynthNote(context, destination, note);
      break;
  }
}
