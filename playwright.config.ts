import { defineConfig, devices } from '@playwright/test';

const cloudflare = process.env.CLOUDFLARE_E2E === '1';
const baseURL = cloudflare ? 'http://localhost:8787/' : `http://localhost:4173${process.env.BASE_PATH || ''}/`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  use: {
    baseURL,
    serviceWorkers: 'allow',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
  },
  webServer: {
    command: cloudflare
      ? 'npm run cloudflare:build && npm run cloudflare:local-keys && npm run cloudflare:dev'
      : 'npm run build && npm run preview -- --port 4173',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], browserName: 'chromium' } }
  ]
});
