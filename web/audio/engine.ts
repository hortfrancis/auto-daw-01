// The audio engine. A plain module, not React (see "The audio engine is
// separate from the UI" in docs/architecture.md): it follows the project via
// projectClient, takes transport commands from the server, and reports its
// status back so MCP tools can tell the agent what's happening.

import type { AudioStatus, TransportState } from '../../shared/protocol.ts';
import * as projectClient from '../projectClient.ts';
import { playBasicSynthNote } from './basicSynth.ts';
import { createPlaybackCursor, type NoteEvent } from './scheduler.ts';

export type EngineSnapshot = { audio: AudioStatus; transport: TransportState };

/** How often the scheduler wakes up. Must be well under LOOKAHEAD_SECONDS. */
const TICK_MS = 25;
/** A small delay before the first note, so it isn't scheduled in the past. */
const START_DELAY_SECONDS = 0.05;
const MASTER_GAIN = 0.8;

let snapshot: EngineSnapshot = { audio: 'locked', transport: 'stopped' };
const listeners = new Set<() => void>();

let context: AudioContext | undefined;
let master: GainNode | undefined;
let analyser: AnalyserNode | undefined;
let playback: { bus: GainNode; timer: ReturnType<typeof setInterval> } | undefined;

export function getSnapshot() {
  return snapshot;
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Call from a click handler: browsers keep audio locked until the user interacts. */
export async function enableAudio() {
  if (!context) {
    context = new AudioContext({ latencyHint: 'interactive' });
    master = new GainNode(context, { gain: MASTER_GAIN });
    analyser = new AnalyserNode(context, { fftSize: 1024 });
    master.connect(analyser).connect(context.destination);
    context.addEventListener('statechange', () => {
      if (context?.state !== 'running') stop();
      update({ audio: context?.state === 'running' ? 'ready' : 'locked' });
    });
  }
  await context.resume();
  update({ audio: context.state === 'running' ? 'ready' : 'locked' });
}

/** Plays the song from bar 1, looping. Restarts if already playing. */
export function play() {
  if (!context || !master || snapshot.audio !== 'ready') return;
  stopPlayback();

  const audioContext = context;
  const bus = new GainNode(audioContext);
  bus.connect(master);
  const cursor = createPlaybackCursor(audioContext.currentTime + START_DELAY_SECONDS);

  const tick = () => {
    const { project } = projectClient.getSnapshot();
    if (!project) return;
    for (const note of cursor.advance(project, audioContext.currentTime)) playNote(audioContext, bus, note);
  };
  tick();

  playback = { bus, timer: setInterval(tick, TICK_MS) };
  update({ transport: 'playing' });
}

export function stop() {
  stopPlayback();
  update({ transport: 'stopped' });
}

/** The loudest sample over the last ~20ms, from 0 to 1. For level meters. */
export function outputPeak() {
  if (!analyser) return 0;
  const samples = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(samples);
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  return peak;
}

function playNote(audioContext: BaseAudioContext, destination: AudioNode, note: NoteEvent) {
  switch (note.instrument) {
    case 'basic-synth':
      playBasicSynthNote(audioContext, destination, note);
      break;
  }
}

function stopPlayback() {
  if (!playback || !context) return;
  clearInterval(playback.timer);
  // Notes already scheduled on this bus play into silence: fade it out
  // quickly (avoiding a click), then cut it off.
  const { bus } = playback;
  bus.gain.setTargetAtTime(0, context.currentTime, 0.01);
  setTimeout(() => bus.disconnect(), 100);
  playback = undefined;
}

function update(changes: Partial<EngineSnapshot>) {
  const next = { ...snapshot, ...changes };
  if (next.audio === snapshot.audio && next.transport === snapshot.transport) return;
  snapshot = next;
  for (const listener of listeners) listener();
  projectClient.reportStatus(snapshot);
}

projectClient.onCommand((command) => {
  if (command.action === 'play') play();
  else stop();
});

// When Vite hot-reloads this module, silence the old engine.
import.meta.hot?.dispose(() => {
  stopPlayback();
  void context?.close();
});
