import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests for the SEFKHET-ABWY map app.
 *
 * The tests drive a running copy of the app through a browser and over HTTP.
 * They do not start the app; BASE_URL says where it runs. Every call the map
 * makes to the monument database, the IP lookup and the map tiles is answered
 * by a stub, so the tests never read real data.
 *
 * Production is refused: these tests are for a local build or the acceptance
 * environment, never the live site.
 *
 * Chromium only: the ArcGIS SDK needs WebGL2, which headless Firefox and
 * WebKit do not provide reliably.
 */
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4173';

if (/(^|\.)sefkhet-abwy\.dev$/i.test(new URL(BASE_URL).hostname)) {
  throw new Error(
    `BASE_URL ${BASE_URL} is the live site. These tests run against a local build or the acceptance environment only.`,
  );
}

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Each browser renders the map in software WebGL, which is CPU-heavy; more
  // than two at once makes map loading slow enough to time out.
  workers: 2,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 90_000,

  use: {
    baseURL: BASE_URL,
    // Traces record request headers; with a bypass value set, record none.
    trace: process.env.VERCEL_BYPASS ? 'off' : 'retain-on-failure',
    screenshot: 'only-on-failure',
    // A service worker would answer fetches before page.route() sees them.
    // Only the PWA test turns it back on.
    serviceWorkers: 'block',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Software WebGL for machines and CI runners without a GPU.
        launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
      },
    },
  ],
});
