// Render jobs: the server asks a browser tab to render a project offline (the
// only place the audio engine runs), waits for the tab to upload the WAV, and
// saves it to disk.

import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Project } from '../shared/project.ts';
import { RENDER_SAMPLE_RATE, RENDERS_DIR, UI_URL } from './config.ts';
import { CommandError } from './errors.ts';
import { onClientMessage, sendToOneTab } from './live.ts';

/** How long a tab has to confirm it received a render job. */
const START_TIMEOUT_MS = 3000;

type PendingRender = {
  resolve: (wav: Buffer) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  finishTimeoutMs: number;
};

const pending = new Map<string, PendingRender>();

onClientMessage((message) => {
  if (message.type === 'render-started') {
    // The tab is working on it: switch from the short "did it hear us?"
    // timeout to the longer one for finishing the render.
    const job = pending.get(message.id);
    if (!job) return;
    clearTimeout(job.timer);
    job.timer = setTimeout(() => {
      settleWithError(
        message.id,
        new CommandError(
          `The browser tab started rendering but didn't finish within ${Math.round(job.finishTimeoutMs / 1000)} seconds. Check get_project to see whether the tab is still open.`,
        ),
      );
    }, job.finishTimeoutMs);
  }
  if (message.type === 'render-failed') {
    settleWithError(message.id, new CommandError(`The browser tab couldn't render the song: ${message.message}`));
  }
});

/**
 * Asks a browser tab to render this exact project snapshot, then saves the WAV
 * it uploads. The tab renders the copy it's sent, so edits made meanwhile
 * can't leak into the result.
 */
export async function renderInTab(project: Project, finishTimeoutMs: number) {
  const id = randomUUID();

  const wav = await new Promise<Buffer>((resolve, reject) => {
    const timer = setTimeout(() => {
      settleWithError(
        id,
        new CommandError(
          `The browser tab didn't respond to the render request within ${START_TIMEOUT_MS / 1000} seconds. It may be showing an old version of the page, or be suspended in the background. Ask the user to refresh ${UI_URL} and keep it open, then try again.`,
        ),
      );
    }, START_TIMEOUT_MS);
    pending.set(id, { resolve, reject, timer, finishTimeoutMs });

    if (!sendToOneTab({ type: 'render', id, project, sampleRate: RENDER_SAMPLE_RATE })) {
      settleWithError(
        id,
        new CommandError(`Nothing rendered: rendering happens in the browser, and the browser UI isn't open. Ask the user to open ${UI_URL}.`),
      );
    }
  });

  await mkdir(RENDERS_DIR, { recursive: true });
  const file = path.join(RENDERS_DIR, `${new Date().toISOString().replaceAll(':', '-')}-${id.slice(0, 8)}.wav`);
  await writeFile(file, wav);
  return { file, bytes: wav.length, sampleRate: RENDER_SAMPLE_RATE };
}

/** Called when a tab uploads a finished render. Returns false for unknown or expired render ids. */
export function receiveRender(id: string, wav: Buffer) {
  const job = pending.get(id);
  if (!job) return false;
  clearTimeout(job.timer);
  pending.delete(id);
  job.resolve(wav);
  return true;
}

function settleWithError(id: string, error: Error) {
  const job = pending.get(id);
  if (!job) return;
  clearTimeout(job.timer);
  pending.delete(id);
  job.reject(error);
}
