import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

const repositoryRoot = path.resolve(__dirname, "../../..");
const artifactRoot = path.join(repositoryRoot, "output/playwright/bzone-uat");
const traceEnabled = /^(1|true|yes)$/i.test(process.env.KRUXT_UAT_ENABLE_TRACE?.trim() ?? "");

export default defineConfig({
  testDir: __dirname,
  testMatch: "bzone-uat.spec.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 120_000,
  expect: {
    timeout: 15_000,
  },
  reporter: [
    ["list"],
    [path.join(__dirname, "strict-skip-reporter.ts")],
    ["html", { outputFolder: path.join(artifactRoot, "report"), open: "never" }],
  ],
  outputDir: path.join(artifactRoot, "artifacts"),
  use: {
    ...devices["Desktop Chrome"],
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    screenshot: "only-on-failure",
    trace: traceEnabled ? "retain-on-failure" : "off",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
