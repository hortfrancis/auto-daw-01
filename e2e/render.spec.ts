import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { callTool } from './mcp.ts';

const RENDER_RESULT = /^Rendered the whole song, (\d+) bars? at ([\d.]+) BPM \(([\d.]+) s, 48 kHz stereo WAV\), to (.+\.wav) \(([\d.]+) MB\)\.$/;
const WAV_HEADER_BYTES = 44;

test('render tells the agent it needs the browser tab', async () => {
  await expect.poll(async () => (await callTool('get_project')).text).toContain('Browser UI: not open');

  const result = await callTool('render');

  expect(result.isError).toBe(true);
  expect(result.text).toContain("rendering happens in the browser, and the browser UI isn't open");
});

test('render saves a WAV of the whole song, matching every time, without enabling audio', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#connection')).toHaveText('Live');

  const first = await callTool('render');
  const second = await callTool('render');

  expect(first.isError, first.text).toBe(false);
  const [, , , seconds, firstPath] = first.text.match(RENDER_RESULT) ?? [];
  const [, , , , secondPath] = second.text.match(RENDER_RESULT) ?? [];
  expect(firstPath, first.text).toBeDefined();
  expect(secondPath).not.toBe(firstPath);

  const [a, b] = await Promise.all([readFile(firstPath), readFile(secondPath)]);

  // The same project renders to matching audio. Not always bit-identical:
  // Chrome mixes 3+ overlapping sounds in a varying order, which can move a
  // 16-bit sample by 1 (about -96 dB). See docs/spikes/06-offline-render.md.
  expect(b.length).toBe(a.length);
  expect(b.subarray(0, WAV_HEADER_BYTES).equals(a.subarray(0, WAV_HEADER_BYTES))).toBe(true);
  expect(largestSampleDifference(a, b)).toBeLessThanOrEqual(1);

  // 16-bit stereo at 48 kHz for the length of the song (the result rounds to 0.1 s).
  const frames = (a.length - WAV_HEADER_BYTES) / 4;
  expect(Math.abs(frames / 48_000 - Number(seconds))).toBeLessThanOrEqual(0.05);

  // And there's actually sound in it.
  expect(largestSampleDifference(a, Buffer.alloc(a.length))).toBeGreaterThan(1000);
});

/** The biggest difference between matching 16-bit samples in two WAV files of the same length. */
function largestSampleDifference(a: Buffer, b: Buffer) {
  let largest = 0;
  for (let offset = WAV_HEADER_BYTES; offset < a.length; offset += 2) {
    largest = Math.max(largest, Math.abs(a.readInt16LE(offset) - b.readInt16LE(offset)));
  }
  return largest;
}
