# Security and Privacy Readiness

Reviewed: 2026-10-22. Tracking: #133. **Release hold remains in place.**

This is an initial source audit and local regression pass, not a GDPR
certification, completed independent penetration test, or guarantee against
attack. Findings below are sensitive: keep this branch local until fixes and
disclosure timing have been reviewed. Hosted deployment parity is unverified.

## Implemented Containment

- Six global Edge entrypoints now accept only the configured server-side
  `SUPABASE_SERVICE_ROLE_KEY` bearer credential: privacy processing, provider
  ingestion, sync dispatch, rank recomputation, audit ingestion and incident
  notification. Ordinary user authentication is not machine authorization.
- The guard compares SHA-256 digests and fails closed without configuration;
  it does not trust caller-provided JWT role claims. Existing gateway JWT checks
  remain enabled. This preserves the existing legacy service-role scheduler
  contract, not arbitrary modern secret-key transport support.
- Provider ingestion is now an internal trusted-adapter endpoint. Do not give
  providers or mobile clients the service credential. Public provider signature,
  freshness and immutable replay-binding verification are still not implemented;
  direct provider delivery must remain disabled until they are.
- Audit ingestion is machine-only; caller-selected actors may be supplied only
  by trusted backend integrations. User actions should emit server-authored
  audit events through their authorized business transaction.
- Incident force-drill cannot consume the global queue. Undelivered live jobs
  follow the failure/retry path rather than being marked successful. The current
  notifier is still a stub; real incident delivery is not operationally proven.
- New web/native workout forms, mobile fallback, database profile/workout defaults
  and omitted-visibility workout RPC calls now default private. Existing records
  and explicit sharing choices are unchanged. Forward SQL regressions pass.
- Invitation owner/issuer boundaries and recipient-only magic-link delivery are
  repaired and covered by actual-handler mocked tests.
- Privacy state RPC/table writes are worker-owned. Real PostgreSQL negative tests
  pass, while authenticated intake/read remains functional.
- Export/erasure fulfillment defaults off until a versioned inventory attestation.
  Cleanup, expiry and legal-hold behavior is locally tested. See
  `docs/security/privacy-worker-operations.md` for enablement limits.

## Open Security and Rights Findings

| ID | Priority | Evidence / Remaining Work |
| --- | --- | --- |
| PRIV-01 | Contained locally | Transition RPC/client writes revoked, defense-in-depth trigger tested in real PostgreSQL. Worker-only completion remains trusted; complete-job consistency needs broader review. |
| PRIV-02 | Repaired locally; hosted retest pending | Failed-upload cleanup, bounded expiry/subject cleanup and expiry-bound Storage policy implemented. Verify saved signed URLs/CDN behavior and concurrency on approved hosted DEV fixtures. |
| PRIV-03 | P1; partial containment | Worker requires a confirmed long-lived Auth ban before anonymization; SQL atomically disables the profile. Existing JWT/session revocation, retained Auth identifiers and support/billing/legal retention are unresolved. Define retention exceptions, redact unretained data and verify immediate access denial. Automatic erasure remains off. |
| PRIV-04 | Partial repair | Support tickets/customer-visible messages now exported; internal notes/metadata excluded. Legacy missing-column failures repaired. Attachment binaries and full-table completeness still require inventory review; automatic export remains gated. |
| SEC-01 | Repaired locally | Owner/founder invitation boundaries, legacy issuer revalidation and no magic-link response disclosure pass 10 handler regressions; hosted retest pending. |
| SEC-02 | P1 | Machine boundary containment needs deployed Deno/gateway tests and scheduler compatibility checks; local mocks do not establish hosted enforcement. |
| DEP-01 | High; partial repair | Local Next.js 15.5.28 and shell-quote 1.11.0 repairs remove their advisories. Audit now reports 1 critical, 91 high, 45 moderate, 6 low registry entries, not proven reachable exploits. Expo CLI's tar dependency remains critical; dependency CI stays blocked. See `docs/security/dependency-upgrade-checkpoint.md`. |
| SEC-03 | Review | Complete RLS/storage/tenant matrix, expired/revoked token behavior, admin MFA, rate limits, input limits, upload formats, headers/CSP, secret rotation and logging/redaction tests. These were not comprehensively verified in this pass. |

No exploit details or secrets were posted to the public tracking issue. No live
exploitation, real-user data access, brute force or destructive scan ran.

## Preliminary Data Inventory

This table is a starting point, not a complete record of processing activities.
Every row needs an accountable controller, purpose, lawful basis, recipients,
processor agreement, transfer safeguards and approved retention/deletion rule.

