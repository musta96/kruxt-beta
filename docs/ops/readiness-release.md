# Coordinated Readiness Release

Target: DEV Supabase project `hgomsmhsybrxjdxbgkjy`. This is a release plan,
not deployment authorization or evidence that the hosted system passed UAT.

## Hold Points

- Do not auto-promote the product PRs independently: #118 needs new staff RPCs,
  #131 needs consent/profile RPCs and the new activation Edge implementation,
  and #130 needs the native onboarding RPCs.
- Database-first is not zero-downtime either: migration 006 revokes direct
  writes used by older staff clients. Use a maintenance window with affected
  journeys inaccessible, or ship a separately reviewed compatibility release.
- Prepare one integrated, tested release revision. Pause automatic production
  promotion before merging product PRs. Preview build success does not prove
  backend compatibility or authenticate a user journey.
- Obtain approved immutable policy documents/checksums and exact runtime env
  configuration before reopening registration and consent-dependent journeys.

## Migration History Reconciliation

The package migration source and root CLI migration tree currently differ,
including historical baseline files. **Do not copy one over the other.** The
deployment guards deliberately refuse this state without changing files.

An authorized database operator must compare both trees with the linked DEV
project's actual migration history and schema. Account for every root-only and
source-only migration, record applied versions and content hashes, and review
which migrations are really pending. Do not execute the baseline again against
an existing schema or replay historical demo seeds as a reconciliation shortcut.
If an older revision of an already-applied migration differs, add a reviewed
forward repair migration. Changing its local file does not repair the remote DB.

Commit the reviewed migration layout, rerun the full PostgreSQL contracts, and
keep the two trees identical before using these guarded entrypoints. A passing
local preflight checks files, not remote history, schema, or migration hashes.

## Operator Sequence

1. Review the exact release SHA, CI, all previews, maintenance access controls,
   database backup/recovery plan, and migration-history report.
2. Run `bash scripts/bootstrap.sh` and `bash scripts/deploy_functions.sh`.
   These default to local-only checks; neither runs a remote command.
3. Link this reviewed checkout to canonical DEV. With operator authorization,
   run `bash scripts/bootstrap.sh --dry-run --confirm-dev-project hgomsmhsybrxjdxbgkjy`.
   Review every proposed migration, including historical entries introduced by
   `--include-all`. A clean dry run does not approve an apply.
4. During the authorized maintenance window, apply the reviewed plan using
   `bash scripts/bootstrap.sh --apply --confirm-dev-project hgomsmhsybrxjdxbgkjy`.
   The coordinated release includes 202608030001 through 202608030006 in order.
   Stop on any failure; earlier migrations may already have committed.
5. Verify the deployed RPCs, grants, migration history and policy-publication
   contract. Then run `bash scripts/deploy_functions.sh --apply --confirm-dev-project hgomsmhsybrxjdxbgkjy`.
   This includes the exact slug `complete-profile-activation` and pins DEV
   explicitly. Preserve the function's authentication configuration.
6. Promote matching web/admin/platform builds and distribute matching native
   code. Validate the deferred class-window constraint in a separate transaction
   using `packages/db/tests/README.class-postgres.md`.
7. Publish approved bound policies, verify URLs/CORS and real runtime envs, then
   run separately reviewed purge and strict four-account UAT. Complete the
   physical-device athlete journey before inviting real testers.

The scripts never auto-include seed data. Existing `supabase/seed.sql` and both
migration trees are left untouched, including after CLI failures. Tests use a
fake CLI: `node --test scripts/deployment-guard.test.mjs`.

## Recovery

Do not roll back only the frontend after migration 006: old clients will still
hit revoked direct-write permissions. Prefer a forward repair while access is
held. Do not restore permissive grants as a shortcut or independently restore
the old non-atomic activation Edge handler. Keep destructive purge outside the
deployment rollback boundary; it requires its own reviewed recovery plan.

Tracked follow-up: #132. Remote history/hash reconciliation, hosted verification
and promotion controls remain operator gates, not automated by these scripts.

CLI flags were checked against the installed CLI help and the
[Supabase CLI reference](https://supabase.com/docs/reference/cli/supabase-db-push).
