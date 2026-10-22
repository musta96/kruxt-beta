# Privacy Worker Operations

Local repair state: 2026-10-21. Not deployed. Requires migrations
`20261019140050_privacy_state_authorization` and
`20261020233833_privacy_export_inventory_and_defaults` and
`20261021154255_privacy_erasure_account_disablement`, after the full readiness
migration set. Do not replay historical baseline SQL on a hosted database.

## Default State

Authenticated subjects can submit/read requests. The trusted machine worker can
triage and track deadlines. Export and erasure queue/claim operations are disabled
by default and do not consume retries while review is outstanding. Disabled
fulfillment must be visible to the operator; it is not permission to ignore
requests or suspend response deadlines. Use a reviewed manual rights workflow.

Only after the responsible operator has documented the complete data inventory,
retention exceptions, export content/redaction, session/account handling and
successful end-to-end tests may deployment configuration attest a version:

- `PRIVACY_REVIEWED_INVENTORY_VERSION`: reviewed version, for example `v1`.
- `PRIVACY_EXPORT_READY_INVENTORY_VERSION`: exact same version enables export.
- `PRIVACY_OPERATOR_REVIEWED_ERASURE_INVENTORY_VERSION`: exact same version
  enables erasure, independently of export.

Do not set these merely to make a health check green. No values were enabled by
this change. An env attestation is not a substitute for legal/privacy approval.
Changing the inventory version disables stale attestations automatically.

## Storage Lifecycle

- New upload paths are generated from validated subject/request/job UUIDs.
- Failed signing/completion removes only that attempt's uploaded object. Failed
  cleanup records `export_cleanup_required`; operator follow-up remains necessary.
- With reviewed processing enabled, each run considers at most 100 expired
  completed packages. Exact bucket/path validation precedes deletion, legal holds
  are respected, and clearing job storage fields checkpoints successful removal.
- Erasure scans only the subject's UUID prefix and expected request/job layout,
  capped at 26 lists and 500 entries. Oversized/unknown layouts need manual review;
  they cannot silently produce completion. Failed/partial removals block erasure.
- A valid future-expiry completed export job is required by the owner Storage
  SELECT policy. Signed-URL/CDN revocation must still be verified on hosted DEV.
- Legal holds are rechecked before removals and anonymization. There remains no
  distributed transaction spanning Storage and SQL; concurrency and partial
  failure recovery need hosted synthetic-data testing before enablement.

## Known Completion Limits

The added export projection includes subject-owned support correspondence and
excludes internal notes, staff labels and arbitrary metadata. Attachment counts
are included, not attachment binaries; the full attachment/retention inventory is
still pending. Legacy export projections for workout-set timestamps and check-in
notes are repaired and executed by the SQL regression.

The worker now applies a 100-year Auth ban through the admin API before SQL
anonymization, verifies the returned subject and future ban expiry, and stops on
failure. The SQL wrapper disables the application profile in the anonymization
transaction; the legacy implementation is no longer callable by service clients.
Legal holds are checked before these steps. No Auth identity is cascade-deleted.
If SQL anonymization or completion fails after the ban, the account remains banned;
retries must not automatically unban it. Investigate partial failures manually.

This is account containment, **not session revocation or complete Auth erasure**.
The ban does not delete sessions; already-issued access tokens can survive until
expiry. Immediate denial still needs server-side session/revocation enforcement
across RLS, RPCs, Storage and Edge routes, followed by actual Auth integration tests.
Auth identifiers and support/billing/legal retention remain unresolved. **Keep
erasure attestation unset** until these repairs and operator decisions are complete.
Machine authorization and a successful call do not establish lawful erasure.

Sources: [Admin update API](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid),
[GoTrue v2.197.0 ban implementation](https://github.com/supabase/auth/blob/v2.197.0/internal/models/user.go),
[Session revocation limits](https://supabase.com/docs/guides/auth/sessions).

## Checks

- `pnpm security:test`: negative Edge authorization, invitation, privacy lifecycle,
  login error redaction, health-check, deployment-guard and mobile regressions.
- `bash packages/db/tests/run_consent_contract.sh`: disposable real PostgreSQL
  stack plus consent/activation, privacy ACL/trigger, support export and Storage
  expiry/isolation contracts. It can use an explicitly supplied empty CI database.
- `.github/workflows/security-privacy.yml`: proposed CI gates; no hosted CI run
  exists until this local branch is reviewed and published.
