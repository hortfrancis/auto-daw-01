import { expect, test } from '@playwright/test';
import { callTool } from './mcp.ts';

test('undo and redo step through changes, say what they did, and the open tab follows', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#connection')).toHaveText('Live');
  const tempo = page.locator('.meta dd').first();
  const startingTempo = (await callTool('get_project')).text.match(/: ([\d.]+) BPM/)?.[1];

  await callTool('set_tempo', { bpm: 111 });
  await callTool('add_tracks', { tracks: [{ name: 'Undo me' }] });
  await expect(page.locator('.track', { hasText: 'Undo me' })).toHaveCount(1);
  expect((await callTool('get_project')).text).toMatch(/History: \d+ changes can be undone \(latest: add track "Undo me"\); nothing to redo\. Every change is saved automatically\./);

  const undone = await callTool('undo', { steps: 2 });
  expect(undone.isError).toBe(false);
  expect(undone.text).toMatch(
    /^Undid 2 changes: add track "Undo me"; set tempo to 111 BPM\. History: .*; 2 changes can be redone \(next: set tempo to 111 BPM\)\.$/,
  );
  await expect(page.locator('.track', { hasText: 'Undo me' })).toHaveCount(0);
  await expect(tempo).toHaveText(`${startingTempo} BPM`);

  const redone = await callTool('redo');
  expect(redone.text).toMatch(/^Redid 1 change: set tempo to 111 BPM\. History: .*; 1 change can be redone \(next: add track "Undo me"\)\.$/);
  await expect(tempo).toHaveText('111 BPM');

  // A new change clears what could be redone.
  await callTool('set_tempo', { bpm: 112 });
  expect((await callTool('redo')).text).toMatch(/^Nothing to redo\. History: .*; nothing to redo\.$/);
});
