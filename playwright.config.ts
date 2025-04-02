import type { PlaywrightTestConfig } from "@playwright/test";
import { devices } from "@playwright/test";

const config: PlaywrightTestConfig = {
  testDir: "./sources",
  timeout: 300_000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "line",
  use: {
    ignoreHTTPSErrors: true,
    video: {
      mode: "off",
      size: {
        height: 1080,
        width: 1920,
      },
    },
    actionTimeout: 0,
    /* Base URL to use in actions like `await page.goto('/')`. */
    // baseURL: 'http://localhost:3000',
    trace: "on-first-retry",
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1920, height: 1080 },
        locale: "ja-JP",
        // launchOptions:{
        //   proxy: {
        //     server: 'http://localhost:11223',
        //   }
        // }
      },
    },
  ],
};

export default config;
