// The studio in a real browser (REQ-436): Chromium on Windows, macOS and
// Linux in CI. Locally, PW_CHANNEL=chrome uses the Chrome already installed.
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: /.*\.spec\.mjs$/,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never", outputFolder: "../../playwright-report" }]]
    : "list",
  use: {
    browserName: "chromium",
    channel: process.env.PW_CHANNEL || undefined,
    locale: "es-ES",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  outputDir: "../../test-results/studio",
});
