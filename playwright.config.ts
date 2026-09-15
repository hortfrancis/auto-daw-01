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
    env: { PORT: String(E2E_PORT) },
    reuseExistingServer: false,
  },
});
