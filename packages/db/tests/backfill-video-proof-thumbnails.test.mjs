import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  buildPrivilegedHeaders,
  chooseSourceObject,
  extractVideoFrame,
  parseArgs,
  parseProofObjectPath,
  parseWorkoutIds,
  publicObjectUrl,
  sourceBelongsToWorkout,
  validateStagingUrl
} from "../scripts/backfill-video-proof-thumbnails.mjs";

const USER_ID = "082804b4-6f4d-45f6-a05d-a9c28a8a77de";
const WORKOUT_ID = "0f349f70-d50c-48ba-8b24-dd5db475b903";
const OTHER_WORKOUT_ID = "ed38cfeb-40fa-43bb-9dbc-82f68ef70f77";
const SUPABASE_URL = "https://example.supabase.co";

test("parseArgs defaults to a bounded dry run", () => {
  assert.deepEqual(parseArgs([]), {
    mode: "dry-run",
    limit: 100,
    pageSize: 50,
    frameSeconds: 0,
    outputFile: "video-proof-thumbnail-backfill-report.json",
    workoutIds: []
  });
});

test("parseArgs accepts explicit apply options", () => {
  assert.deepEqual(
    parseArgs([
      "--mode",
      "apply",
      "--limit",
      "12",
      "--page-size",
      "4",
      "--frame-seconds",
      "1.5",
      "--workout-ids",
      `${WORKOUT_ID},${OTHER_WORKOUT_ID}`,
      "--output-file",
      "report.json"
    ]),
    {
      mode: "apply",
      limit: 12,
      pageSize: 4,
      frameSeconds: 1.5,
      outputFile: "report.json",
      workoutIds: [WORKOUT_ID, OTHER_WORKOUT_ID]
    }
  );
});

test("parseArgs rejects unsafe ranges and unknown arguments", () => {
  assert.throws(() => parseArgs(["--limit", "0"]), /between 1 and 1000/);
  assert.throws(() => parseArgs(["--frame-seconds", "61"]), /between 0 and 60/);
  assert.throws(() => parseArgs(["--surprise", "yes"]), /Unknown argument/);
});

test("parseWorkoutIds validates, trims, and deduplicates UUIDs", () => {
  assert.deepEqual(
    parseWorkoutIds(` ${WORKOUT_ID},${WORKOUT_ID}, ${OTHER_WORKOUT_ID} `),
    [WORKOUT_ID, OTHER_WORKOUT_ID]
  );
  assert.throws(() => parseWorkoutIds("not-a-uuid"), /Invalid workout UUID/);
});

test("publicObjectUrl safely encodes path segments", () => {
  assert.equal(
    publicObjectUrl(SUPABASE_URL, `${USER_ID}/proof frame.jpg`),
    `${SUPABASE_URL}/storage/v1/object/public/workout-proof/${USER_ID}/proof%20frame.jpg`
  );
  assert.throws(() => publicObjectUrl(SUPABASE_URL, "../secret"), /Unsafe storage object path/);
});

test("parseProofObjectPath only accepts the expected origin and bucket", () => {
  const validUrl = `${SUPABASE_URL}/storage/v1/object/public/workout-proof/${USER_ID}/${WORKOUT_ID}.mp4`;
  assert.equal(
    parseProofObjectPath(validUrl, SUPABASE_URL),
    `${USER_ID}/${WORKOUT_ID}.mp4`
  );
  assert.equal(
    parseProofObjectPath(
      `https://other.supabase.co/storage/v1/object/public/workout-proof/${USER_ID}/${WORKOUT_ID}.mp4`,
      SUPABASE_URL
    ),
    null
  );
  assert.equal(
    parseProofObjectPath(
      `${SUPABASE_URL}/storage/v1/object/public/other-bucket/${USER_ID}/${WORKOUT_ID}.mp4`,
      SUPABASE_URL
    ),
    null
  );
  assert.equal(parseProofObjectPath("not a URL", SUPABASE_URL), null);
  assert.equal(
    parseProofObjectPath(
      `${SUPABASE_URL}/storage/v1/object/public/workout-proof/%E0%A4%A`,
      SUPABASE_URL
    ),
    null
  );
});

