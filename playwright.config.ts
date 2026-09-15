import os from 'node:os';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { E2E_PORT } from './e2e/port.ts';

export default defineConfig({
  testDir: 'e2e',
  // The tests share one server and its in-memory project, so run them one at a time.
  workers: 1,
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node server/index.ts',
    // IPv6 loopback on purpose: under WSL's mirrored networking, connecting to a
    // closed port on 127.0.0.1 hangs for ~2 minutes instead of being refused,
    // which stalls Playwright's "is the port already in use?" check.
    url: `http://[::1]:${E2E_PORT}/api/health`,
    // Test renders and projects go to temp folders, not the repo. A new projects
    // folder each run means every run starts from the demo project.
    env: {
      PORT: String(E2E_PORT),
      RENDERS_DIR: path.join(os.tmpdir(), 'auto-daw-e2e-renders'),
      PROJECTS_DIR: path.join(os.tmpdir(), `auto-daw-e2e-projects-${Date.now()}`),
    },
    reuseExistingServer: false,
  },
});
