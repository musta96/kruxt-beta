# KRUXT Database Package

Contains Supabase/Postgres SQL migrations and smoke tests.

## Files

- `supabase/migrations/202602190001_krux_beta_foundation.sql`: full foundation schema
- `supabase/seeds/001_feature_flags.sql`: feature-flag defaults
- `tests/rls_smoke.sql`: checks expected policy coverage by naming convention

## Apply

Use Supabase CLI or SQL editor to run migration in order.
