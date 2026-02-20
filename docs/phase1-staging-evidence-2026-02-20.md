# Phase 1 Staging Evidence (2026-02-20)

## Context

- Project ref: `hgomsmhsybrxjdxbgkjy`
- UTC capture time: `2026-02-20T11:29:06Z`
- Scope: close Phase 1 staging verification follow-up (`#24`)

## Commands Run

1. Apply staging schema and seed
   - `./scripts/bootstrap.sh`
2. Confirm remote migration history tail
   - `supabase migration list --linked | tail -n 12`
3. Execute repository RLS smoke SQL against staging
   - `psql -v ON_ERROR_STOP=1 -f packages/db/tests/rls_smoke.sql`
4. Validate service-only table write boundaries as authenticated non-service role
   - SQL probe with:
     - `set role authenticated;`
     - `set_config('request.jwt.claim.role', 'authenticated', true);`
     - attempted inserts into:
       - `public.integration_webhook_events`
       - `public.event_outbox`

Note: temporary DB credentials were obtained via `supabase db dump --dry-run` at runtime and were not persisted in repo.

## Evidence Summary

### 1) Migration and seed apply in staging

`./scripts/bootstrap.sh` completed successfully and applied:

- `202602190413_krux_beta_part4_s072.sql`
- `202602190414_krux_beta_part4_s073.sql`

Result line:

- `Done. KRUXT foundation schema + seed are applied.`

### 2) Remote migration history includes latest versions

`supabase migration list --linked` tail:

- `202602190412 | 202602190412`
- `202602190413 | 202602190413`
- `202602190414 | 202602190414`

### 3) RLS smoke checks pass

Running `packages/db/tests/rls_smoke.sql` against staging completed with:

- `DO`

This indicates the smoke DO block passed without raising exceptions.

### 4) Service-only tables reject non-service writes

Authenticated non-service probe results:

- `event_outbox` -> blocked = `true`, error = `new row violates row-level security policy for table "event_outbox"`
- `integration_webhook_events` -> blocked = `true`, error = `new row violates row-level security policy for table "integration_webhook_events"`

## Conclusion

Phase 1 staging verification criteria are satisfied for this follow-up:

- staging migration/seed apply: pass
- latest migration sequence present remotely: pass
- RLS smoke checks: pass
- service-only write boundaries (non-service role): pass
