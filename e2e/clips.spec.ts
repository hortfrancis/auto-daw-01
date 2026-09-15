import { expect, test } from '@playwright/test';
import { callTool } from './mcp.ts';

test('write_clip puts notes on a track, the piano roll shows them, and get_clip reads them back', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#connection')).toHaveText('Live');
  await callTool('add_tracks', { tracks: [{ name: 'Bassline' }] });

  const written = await callTool('write_clip', {
    track: 'bassline',
    clip: 'Riff',
    notes: [
      { pitch: 'A2', bar: 2, beat: 1, lengthBeats: 2, velocity: 0.6 },
      { pitch: 'E2', bar: 1, beat: 1, lengthBeats: 0.5 },
      { pitch: 'e2', bar: 1, beat: 1.5, lengthBeats: 0.5 },
      { pitch: 43, bar: 1, beat: 2 },
    ],
  });

  expect(written.isError).toBe(false);
  expect(written.text).toMatch(/^Created clip "Riff" \[clip-\d+\] on Bassline: bars 1–2, 4 notes, E2–A2\. Song length: \d+ bars?\.$/);

  const lane = page.locator('.track', { hasText: 'Bassline' }).locator('.note');
  await expect(lane).toHaveCount(4);
  expect(await lane.evaluateAll((notes) => notes.map((n) => n.getAttribute('data-pitch')))).toEqual(['E2', 'E2', 'G2', 'A2']);

  const read = await callTool('get_clip', { track: 'Bassline', clip: 'riff' });
  expect(read.isError).toBe(false);
  expect(read.text).toContain('bar  beat  pitch  lengthBeats  velocity');
  expect(read.text).toMatch(/^1\s+1\.5\s+E2\s+0\.5\s+0\.8$/m);
  expect(read.text).toMatch(/^1\s+2\s+G2\s+1\s+0\.8$/m);
  expect(read.text).toMatch(/^2\s+1\s+A2\s+2\s+0\.6$/m);
});

test('writing to an existing clip replaces its notes and keeps its place', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#connection')).toHaveText('Live');
  await callTool('add_tracks', { tracks: [{ name: 'Chords' }] });
  await callTool('write_clip', {
    track: 'Chords',
    clip: 'Verse',
    startBar: 3,
    notes: [
      { pitch: 'C4', bar: 1, beat: 1, lengthBeats: 4 },
      { pitch: 'E4', bar: 1, beat: 1, lengthBeats: 4 },
      { pitch: 'G4', bar: 1, beat: 1, lengthBeats: 4 },
      { pitch: 'F4', bar: 2, beat: 1, lengthBeats: 4 },
    ],
  });

  const replaced = await callTool('write_clip', {
    track: 'Chords',
    clip: 'verse',
    notes: [{ pitch: 'D4', bar: 1, beat: 1, lengthBeats: 4 }],
  });

  expect(replaced.text).toMatch(/^Replaced clip "Verse" \[clip-\d+\] on Chords: bars 3–4, 1 note \(was 4\), D4\./);
  const notes = page.locator('.track', { hasText: 'Chords' }).locator('.note');
  await expect(notes).toHaveCount(1);
  await expect(notes).toHaveAttribute('data-pitch', 'D4');
  await expect(page.locator('.track', { hasText: 'Chords' }).locator('.clip.flash')).toHaveCount(1);
});
