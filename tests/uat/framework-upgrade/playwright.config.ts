import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  outputDir: "../../../output/playwright/next-upgrade",
  workers: 1,
  timeout: 30_000,
  use: { trace: "retain-on-failure" },
  webServer: [
    {
      command: "pnpm --filter @kruxt/web exec next start --hostname 127.0.0.1 --port 3293",
      url: "http://127.0.0.1:3293/product",
      reuseExistingServer: !process.env.CI,
      env: { NEXT_TELEMETRY_DISABLED: "1" }
    },
    {
      command: "pnpm --filter @kruxt/admin exec next start --hostname 127.0.0.1 --port 3294",
      url: "http://127.0.0.1:3294/login",
      reuseExistingServer: !process.env.CI,
      env: { NEXT_TELEMETRY_DISABLED: "1" }
    }
  ],
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
    { name: "mobile", use: { ...devices["iPhone 13"], browserName: "chromium" } }
  ]
});
