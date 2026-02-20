#!/usr/bin/env node
import { appendFile, writeFile } from "node:fs/promises";
import process from "node:process";

const ALLOWED_TIMEFRAMES = new Set(["daily", "weekly", "monthly", "all_time"]);

function parseArgs(argv) {
  const parsed = {
    timeframe: "weekly",
    limit: 200,
    determinismProbeCount: 3,
    outputFile: ""
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const value = argv[index + 1];

    if (token === "--timeframe" && value) {
      parsed.timeframe = value;
      index += 1;
      continue;
    }

    if (token === "--limit" && value) {
      parsed.limit = Number(value);
      index += 1;
      continue;
    }

    if (token === "--determinism-probe-count" && value) {
      parsed.determinismProbeCount = Number(value);
      index += 1;
      continue;
    }

    if (token === "--output-file" && value) {
      parsed.outputFile = value;
      index += 1;
      continue;
    }
  }

  return parsed;
}

function asPositiveInt(value, fallback) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.trunc(value));
}

async function writeStepSummary(path, lines) {
  if (!path) {
    return;
  }

  await appendFile(path, `${lines.join("\n")}\n`, "utf8");
}

async function main() {
  const config = parseArgs(process.argv.slice(2));
  const timeframe = config.timeframe;

  if (!ALLOWED_TIMEFRAMES.has(timeframe)) {
    throw new Error(`Invalid timeframe: ${timeframe}`);
  }

  const limit = asPositiveInt(config.limit, 200);
  const determinismProbeCount = Math.max(0, Math.trunc(config.determinismProbeCount));

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  const endpoint = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/rank_recompute_weekly`;
  const requestBody = {
    timeframe,
    limit,
    determinismProbeCount
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  });

  const rawText = await response.text();
  let parsed;

  try {
    parsed = rawText ? JSON.parse(rawText) : {};
  } catch (_error) {
    parsed = { parseError: true, rawText };
  }

  const failedCount = Number(parsed?.failedCount ?? 0);
  const determinismMismatchCount = Number(
    parsed?.determinismMismatchCount ??
      (Array.isArray(parsed?.determinismFailures) ? parsed.determinismFailures.length : 0)
  );

  const status = !response.ok || failedCount > 0 || determinismMismatchCount > 0 ? "failed" : "succeeded";

  const summary = {
    status,
    requestedAt: new Date().toISOString(),
    endpoint,
    requestBody,
    httpStatus: response.status,
    scannedCount: Number(parsed?.scannedCount ?? 0),
    rebuiltCount: Number(parsed?.rebuiltCount ?? 0),
    failedCount,
    determinismProbeCount: Number(parsed?.determinismProbeCount ?? determinismProbeCount),
    determinismMismatchCount,
    response: parsed
  };

  if (config.outputFile) {
    await writeFile(config.outputFile, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  }

  await writeStepSummary(process.env.GITHUB_STEP_SUMMARY, [
    "## Rank Recompute Weekly",
    `- Status: **${summary.status.toUpperCase()}**`,
    `- HTTP status: \`${summary.httpStatus}\``,
    `- Timeframe: \`${timeframe}\``,
    `- Scanned boards: \`${summary.scannedCount}\``,
    `- Rebuilt boards: \`${summary.rebuiltCount}\``,
    `- Rebuild failures: \`${summary.failedCount}\``,
    `- Determinism probes: \`${summary.determinismProbeCount}\``,
    `- Determinism mismatches: \`${summary.determinismMismatchCount}\``
  ]);

  console.log(JSON.stringify(summary, null, 2));

  if (!response.ok) {
    throw new Error(`rank_recompute_weekly returned HTTP ${response.status}`);
  }

  if (failedCount > 0) {
    throw new Error(`rank_recompute_weekly reported ${failedCount} rebuild failures.`);
  }

  if (determinismMismatchCount > 0) {
    throw new Error(`Determinism probe detected ${determinismMismatchCount} mismatch(es).`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
