import { defineConfig, devices } from '@playwright/test';

const chromium = process.env.PLAYWRIGHT_CHROMIUM_PATH;

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    launchOptions: chromium ? { executablePath: chromium } : {},
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 820 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], ...(chromium ? { launchOptions: { executablePath: chromium } } : {}) }, testMatch: /layout\.spec/ },
  ],
  webServer: [
    { command: 'npx partykit dev --port 1999', port: 1999, reuseExistingServer: true, timeout: 60_000 },
    { command: 'npx vite --port 5173 --strictPort', port: 5173, reuseExistingServer: true, timeout: 60_000 },
  ],
});
