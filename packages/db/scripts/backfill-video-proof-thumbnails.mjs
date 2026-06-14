#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { pathToFileURL } from "node:url";

const PROOF_BUCKET = "workout-proof";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULTS = {
  mode: "dry-run",
  limit: 100,
  pageSize: 50,
  frameSeconds: 0,
  outputFile: "video-proof-thumbnail-backfill-report.json",
  workoutIds: []
};

export function parseArgs(argv) {
  const config = { ...DEFAULTS, workoutIds: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];

    if (argument === "--mode") {
      config.mode = requireValue(argument, value);
      index += 1;
    } else if (argument === "--limit") {
      config.limit = parseInteger(argument, requireValue(argument, value), 1, 1000);
      index += 1;
    } else if (argument === "--page-size") {
      config.pageSize = parseInteger(argument, requireValue(argument, value), 1, 250);
      index += 1;
    } else if (argument === "--frame-seconds") {
      config.frameSeconds = parseNumber(argument, requireValue(argument, value), 0, 60);
      index += 1;
    } else if (argument === "--output-file") {
      config.outputFile = requireValue(argument, value);
      index += 1;
    } else if (argument === "--workout-ids") {
      config.workoutIds = parseWorkoutIds(requireValue(argument, value));
      index += 1;
    } else if (argument === "--help" || argument === "-h") {
      config.help = true;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  if (!["dry-run", "apply"].includes(config.mode)) {
    throw new Error("--mode must be dry-run or apply");
  }

  return config;
}

function requireValue(argument, value) {
  if (!value || value.startsWith("--")) {
    throw new Error(`${argument} requires a value`);
  }
  return value;
}

function parseInteger(argument, value, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${argument} must be an integer between ${minimum} and ${maximum}`);
  }
  return parsed;
}

function parseNumber(argument, value, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${argument} must be between ${minimum} and ${maximum}`);
  }
  return parsed;
}

