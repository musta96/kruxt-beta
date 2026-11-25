import type { FullResult, Reporter, TestCase, TestResult } from "@playwright/test/reporter";

class StrictSkipReporter implements Reporter {
  private readonly skippedTests: string[] = [];

  onTestEnd(test: TestCase, result: TestResult): void {
    if (result.status === "skipped") {
      this.skippedTests.push(test.titlePath().join(" > "));
    }
  }

  async onEnd(_result: FullResult): Promise<void | { status?: FullResult["status"] }> {
    if (process.env.KRUXT_UAT_STRICT !== "1" || this.skippedTests.length === 0) return;

    console.error("\nStrict BZone UAT failed because required tests skipped:");
    for (const title of this.skippedTests) console.error(`- ${title.replace(/^\s*>\s*/, "")}`);
    return { status: "failed" };
  }
}

export default StrictSkipReporter;
