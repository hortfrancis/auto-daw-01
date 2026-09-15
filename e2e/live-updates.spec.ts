import { expect, test } from '@playwright/test';
import { WebSocket } from 'ws';
import { callTool } from './mcp.ts';
import { E2E_PORT } from './port.ts';

test('shows the project the server pushes, with hot reload connected', async ({ page }) => {
  const consoleMessages: string[] = [];
  page.on('console', (message) => consoleMessages.push(message.text()));
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));

  await page.goto('/');

  await expect(page.locator('#connection')).toHaveText('Live');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Demo');
  await expect(page.locator('.track-name').first()).toHaveText('Lead');
  await expect.poll(() => consoleMessages.some((m) => m.includes('[vite] connected'))).toBe(true);
  expect(pageErrors).toEqual([]);
});

test('set_tempo updates an open tab without a refresh', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#connection')).toHaveText('Live');

  const result = await callTool('set_tempo', { bpm: 96 });

  expect(result.isError).toBe(false);
  expect(result.text).toMatch(/^Tempo set to 96 BPM \(was \d+(\.\d+)?\)\.$/);
  const tempo = page.locator('.meta dd').first();
  await expect(tempo).toHaveText('96 BPM');
  await expect(tempo).toHaveClass(/flash/);
});

test('add_tracks adds a batch to an open tab and highlights the new tracks', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#connection')).toHaveText('Live');
  const before = await page.locator('.track').count();

  const result = await callTool('add_tracks', { tracks: [{ name: 'Bass' }, { name: 'Pads' }] });

  expect(result.isError).toBe(false);
  expect(result.text).toMatch(/^Added 2 tracks: Bass \[track-\d+\], Pads \[track-\d+\]\. Tracks now: .*Bass, Pads\.$/);
  await expect(page.locator('.track')).toHaveCount(before + 2);
  await expect(page.locator('.track.flash .track-name')).toHaveText(['Bass', 'Pads']);
});

test('add_tracks rejects a clashing name and adds nothing', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#connection')).toHaveText('Live');
  const before = await page.locator('.track').count();

  const result = await callTool('add_tracks', { tracks: [{ name: 'Drums' }, { name: 'lead' }] });

  expect(result.isError).toBe(true);
  expect(result.text).toContain('"lead" clashes with the existing track "Lead"');
  expect((await callTool('get_project')).text).not.toContain('Drums');
  await expect(page.locator('.track')).toHaveCount(before);
});

test('get_project says whether a browser tab is open', async ({ page }) => {
  // Tabs from earlier tests may take a moment to disconnect.
  await expect.poll(async () => (await callTool('get_project')).text).toContain('Browser UI: not open');

  await page.goto('/');
  await expect(page.locator('#connection')).toHaveText('Live');

  expect((await callTool('get_project')).text).toContain('Browser UI: open in 1 tab');
});

test('/ws refuses connections from other sites', async () => {
  const outcome = await new Promise<string>((resolve) => {
    const ws = new WebSocket(`ws://localhost:${E2E_PORT}/ws`, { headers: { Origin: 'http://evil.example' } });
    ws.on('open', () => {
      ws.close();
      resolve('opened');
    });
    ws.on('unexpected-response', (_request, response) => resolve(`HTTP ${response.statusCode}`));
    ws.on('error', (error) => resolve(`error: ${error.message}`));
  });

  expect(outcome).toBe('HTTP 403');
});
