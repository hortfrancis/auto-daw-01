import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Unit tests sit next to the code. Playwright owns e2e/.
    include: ['{server,shared,web}/**/*.test.ts'],
  },
});
