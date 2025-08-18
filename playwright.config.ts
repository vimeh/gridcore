import { defineConfig, devices } from "@playwright/test";

/**
 * Base URL Configuration
 *
 * The base URL can be configured in two ways:
 * 1. Environment variable: BASE_URL=http://localhost:3000 bun run test:e2e
 * 2. Default: http://localhost:8080 (Leptos Trunk server)
 *
 * All tests use relative URLs (e.g., await page.goto("/")) so changing
 * the base URL will automatically update all test targets.
 */
const BASE_URL = process.env.BASE_URL || "http://localhost:8080";

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  timeout: 5 * 1000, // shorter timeout for test actions
  expect: {
    timeout: 1 * 1000, // shorter timeout for expect assertions
  },
  testDir: "./tests",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : 8,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [["html", { open: "never" }]],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: BASE_URL,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",

    /* Take screenshot on failure */
    screenshot: "only-on-failure",
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },

    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },

    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: "cd gridcore-rs/gridcore-ui && trunk serve --features perf",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
