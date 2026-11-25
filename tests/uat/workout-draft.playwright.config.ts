import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "../../apps/web/tests",
  testMatch: "workout-draft.browser.spec.ts",
  outputDir: "../../output/playwright/workout-draft",
  workers: 1,
  timeout: 30_000,
  use: { trace: "retain-on-failure" },
  webServer: {
    command: "pnpm --filter @kruxt/web exec next start --hostname 127.0.0.1 --port 3296",
    url: "http://127.0.0.1:3296/log",
    reuseExistingServer: false,
    env: { NEXT_TELEMETRY_DISABLED: "1" }
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
    { name: "mobile", use: { ...devices["iPhone 13"], browserName: "chromium" } }
  ]
});
