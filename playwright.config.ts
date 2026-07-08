import type { PlaywrightTestConfig } from "@playwright/test";
import { devices } from "@playwright/test";

const config: PlaywrightTestConfig = {
  testDir: "./sources",
  timeout: 300_000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: true,
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
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1920, height: 1080 },
        locale: "ja-JP",
      },
    },
  ],
};

export default config;
