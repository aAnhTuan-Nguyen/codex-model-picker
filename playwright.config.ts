import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/e2e', timeout: 30000, fullyParallel: false, retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5173', viewport: { width: 760, height: 720 }, trace: 'retain-on-failure' },
  webServer: { command: 'npm run dev:ui', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI },
  projects: [
    { name: 'renderer', testMatch: 'renderer.spec.ts', use: { browserName: 'chromium', launchOptions: process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {} } },
    { name: 'desktop', testMatch: 'desktop.spec.ts' }
  ]
})