test("chooseSourceObject selects a video and ignores thumbnails and images", () => {
  assert.equal(
    chooseSourceObject(
      [
        { name: `${WORKOUT_ID}_thumb.jpg` },
        { name: `${WORKOUT_ID}.jpg` },
        { name: `${WORKOUT_ID}.mp4` },
        { name: `${OTHER_WORKOUT_ID}.mov` }
      ],
      WORKOUT_ID
    ),
    `${WORKOUT_ID}.mp4`
  );
  assert.equal(chooseSourceObject([{ name: `${WORKOUT_ID}.jpg` }], WORKOUT_ID), null);
});

test("sourceBelongsToWorkout rejects cross-user and cross-workout paths", () => {
  assert.equal(
    sourceBelongsToWorkout(`${USER_ID}/${WORKOUT_ID}.mp4`, USER_ID, WORKOUT_ID),
    true
  );
  assert.equal(
    sourceBelongsToWorkout(`${USER_ID}/${OTHER_WORKOUT_ID}.mp4`, USER_ID, WORKOUT_ID),
    false
  );
  assert.equal(
    sourceBelongsToWorkout(
      `11111111-1111-4111-8111-111111111111/${WORKOUT_ID}.mp4`,
      USER_ID,
      WORKOUT_ID
    ),
    false
  );
});

test("validateStagingUrl only accepts the configured HTTPS project", () => {
  assert.equal(
    validateStagingUrl(
      "https://upwcpcjjfggdcmizgbka.supabase.co/",
      "upwcpcjjfggdcmizgbka"
    ),
    "https://upwcpcjjfggdcmizgbka.supabase.co"
  );
  assert.throws(
    () =>
      validateStagingUrl(
        "https://hgomsmhsybrxjdxbgkjy.supabase.co",
        "upwcpcjjfggdcmizgbka"
      ),
    /Refusing to run/
  );
  assert.throws(
    () =>
      validateStagingUrl(
        "http://upwcpcjjfggdcmizgbka.supabase.co",
        "upwcpcjjfggdcmizgbka"
      ),
    /Refusing to run/
  );
});

test("buildPrivilegedHeaders supports modern secret and legacy service-role keys", () => {
  assert.deepEqual(
    buildPrivilegedHeaders("sb_secret_example_checksum", {
      "Content-Type": "application/json"
    }),
    {
      apikey: "sb_secret_example_checksum",
      "Content-Type": "application/json"
    }
  );

  const jwt = "header.payload.signature";
  assert.deepEqual(buildPrivilegedHeaders(jwt), {
    apikey: jwt,
    Authorization: `Bearer ${jwt}`
  });
  assert.throws(() => buildPrivilegedHeaders("sb_publishable_public"), /must be/);
});

test(
  "extractVideoFrame creates a non-empty JPEG when ffmpeg is available",
  { skip: spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status !== 0 },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), "kruxt-proof-thumb-test-"));
    const videoFile = join(directory, "sample.mp4");
    const thumbnailFile = join(directory, "thumbnail.jpg");

    try {
      const generated = spawnSync(
        "ffmpeg",
        [
          "-hide_banner",
          "-loglevel",
          "error",
          "-y",
          "-f",
          "lavfi",
          "-i",
          "color=c=0x22d3ee:s=320x180:d=1",
          "-pix_fmt",
          "yuv420p",
          videoFile
        ],
        { encoding: "utf8" }
      );
      assert.equal(generated.status, 0, generated.stderr);

      assert.equal(
        await extractVideoFrame({
          sourceFile: videoFile,
          outputFile: thumbnailFile,
          frameSeconds: 0.5,
          spawnProcess: spawn
        }),
        0.5
      );

      const thumbnail = await readFile(thumbnailFile);
      assert.ok(thumbnail.byteLength > 100);
      assert.equal(thumbnail[0], 0xff);
      assert.equal(thumbnail[1], 0xd8);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
);
