import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.js",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 3, // Adjust based on system capacity (5 clients in parallel at a time)
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