export function parseWorkoutIds(value) {
  if (!value.trim()) {
    return [];
  }

  const ids = [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
  const invalid = ids.find((id) => !UUID_PATTERN.test(id));
  if (invalid) {
    throw new Error(`Invalid workout UUID: ${invalid}`);
  }
  if (ids.length > 100) {
    throw new Error("--workout-ids accepts at most 100 IDs");
  }
  return ids;
}

export function publicObjectUrl(supabaseUrl, objectPath) {
  return `${supabaseUrl}/storage/v1/object/public/${PROOF_BUCKET}/${encodeObjectPath(objectPath)}`;
}

export function parseProofObjectPath(proofMediaUrl, supabaseUrl) {
  if (!proofMediaUrl) {
    return null;
  }

  let url;
  try {
    url = new URL(proofMediaUrl);
  } catch {
    return null;
  }

  const expectedOrigin = new URL(supabaseUrl).origin;
  const prefix = `/storage/v1/object/public/${PROOF_BUCKET}/`;
  if (url.origin !== expectedOrigin || !url.pathname.startsWith(prefix)) {
    return null;
  }

  const encodedPath = url.pathname.slice(prefix.length);
  let objectPath;
  try {
    objectPath = encodedPath
      .split("/")
      .map((segment) => decodeURIComponent(segment))
      .join("/");
  } catch {
    return null;
  }

  return isSafeObjectPath(objectPath) ? objectPath : null;
}

export function chooseSourceObject(objects, workoutId) {
  const prefix = `${workoutId}.`;
  const candidates = objects
    .map((object) => object.name)
    .filter((name) => name.startsWith(prefix))
    .filter((name) => !name.endsWith("_thumb.jpg"))
    .filter((name) => /\.(mp4|mov|m4v|webm)$/i.test(name))
    .sort();

  return candidates[0] ?? null;
}

export function sourceBelongsToWorkout(objectPath, userId, workoutId) {
  const escapedUserId = escapeRegExp(userId);
  const escapedWorkoutId = escapeRegExp(workoutId);
  return new RegExp(
    `^${escapedUserId}/${escapedWorkoutId}\\.(mp4|mov|m4v|webm)$`,
    "i"
  ).test(objectPath);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isSafeObjectPath(objectPath) {
  if (!objectPath || objectPath.startsWith("/") || objectPath.includes("\0")) {
    return false;
  }

  const segments = objectPath.split("/");
  return segments.every((segment) => segment && segment !== "." && segment !== "..");
}

function encodeObjectPath(objectPath) {
  if (!isSafeObjectPath(objectPath)) {
    throw new Error(`Unsafe storage object path: ${objectPath}`);
  }
  return objectPath.split("/").map(encodeURIComponent).join("/");
}

function printHelp() {
  console.log(`Backfill poster thumbnails for existing KRUXT video proofs.

Usage:
  node packages/db/scripts/backfill-video-proof-thumbnails.mjs [options]

Options:
  --mode dry-run|apply       Default: dry-run
  --limit 1..1000            Maximum workouts to scan. Default: 100
  --page-size 1..250         PostgREST page size. Default: 50
  --frame-seconds 0..60      Preferred poster timestamp. Default: 0
  --workout-ids id,id        Optional targeted UUID list, maximum 100
  --output-file path         JSON report path

Required environment:
  STAGING_SUPABASE_URL
  STAGING_SUPABASE_SECRET_KEY (preferred) or
  STAGING_SUPABASE_SERVICE_ROLE_KEY (legacy JWT)`);
}

export function validateStagingUrl(supabaseUrl, expectedProjectRef) {
  let url;
  try {
    url = new URL(supabaseUrl);
  } catch {
    throw new Error("STAGING_SUPABASE_URL must be a valid URL");
  }

  const expectedHostname = `${expectedProjectRef}.supabase.co`;
  if (url.protocol !== "https:" || url.hostname !== expectedHostname) {
    throw new Error(
      `Refusing to run against unexpected Supabase host; expected ${expectedHostname}`
    );
  }

  return url.origin;
}

export function buildPrivilegedHeaders(apiKey, extra = {}) {
  const isSecretKey = apiKey.startsWith("sb_secret_");
  const isLegacyServiceRoleJwt = apiKey.split(".").length === 3;
  if (!isSecretKey && !isLegacyServiceRoleJwt) {
    throw new Error(
      "Staging key must be an sb_secret key or legacy service_role JWT"
    );
  }

  return {
    apikey: apiKey,
    ...(isLegacyServiceRoleJwt
      ? { Authorization: `Bearer ${apiKey}` }
      : {}),
    ...extra
  };
}

class SupabaseRestClient {
  constructor(supabaseUrl, privilegedKey) {
    this.supabaseUrl = supabaseUrl.replace(/\/+$/, "");
    this.privilegedKey = privilegedKey;
  }

  headers(extra = {}) {
    return buildPrivilegedHeaders(this.privilegedKey, extra);
  }

  async fetchMissingWorkouts({ afterId, limit, workoutIds }) {
    const url = new URL(`${this.supabaseUrl}/rest/v1/workouts`);
    url.searchParams.set(
      "select",
      "id,user_id,proof_media_url,proof_media_thumbnail_url,created_at"
    );
    url.searchParams.set("proof_media_type", "eq.video");
    url.searchParams.set("proof_media_thumbnail_url", "is.null");
    url.searchParams.set("order", "id.asc");
    url.searchParams.set("limit", String(limit));

    if (workoutIds.length > 0) {
      url.searchParams.set("id", `in.(${workoutIds.join(",")})`);
    } else if (afterId) {
      url.searchParams.set("id", `gt.${afterId}`);
    }

    return this.fetchJson(url, { headers: this.headers() });
  }

  async listUserObjects(userId, workoutId) {
    const url = `${this.supabaseUrl}/storage/v1/object/list/${PROOF_BUCKET}`;
    return this.fetchJson(url, {
      method: "POST",
      headers: this.headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        prefix: `${userId}/`,
        search: workoutId,
        limit: 100,
        offset: 0,
        sortBy: { column: "name", order: "asc" }
      })
    });
  }

  async downloadObject(objectPath) {
    const url = `${this.supabaseUrl}/storage/v1/object/${PROOF_BUCKET}/${encodeObjectPath(objectPath)}`;
    const response = await fetch(url, { headers: this.headers() });
    if (!response.ok) {
      throw new Error(`Storage download failed (${response.status}): ${await response.text()}`);
    }
    return new Uint8Array(await response.arrayBuffer());
  }

  async uploadThumbnail(objectPath, bytes) {
    const url = `${this.supabaseUrl}/storage/v1/object/${PROOF_BUCKET}/${encodeObjectPath(objectPath)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: this.headers({
        "Content-Type": "image/jpeg",
        "Cache-Control": "3600",
        "x-upsert": "true"
      }),
      body: bytes
    });
    if (!response.ok) {
      throw new Error(`Thumbnail upload failed (${response.status}): ${await response.text()}`);
    }
  }

  async setThumbnailIfMissing(workoutId, thumbnailUrl) {
    const url = new URL(`${this.supabaseUrl}/rest/v1/workouts`);
    url.searchParams.set("id", `eq.${workoutId}`);
    url.searchParams.set("proof_media_thumbnail_url", "is.null");
    const response = await fetch(url, {
      method: "PATCH",
      headers: this.headers({
        "Content-Type": "application/json",
        Prefer: "return=representation"
      }),
      body: JSON.stringify({ proof_media_thumbnail_url: thumbnailUrl })
    });
    if (!response.ok) {
      throw new Error(`Workout update failed (${response.status}): ${await response.text()}`);
    }
    const rows = await response.json();
    return rows.length === 1;
  }

  async fetchJson(url, init) {
    const response = await fetch(url, init);
    if (!response.ok) {
      throw new Error(`Supabase request failed (${response.status}): ${await response.text()}`);
    }
    return response.json();
  }
}

export async function extractVideoFrame({
  sourceFile,
  outputFile,
  frameSeconds,
  spawnProcess = spawn
}) {
  const attempts = frameSeconds > 0 ? [frameSeconds, 0] : [0];
  let lastError;

  for (const timestamp of attempts) {
    try {
      await runProcess(
        spawnProcess,
        "ffmpeg",
        [
          "-hide_banner",
          "-loglevel",
          "error",
          "-y",
          "-ss",
          String(timestamp),
          "-i",
          sourceFile,
          "-frames:v",
          "1",
          "-vf",
          "scale=min(1280\\,iw):-2",
          "-q:v",
          "3",
          outputFile
        ]
      );
      return timestamp;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

function runProcess(spawnProcess, command, args) {
  return new Promise((resolve, reject) => {
    const child = spawnProcess(command, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";

    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}: ${stderr.trim()}`));
      }
    });
  });
}

