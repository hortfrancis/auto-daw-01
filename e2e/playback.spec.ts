import { expect, test } from '@playwright/test';
import { callTool } from './mcp.ts';

test('play tells the agent what the user needs to do when it cannot play', async ({ page }) => {
  await expect.poll(async () => (await callTool('get_project')).text).toContain('Browser UI: not open');

  const noTab = await callTool('play');
  expect(noTab.isError).toBe(true);
  expect(noTab.text).toContain("the browser UI isn't open");

  await page.goto('/');
  await expect(page.locator('#connection')).toHaveText('Live');

  const locked = await callTool('play');
  expect(locked.isError).toBe(true);
  expect(locked.text).toContain('click "Enable audio"');
  expect((await callTool('get_project')).text).toContain('audio not enabled yet');
});

test('play and stop from MCP drive the tab, and sound comes out', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#connection')).toHaveText('Live');
  await page.getByRole('button', { name: 'Enable audio' }).click();
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();

  const played = await callTool('play');
  expect(played.isError).toBe(false);
  expect(played.text).toMatch(/^Playing from bar 1 at [\d.]+ BPM, looping the \d+ bars? of the song, in 1 tab\.$/);
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();
  await expect(page.locator('.meter')).toHaveAttribute('data-active', 'true');
  expect((await callTool('get_project')).text).toContain('audio enabled, playing');

  const stopped = await callTool('stop');
  expect(stopped).toEqual({ isError: false, text: 'Stopped.' });
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  await expect(page.locator('.meter')).toHaveAttribute('data-active', 'false');
  expect((await callTool('stop')).text).toBe('Already stopped.');
});

test('the Play and Stop buttons work on their own', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Enable audio' }).click();

  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.locator('.meter')).toHaveAttribute('data-active', 'true');
  expect((await callTool('get_project')).text).toContain('audio enabled, playing');

  await page.getByRole('button', { name: 'Stop' }).click();
  await expect(page.locator('.meter')).toHaveAttribute('data-active', 'false');
});
