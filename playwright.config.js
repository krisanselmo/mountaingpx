import { defineConfig } from '@playwright/test';

// End-to-end tests (e2e/): load a GPX, generate waypoints against a mocked
// Overpass API, export the enriched GPX. Run with `npm run test:e2e`;
// unit tests (test/) stay on `npm test`.
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:4173',
    // Environments with a pre-provisioned browser can point to it instead
    // of downloading one (`npx playwright install chromium`).
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },
  webServer: {
    command: 'npx vite --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