async function processWorkout(client, workout, config) {
  const thumbnailPath = `${workout.user_id}/${workout.id}_thumb.jpg`;
  const objects = await client.listUserObjects(workout.user_id, workout.id);
  const thumbnailExists = objects.some((object) => object.name === `${workout.id}_thumb.jpg`);
  const parsedSourcePath = parseProofObjectPath(workout.proof_media_url, client.supabaseUrl);
  const trustedParsedSourcePath =
    parsedSourcePath &&
    sourceBelongsToWorkout(parsedSourcePath, workout.user_id, workout.id)
      ? parsedSourcePath
      : null;
  const listedSourceName = chooseSourceObject(objects, workout.id);
  const listedSourcePath = listedSourceName ? `${workout.user_id}/${listedSourceName}` : null;
  const sourcePath = trustedParsedSourcePath ?? listedSourcePath;
  const thumbnailUrl = publicObjectUrl(client.supabaseUrl, thumbnailPath);

  if (!thumbnailExists && !sourcePath) {
    return resultFor(workout, "missing_source", { thumbnailPath });
  }

  if (config.mode === "dry-run") {
    return resultFor(workout, "would_backfill", {
      sourcePath,
      thumbnailPath,
      reusedExistingThumbnail: thumbnailExists
    });
  }

  if (!thumbnailExists) {
    const directory = await mkdtemp(join(tmpdir(), "kruxt-proof-thumb-"));
    const sourceExtension = extname(sourcePath) || ".video";
    const sourceFile = join(directory, `source${sourceExtension}`);
    const outputFile = join(directory, "thumbnail.jpg");

    try {
      await writeFile(sourceFile, await client.downloadObject(sourcePath));
      const extractedAtSeconds = await extractVideoFrame({
        sourceFile,
        outputFile,
        frameSeconds: config.frameSeconds
      });
      await client.uploadThumbnail(thumbnailPath, await readFile(outputFile));
      const updated = await client.setThumbnailIfMissing(workout.id, thumbnailUrl);
      return resultFor(workout, updated ? "backfilled" : "already_updated", {
        sourcePath,
        thumbnailPath,
        extractedAtSeconds
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }

  const updated = await client.setThumbnailIfMissing(workout.id, thumbnailUrl);
  return resultFor(workout, updated ? "linked_existing_thumbnail" : "already_updated", {
    sourcePath,
    thumbnailPath
  });
}

function resultFor(workout, status, detail = {}) {
  return {
    workoutId: workout.id,
    userId: workout.user_id,
    status,
    ...detail
  };
}

async function collectWorkouts(client, config) {
  if (config.workoutIds.length > 0) {
    return client.fetchMissingWorkouts({
      afterId: null,
      limit: Math.min(config.limit, config.workoutIds.length),
      workoutIds: config.workoutIds
    });
  }

  const workouts = [];
  let cursor = null;

  while (workouts.length < config.limit) {
    const requestedPageSize = Math.min(config.pageSize, config.limit - workouts.length);
    const page = await client.fetchMissingWorkouts({
      afterId: cursor,
      limit: requestedPageSize,
      workoutIds: []
    });
    workouts.push(...page);

    if (page.length < requestedPageSize) {
      break;
    }
    cursor = page.at(-1)?.id ?? null;
    if (!cursor) {
      break;
    }
  }

  return workouts;
}

function summarize(results) {
  return results.reduce((counts, result) => {
    counts[result.status] = (counts[result.status] ?? 0) + 1;
    return counts;
  }, {});
}

async function appendGitHubSummary(report) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) {
    return;
  }

  const lines = [
    "## Video proof thumbnail backfill",
    "",
    `- Mode: \`${report.mode}\``,
    `- Scanned: **${report.scanned}**`,
    ...Object.entries(report.summary).map(([status, count]) => `- ${status}: **${count}**`),
    ""
  ];
  await writeFile(summaryPath, `${lines.join("\n")}\n`, { flag: "a" });
}

export async function main(argv = process.argv.slice(2)) {
  const config = parseArgs(argv);
  if (config.help) {
    printHelp();
    return;
  }

  const supabaseUrl = process.env.STAGING_SUPABASE_URL?.replace(/\/+$/, "");
  const privilegedKey =
    process.env.STAGING_SUPABASE_SECRET_KEY ??
    process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !privilegedKey) {
    throw new Error(
      "STAGING_SUPABASE_URL and a staging secret/service-role key are required"
    );
  }
  const expectedProjectRef =
    process.env.STAGING_SUPABASE_PROJECT_REF ?? "upwcpcjjfggdcmizgbka";
  validateStagingUrl(supabaseUrl, expectedProjectRef);

  const client = new SupabaseRestClient(supabaseUrl, privilegedKey);
  const workouts = await collectWorkouts(client, config);
  const results = [];

  for (const workout of workouts) {
    try {
      const result = await processWorkout(client, workout, config);
      results.push(result);
      console.log(`${result.status}: ${workout.id}`);
    } catch (error) {
      results.push(resultFor(workout, "failed", { error: error.message }));
      console.error(`failed: ${workout.id}: ${error.message}`);
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    supabaseOrigin: new URL(supabaseUrl).origin,
    mode: config.mode,
    limit: config.limit,
    frameSeconds: config.frameSeconds,
    targetedWorkoutIds: config.workoutIds,
    scanned: results.length,
    summary: summarize(results),
    results
  };
  await writeFile(config.outputFile, `${JSON.stringify(report, null, 2)}\n`);
  await appendGitHubSummary(report);
  console.log(`Report written to ${config.outputFile}`);

  if (results.some((result) => ["failed", "missing_source"].includes(result.status))) {
    process.exitCode = 1;
  }
}

const isEntryPoint =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntryPoint) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
