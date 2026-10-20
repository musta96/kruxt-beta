# Security and Privacy Readiness

Reviewed: 2026-10-19. Tracking: #133. **Release hold remains in place.**

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
- New web/native workout forms and the mobile payload fallback default private.
  Existing records and explicit sharing choices are unchanged. Database/profile
  public defaults and historical clients require a separate forward migration
  review; this client patch is not a complete privacy-default enforcement layer.

## Open Security and Rights Findings

| ID | Priority | Evidence / Remaining Work |
| --- | --- | --- |
| PRIV-01 | P1 | `transition_privacy_request` accepts shared-gym staff and can fulfill without a successful export/delete job. Add request-specific authorization and worker-only terminal completion, including direct-table paths. |
| PRIV-02 | P1 | Export URL fields are cleared during anonymization, but issued Storage URLs/objects are not revoked or expired by this path. Delete export objects and verify saved URL denial; define retry-safe cleanup. |
| PRIV-03 | P1 | Erasure omits support identifiers/correspondence and leaves the Auth identity/access state active. Define reviewed retention exceptions, redact unretained data, revoke sessions and enforce account disablement. Do not claim completed erasure first. |
| PRIV-04 | P2 | The fixed export inventory omits support tickets/messages. Add subject-scoped correspondence with internal/third-party redaction; verify completeness across all current tables. |
| SEC-01 | P1 | Invitation privilege escalation and recipient magic-link disclosure require handler fixes and negative regressions. Verify previously issued tokens and email-delivery failure behavior. |
| SEC-02 | P1 | Machine boundary containment needs deployed Deno/gateway tests and scheduler compatibility checks; local mocks do not establish hosted enforcement. |
| DEP-01 | High | Production dependency audit reports 4 critical, 99 high, 53 moderate, 7 low advisory entries. These are registry classifications, not confirmed reachable vulnerabilities. Triage Next.js 14.2.35 and Expo/build transitive dependencies and migrate to supported patched versions with full builds/device tests. |
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

The backend was reported inactive at the previous availability check. Restoration
alone will not deploy these repairs or satisfy any gate above.

## Verification and Limits

Run local tests with `node --test packages/db/tests/worker-security.test.mjs`
and `pnpm --filter @kruxt/mobile test`. The first executes real handler source
with mocked transports/auth dependencies; it is not a real gateway or RLS test.
The second includes a behavioral private-draft default regression. Run all
database/tooling Node tests and configured package typechecks after integration.

Full ordered PostgreSQL contracts from the readiness rehearsal remain useful
baseline evidence, but must be extended for the new privacy authorization cases.
Deno is not installed locally; hosted Edge runtime checks have not run.
Dependency scan: `pnpm audit --prod --json`, exit 1 (advisories), current lockfile.
No dependency upgrades have been applied by this initial pass.

Hosted rules of engagement are in `docs/security/hosted-dev-test-scope.md` and
are **not approved for execution**.

## Authoritative Guidance

- [EDPB: Individual rights](https://www.edpb.europa.eu/sme/be-compliant/respect-individuals-rights_en)
- [EDPB: Securing personal data and assessing risk](https://www.edpb.europa.eu/sme/be-compliant/secure-personal-data_en)
- [OWASP WSTG v4.2](https://wstg.owasp.org/v4.2/4-Web_Application_Security_Testing/)
- [Supabase Edge authentication](https://supabase.com/docs/guides/functions/auth)

These sources guide the work; they do not certify this implementation.
