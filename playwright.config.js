import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "gst_automation.spec.js",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    headless: false,
    trace: "on-first-retry",
    acceptDownloads: true,
    downloadsPath: "./downloads",
    launchOptions: {
      args: ["--disable-pdf-viewer"],
    },
  },
});
