import { type ChildProcess, spawn } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { callTool } from './mcp.ts';

// This test runs its own server, so it can stop and restart it.
const PORT = 4750;
const REPO = path.resolve(import.meta.dirname, '..');

test('the project survives a server restart, saved as readable JSON', async () => {
  const projectsDir = await mkdtemp(path.join(os.tmpdir(), 'auto-daw-e2e-restart-'));
  let server = await startServer(projectsDir);
  try {
    await callTool('set_tempo', { bpm: 123 }, PORT);
    await callTool('add_tracks', { tracks: [{ name: 'Survivor' }] }, PORT);
    await stopServer(server);

    const saved = JSON.parse(await readFile(path.join(projectsDir, 'default', 'project.json'), 'utf8'));
    expect(saved.tempo).toBe(123);
    expect(saved.tracks.map((track: { name: string }) => track.name)).toContain('Survivor');

    server = await startServer(projectsDir);
    const project = (await callTool('get_project', {}, PORT)).text;
    expect(project).toContain(': 123 BPM');
    expect(project).toContain('Survivor');
    // Undo history lives in memory, so it starts fresh after a restart.
    expect(project).toContain('History: nothing to undo; nothing to redo.');
  } finally {
    await stopServer(server);
  }
});

async function startServer(projectsDir: string) {
  const server = spawn(process.execPath, ['server/index.ts'], {
    cwd: REPO,
    env: { ...process.env, PORT: String(PORT), PROJECTS_DIR: projectsDir },
    stdio: 'ignore',
  });
  // [::1], not localhost: under WSL, polling a closed 127.0.0.1 port hangs (see playwright.config.ts).
  await expect
    .poll(async () => (await fetch(`http://[::1]:${PORT}/api/health`).catch(() => undefined))?.ok ?? false, { timeout: 15_000 })
    .toBe(true);
  return server;
}

async function stopServer(server: ChildProcess) {
  if (server.exitCode !== null) return;
  const exited = new Promise((resolve) => server.once('exit', resolve));
  server.kill();
  await exited;
}
