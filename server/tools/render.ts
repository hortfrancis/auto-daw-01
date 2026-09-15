import path from 'node:path';
import type { McpServer } from '@modelcontextprotocol/server';
import { plural } from '../../shared/format.ts';
import { beatsPerBar, noteCount, secondsPerBeat, songLengthBars } from '../../shared/timing.ts';
import { CommandError } from '../errors.ts';
import { renderInTab } from '../renders.ts';
import * as store from '../store.ts';
import { run } from './results.ts';

/** Rendering runs faster than real time; this allows for a slow machine. */
const BASE_TIMEOUT_MS = 30_000;

export function registerRenderTools(server: McpServer) {
  server.registerTool(
    'render',
    {
      title: 'Render song',
      description:
        "Render the whole song to a WAV file, using the same audio engine the user hears. Runs in the user's browser tab, which must be open (audio doesn't need to be enabled). Returns where the file was saved.",
    },
    async () =>
      run(async () => {
        const project = structuredClone(store.getProject());
        if (noteCount(project) === 0) {
          throw new CommandError('Nothing rendered: the project has no notes yet. Add some with write_clip.');
        }

        const bars = songLengthBars(project);
        const seconds = bars * beatsPerBar(project) * secondsPerBeat(project);
        const { file, bytes, sampleRate } = await renderInTab(project, BASE_TIMEOUT_MS + seconds * 1000);

        return `Rendered the whole song, ${plural(bars, 'bar')} at ${project.tempo} BPM (${seconds.toFixed(1)} s, ${sampleRate / 1000} kHz stereo WAV), to ${displayPath(file)} (${(bytes / 1_000_000).toFixed(1)} MB).`;
      }),
  );
}

/** A path relative to where the server runs when the file is inside it, otherwise absolute. */
function displayPath(file: string) {
  const relative = path.relative(process.cwd(), file);
  return relative.startsWith('..') || path.isAbsolute(relative) ? file : relative;
}