| Data | Repository Evidence | Required Decision / Verification |
| --- | --- | --- |
| Identity, login, profiles, invitations | Auth and profile/invitation services | Identity lifecycle, age eligibility, MFA/admin access, invitation retention |
| Workouts, proof photos/videos, fitness/provider measurements | Workout services, Storage, integration workers | Health-data classification and Article 9 condition where applicable; visibility, minimization and withdrawal effects |
| Gym memberships, roles, bookings, check-ins | Admin services, membership/class RPCs | Gym/platform controller roles, tenant access boundaries and retention |
| Payments, subscriptions, invoices | Billing/profile services | Payment processors, required fiscal retention and access restrictions |
| Consent evidence and policy versions | Consent RPCs, policy tracking | Approved notices/bases and easy withdrawal; consent is not a substitute for every lawful-basis decision |
| Support tickets, messages, attachments | Support tables/services | Subject export, internal-note/third-party redaction, retention and erasure |
| Audit/security/incident logs | Audit and incident functions | Minimal fields, restricted access, integrity, approved retention and breach procedure |
| Rights requests, export packages, deletion jobs, legal holds | Privacy tables/worker | One-month response workflow, proportionate identity check, object expiry and end-to-end completion evidence |
| Local caches, drafts, telemetry and backups | Clients and hosting configuration | Inventory unknown SDKs/cookies, account isolation, local cleanup and backup lifecycle |

## Organisational Release Gates

These require owner/privacy-counsel decisions and evidence, not code-only claims:

1. Confirm controller/processor roles for KRUXT and each gym; complete the
   processing inventory, purpose/basis register and retention schedule.
2. Assess health data, profiling, minors and DPIA requirements. Complete any
   required DPIA before the relevant processing starts; document the reasoning.
3. Approve actual Terms, privacy/health notices, processor agreements, subprocessor
   list, hosting/transfer safeguards and any required consent/withdrawal journey.
4. Verify access, correction, export, erasure, restriction and objection flows,
   legal holds, deadlines, recipient notification and denied-request reasons.
5. Define incident ownership, assessment/escalation, regulatory/data-subject
   notification procedure and tested restore/recovery; do not rely on stub email.
6. Complete the independent scoped penetration test, remediate/retest findings
   and record signed residual-risk acceptance before inviting real testers.

DEV was restored and verified `ACTIVE_HEALTHY` with Auth health/settings HTTP 200
on 2026-10-21. Restoration did not deploy these repairs or satisfy release gates.

## Verification and Limits

Run local tests with `node --test packages/db/tests/worker-security.test.mjs`
and `pnpm --filter @kruxt/mobile test`. The first executes real handler source
with mocked transports/auth dependencies; it is not a real gateway or RLS test.
The second includes a behavioral private-draft default regression. Run all
database/tooling Node tests and configured package typechecks after integration.

The full ordered PostgreSQL stack now passes privacy ACL/trigger, export
projection/subject-isolation and Storage expiry regressions as well as the
existing consent/activation contracts. `pnpm security:test` passes 53 Node checks
and 12 mobile tests. Login connection-error recovery was verified in the isolated
local browser preview using disposable fixture inputs.
Deno is not installed locally; hosted Edge runtime checks have not run.
Dependency scan: `pnpm audit --prod --json`, exit 1 (advisories), current lockfile.
Next.js and its ESLint configuration are pinned to 15.5.28 in this local upgrade
branch. All three builds and four loopback-only browser regressions pass. See the
dependency checkpoint for the unchanged native versions and remaining advisories.

Automated CI is authored locally, not yet published or run on GitHub. The
dependency-advisory gate is expected to remain red until upgrade/triage work is
complete. A minimal redacted/manual health checker is available; no telemetry
provider, recurring monitor or notification recipient has been configured.

Hosted rules of engagement are in `docs/security/hosted-dev-test-scope.md` and
are **not approved for execution**.

## Authoritative Guidance

- [EDPB: Individual rights](https://www.edpb.europa.eu/sme/be-compliant/respect-individuals-rights_en)
- [EDPB: Securing personal data and assessing risk](https://www.edpb.europa.eu/sme/be-compliant/secure-personal-data_en)
- [OWASP WSTG v4.2](https://wstg.owasp.org/v4.2/4-Web_Application_Security_Testing/)
- [Supabase Edge authentication](https://supabase.com/docs/guides/functions/auth)

These sources guide the work; they do not certify this implementation.
