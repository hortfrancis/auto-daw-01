import type { McpServer } from '@modelcontextprotocol/server';
import { plural } from '../../shared/format.ts';
import { noteCount, songLengthBars } from '../../shared/timing.ts';
import { UI_URL } from '../config.ts';
import { CommandError } from '../errors.ts';
import { sendTransport, tabStatuses, waitForTabs } from '../live.ts';
import * as store from '../store.ts';
import { run } from './results.ts';

/** How long to wait for a browser tab to confirm a transport command. */
const TAB_CONFIRM_MS = 2000;

export function registerTransportTools(server: McpServer) {
  server.registerTool(
    'play',
    {
      title: 'Play',
      description:
        "Play the song in the user's browser tab, from bar 1, looping. Restarts if already playing. Only the user hears it. Edits made while playing are heard straight away. If the tab can't play yet, the result says what the user needs to do.",
    },
    async () =>
      run(async () => {
        const project = store.getProject();
        const tabs = tabStatuses();
        if (tabs.length === 0) {
          throw new CommandError(
            `Nothing played: the browser UI isn't open. Ask the user to open ${UI_URL} and click "Enable audio".`,
          );
        }
        if (!tabs.some((tab) => tab.audio === 'ready')) {
          throw new CommandError(
            'Nothing played: audio isn\'t enabled in the browser tab yet (browsers need a click before they make sound). Ask the user to click "Enable audio" in the Auto DAW tab, then try again.',
          );
        }
        if (noteCount(project) === 0) {
          throw new CommandError('Nothing played: the project has no notes yet. Add some with write_clip.');
        }

        sendTransport('play');
        const started = await waitForTabs((all) => all.some((tab) => tab.transport === 'playing'), TAB_CONFIRM_MS);
        if (!started) {
          throw new CommandError(
            "The browser tab didn't confirm playback within 2 seconds. Check get_project to see whether the tab is still open.",
          );
        }
        const playing = tabStatuses().filter((tab) => tab.transport === 'playing').length;
        return `Playing from bar 1 at ${project.tempo} BPM, looping the ${plural(songLengthBars(project), 'bar')} of the song, in ${plural(playing, 'tab')}.`;
      }),
  );

  server.registerTool(
    'stop',
    {
      title: 'Stop',
      description: "Stop playback in the user's browser tab. Safe to call when nothing is playing.",
      annotations: { idempotentHint: true },
    },
    async () =>
      run(async () => {
        if (!tabStatuses().some((tab) => tab.transport === 'playing')) return 'Already stopped.';
        sendTransport('stop');
        const stopped = await waitForTabs((all) => all.every((tab) => tab.transport === 'stopped'), TAB_CONFIRM_MS);
        if (!stopped) {
          throw new CommandError("The browser tab didn't confirm it stopped within 2 seconds. Check get_project to see its state.");
        }
        return 'Stopped.';
      }),
  );
}
