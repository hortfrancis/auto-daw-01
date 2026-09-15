import type { NoteEvent } from './scheduler.ts';

const PEAK_GAIN = 0.25; // leaves headroom when several notes overlap
const ATTACK_SECONDS = 0.005;
const DECAY_SECONDS = 0.15;
const SUSTAIN_LEVEL = 0.6;
const RELEASE_SECONDS = 0.12;

/** The "basic-synth" instrument: a sawtooth through a low-pass filter, with an ADSR envelope. */
export function playBasicSynthNote(context: BaseAudioContext, destination: AudioNode, note: NoteEvent) {
  const { time, duration, frequency, velocity } = note;
  const peak = PEAK_GAIN * velocity;
  const releaseAt = Math.max(time + duration, time + ATTACK_SECONDS);

  const oscillator = new OscillatorNode(context, { type: 'sawtooth', frequency });
  const filter = new BiquadFilterNode(context, { type: 'lowpass', frequency: 2400, Q: 0.7 });
  const envelope = new GainNode(context, { gain: 0 });

  // The release fades over 9 time constants (to about -96 dB), then the gain is
  // set to exactly 0 and the oscillator stops, all at scheduled audio times.
  const silentAt = releaseAt + RELEASE_SECONDS * 3;
  envelope.gain.setValueAtTime(0, time);
  envelope.gain.linearRampToValueAtTime(peak, time + ATTACK_SECONDS);
  envelope.gain.setTargetAtTime(peak * SUSTAIN_LEVEL, time + ATTACK_SECONDS, DECAY_SECONDS / 3);
  envelope.gain.setTargetAtTime(0, releaseAt, RELEASE_SECONDS / 3);
  envelope.gain.setValueAtTime(0, silentAt);

  oscillator.connect(filter).connect(envelope).connect(destination);
  oscillator.start(time);
  oscillator.stop(silentAt);
  // No disconnect() needed when the note ends: the browser cleans up finished nodes.
}
