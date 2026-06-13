# Video Proof Thumbnail Backfill

Use the manual `backfill-video-proof-thumbnails` GitHub Actions workflow to
create poster images for video proofs that predate thumbnail generation.

## Safety Model

- The job only accepts staging credentials: `STAGING_SUPABASE_URL` and
  `STAGING_SUPABASE_SERVICE_ROLE_KEY`.
- The script also verifies the URL resolves to the known staging project
  `upwcpcjjfggdcmizgbka`, preventing a production credential mix-up.
- `dry-run` is the default and does not upload or update anything.
- `apply` requires the exact confirmation value `BACKFILL`.
- The scan is bounded by `limit`, can target explicit workout UUIDs, and is
  idempotent. Existing thumbnail objects are reused.
- Workout rows are updated only while `proof_media_thumbnail_url` is still
  null, so a newer client or concurrent job wins.
- Each run uploads a JSON report artifact and writes a GitHub job summary.

Do not configure these staging-prefixed secrets with production credentials.

## First Run

1. Add the two staging secrets in GitHub repository settings.
2. Open **Actions > backfill-video-proof-thumbnails > Run workflow**.
3. Keep `mode` set to `dry-run` and use a small limit such as `10`.
4. Review the job summary and downloaded JSON report.
5. Run again with `mode=apply` and `confirm=BACKFILL`.
6. Re-run in `dry-run`; a completed batch should scan zero matching workouts.

For a single known record, pass its UUID in `workout_ids`. Multiple IDs are
comma-separated, with a maximum of 100.

## Local Verification

The focused tests need only Node.js. The frame extraction test runs when
`ffmpeg` is installed and otherwise reports as skipped.

```sh
node --test packages/db/tests/backfill-video-proof-thumbnails.test.mjs
```

The backfill itself requires staging credentials:

```sh
STAGING_SUPABASE_URL="https://..." \
STAGING_SUPABASE_SERVICE_ROLE_KEY="..." \
node packages/db/scripts/backfill-video-proof-thumbnails.mjs \
  --mode dry-run \
  --limit 10
```

The generated poster path matches the mobile app convention:
`<user_id>/<workout_id>_thumb.jpg` in the public `workout-proof` bucket.
