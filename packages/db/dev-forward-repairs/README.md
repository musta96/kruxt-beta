# Reviewed DEV Forward Repairs

These target-specific scripts are deliberately outside both automatic migration
directories. They are not a substitute baseline or a migration-history repair.
Do not copy them into a bulk `db push` or replay old migrations to satisfy them.

## Legacy Workout Visibility Fallback

`20261024004407_legacy_workout_private_fallback.sql` was generated with the
Supabase migration CLI, then moved here before hosted application. Only this
new file's timestamp was aligned with the server-recorded applied version.

Target: DEV `hgomsmhsybrxjdxbgkjy`. Status: **owner-approved, applied and verified
2026-10-24**. No other target or application was changed.

History: 443 before, 444 after. The original 443 rows retained hash
`d1d8701d15e7893bbabfaff1a469ec40`. Hosted statement SHA-256:
`a8b38668052d7cd82c0f6d0dd6cee31a4382c412cc995b8a045f05d5e972adcb`.
The repaired function hash matches the exact expected value below. Its OID
(`29164`), owner, ACL, definer flag and search-path configuration are unchanged.

The script accepts only the reviewed `log_workout_atomic(jsonb,jsonb)` definition
SHA-256 `8d98619104af4e1326fdb032d16b938ed9813589a906c0a0dd9df520d43fb719`,
or the exact already-repaired revision
`d0966585137debea0ee5d685d23c6d5d1c05a929ee9862d957a5c313b7b90963`.
It replaces one visibility fallback expression, preserving explicit choices,
the function OID, owner, grants, search path and other behavior. No application
records are selected or modified by the repair. Authentication enforcement is
unchanged. It does not add retry receipts, social block guards, session revocation
or any other feature from the unreconciled package migrations.

Apply only through an explicit transaction in the approved DEV project, after
rechecking the function fingerprint and the migration-history hash. Use the
Supabase `apply_migration` tool so the server appends a real history entry.
Re-read the version, statement hash and function definition afterward; preserve
the old ledger exactly. A changed function definition must stop the repair,
not cause a new accepted fingerprint to be added without review.

The disposable full-consent runner checks this repair immediately after the
real baseline, inside rollback-only transactions. It verifies omitted and JSON
null visibility, explicit public/private choices, invalid-input rollback,
anonymous denial, unchanged existing rows/OID/ACL/config, idempotent replay and
refusal of an unexpected function definition. It then applies the ordinary
package migration chain and its existing contracts. This is evidence for the
narrow function delta, **not** a faithful clone upgrade of all hosted DEV schema.

Reference: [Supabase database functions](https://supabase.com/docs/guides/database/functions).
