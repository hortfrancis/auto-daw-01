import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { McpServer } from '@modelcontextprotocol/server';
import { plural } from '../../shared/format.ts';
import { beatsPerBar, noteCount, secondsPerBeat, songLengthBars } from '../../shared/timing.ts';
import { analyzeRender } from '../analysis/analyze.ts';
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
      title: 'Render and listen',
      description:
        "Render the whole song and report how it sounds: peak level and any clipping, loudness in LUFS (overall and bar by bar), frequency balance, and a picture (waveform above a spectrogram). Uses the same audio engine the user hears, running in the user's browser tab, which must be open (audio doesn't need to be enabled). Saves the WAV and the picture.",
    },
    async () =>
      run(async () => {
        const project = structuredClone(store.getProject());
        if (noteCount(project) === 0) {
          throw new CommandError('Nothing rendered: the project has no notes yet. Add some with write_clip.');
        }

        const bars = songLengthBars(project);
        const secondsPerBar = beatsPerBar(project) * secondsPerBeat(project);
        const seconds = bars * secondsPerBar;
        const { file, wav, sampleRate } = await renderInTab(project, BASE_TIMEOUT_MS + seconds * 1000);

        const { summary, picture, pictureGuide } = analyzeRender(wav, { bars, secondsPerBar });
        const pictureFile = file.replace(/\.wav$/, '.png');
        await writeFile(pictureFile, picture);

        const rendered = `Rendered the whole song, ${plural(bars, 'bar')} at ${project.tempo} BPM (${seconds.toFixed(1)} s, ${sampleRate / 1000} kHz stereo WAV), to ${displayPath(file)} (${(wav.length / 1_000_000).toFixed(1)} MB).`;
        return [
          { type: 'text', text: `${rendered}\n\n${summary}\n\n${pictureGuide} Also saved as ${displayPath(pictureFile)}.` },
          { type: 'image', data: picture.toString('base64'), mimeType: 'image/png' },
        ];
      }),
  );
}

/** A path relative to where the server runs when the file is inside it, otherwise absolute. */
function displayPath(file: string) {
  const relative = path.relative(process.cwd(), file);
  return relative.startsWith('..') || path.isAbsolute(relative) ? file : relative;
}
