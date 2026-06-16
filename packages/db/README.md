# KRUXT Database Package

Contains Supabase/Postgres SQL migrations and smoke tests.

## Files

- `supabase/migrations/`: ordered migration set for full KRUXT foundation schema
- `supabase/seeds/001_feature_flags.sql`: feature-flag defaults
- `tests/rls_smoke.sql`: checks expected policy coverage by naming convention
- `scripts/backfill-video-proof-thumbnails.mjs`: bounded staging backfill for
  poster images on legacy video proofs; see
  `../../docs/video-proof-thumbnail-backfill.md`

## Apply

Run `./scripts/bootstrap.sh` from repo root. It syncs these SQL files into the
Supabase CLI default locations (`supabase/migrations`, `supabase/seed.sql`) and
executes `supabase db push --include-seed`.
