import { defineConfig, devices } from '@playwright/test';
import { E2E_ENV, E2E_PORT } from './tests/e2e/e2e-env';

// E2E runs the real production build against a real (embedded) Postgres in .data/e2e.
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://localhost:${E2E_PORT}`, trace: 'retain-on-failure' },
  webServer: {
    command: `node tests/e2e/reset-db.mjs && npm run build && npx next start -p ${E2E_PORT}`,
    url: `http://localhost:${E2E_PORT}`,
    timeout: 240_000,
    reuseExistingServer: false,
    env: E2E_ENV,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } } },
  ],
});
