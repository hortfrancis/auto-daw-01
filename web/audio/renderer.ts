// Offline rendering: the same scheduler, instruments and master bus as live
// playback, run as fast as possible into a buffer instead of to the speakers.
// Browsers allow this without a click, so audio doesn't need to be enabled.

import type { Project } from '../../shared/project.ts';
import { beatsPerBar, secondsPerBeat, songLengthBars } from '../../shared/timing.ts';
import * as projectClient from '../projectClient.ts';
import { createMasterBus, playNote } from './graph.ts';
import { notesInRange } from './scheduler.ts';
import { encodeWav } from './wav.ts';

/** Renders the whole song, from bar 1 to the end of its last clip, in stereo. */
export async function renderSong(project: Project, sampleRate: number): Promise<AudioBuffer> {
  const songBeats = songLengthBars(project) * beatsPerBar(project);
  const length = Math.max(1, Math.ceil(songBeats * secondsPerBeat(project) * sampleRate));
  const context = new OfflineAudioContext({ numberOfChannels: 2, length, sampleRate });
  const master = createMasterBus(context, context.destination);
  for (const note of notesInRange(project, 0, songBeats, 0)) playNote(context, master, note);
  return context.startRendering();
}

const unsubscribe = projectClient.onServerEvent(async (event) => {
  if (event.type !== 'render') return;
  projectClient.send({ type: 'render-started', id: event.id });
  try {
    const buffer = await renderSong(event.project, event.sampleRate);
    const wav = encodeWav([buffer.getChannelData(0), buffer.getChannelData(1)], buffer.sampleRate);
    const response = await fetch(`/api/renders/${event.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'audio/wav' },
      body: wav,
    });
    if (!response.ok) throw new Error(`uploading the WAV failed with HTTP ${response.status}`);
  } catch (err) {
    projectClient.send({ type: 'render-failed', id: event.id, message: (err as Error).message });
  }
});

import.meta.hot?.dispose(unsubscribe);
