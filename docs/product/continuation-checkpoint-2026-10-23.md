# Continuation Checkpoint

Application changes remain local on codex/98-journey-design. No public push,
application deployment, operator grant or provider activation occurred.
On 2026-10-24, the owner-approved defaults-only DEV migration was applied;
see the verification record below.

## Completed Local Checks

- All three applications built and typechecked with inert loopback Auth config.
- Workout drafts are opt-in, viewer-scoped, versioned and bounded in tab storage,
  expire after 12 hours, and require explicit restore/discard. No files are
  persisted. Opt-out removes local content without requiring a working network.
- A stable submission identity survives uncertain retries. The server claims an
  owner-scoped idempotency key atomically, rejects changed payload reuse and
  avoids duplicate workout side effects on replay. Existing keyless clients
  retain compatibility and do not gain automatic deduplication.
- Targeted real PostgreSQL tests passed workout replay/concurrency/rollback and
  block-policy coverage for workout children, feed, interactions, follows and
  optional private media. Full ordered package migrations/privacy contracts
  passed too. These are not tests of an upgraded hosted schema or CDN revocation.
- Six desktop/mobile draft browser cases passed, including opt-in, explicit
  recovery, discarded sensitive content, uncertain retry identity, confirmed
  saves followed by failed uploads, and another viewer's storage boundary.
- The final existing desktop/mobile preview suite passed 66 cases. The expanded
  workspace suite passed 35 cases, including MFA and a real two-origin Chromium
  fixture using synthetic Auth clients. Journey and security commands also
  passed. Regression repairs removed duplicate save announcements and updated a
  navigation test boundary for the new URL/configuration helper.
- Named operator profiles have server-authorized CRUD, version checks,
  assignments, audit atomicity and authoritative access provenance. Founder
  identity, AAL2 and canonical edit permission are mandatory. Existing six roles
  remain. Profile scope is deliberately four read capabilities: tenants, flags,
  audit and system health. Broad arbitrary operator types are not complete.
- Profile PostgreSQL denial/concurrency tests and six service cases passed.
- Workspace URL validation and explicit clicked cross-origin handoff are local;
  see [boundaries](../security/workspace-switching-2026-10-23.md).

## Release Holds

1. Migration reconciliation is not complete. The verified DEV ledger has 442
   applied versions. Its metadata and stored-statement SHA-256 hashes are saved
   in [the ledger evidence](../security/evidence/dev-migration-ledger-2026-10-23.json).
   Offline comparison reports root 17/package 35 files, 421 baseline source
   markers and candidate mappings for every applied version, but no semantic
   equivalence proof. The gate correctly remains blocked. Never replay the
   baseline or mark aliases applied merely to make directories match.
2. Recurring classes now have locally implemented atomic publication, weekly
   time bands, holiday ranges, immutable replay receipts, subscriptions and
   recipient-scoped in-app announcements. Cancellation and its announcement
   commit together. Exact pending requests survive tab reload for 24 hours;
   expired content becomes a blocking identifier-only recovery record.
   Full PostgreSQL permission/concurrency contracts passed; four desktop/mobile
   publishing/recovery browser cases and 15 member-inbox cases passed.
   These features are not deployed. Email/push delivery, editing a whole published
   series, and hosted acceptance remain open.
3. Google and Apple remain disabled. Google credentials are blank. The owner
   agreed to open the provider accounts. Google Cloud and Apple Developer tabs
   were opened for owner handoff; the intended Google project is not confirmed.
   A subsequent browser check was blocked by the automatic approval service's
   usage limit. Credentials belong only in their dashboards.
4. The new optional health gate checks public Google/Apple enablement flags. It
   does not replace actual OAuth, cancellation, callback and account-linking tests.
5. Class/profile/workspace UI acceptance, Safari testing, hosted disposable
   multi-account tests, session revocation, independent security testing and
   GDPR operational/legal readiness remain open.

## Approved DEV Defaults Repair, 2026-10-24

- Target: kruxt-beta-dev (`hgomsmhsybrxjdxbgkjy`).
- Applied migration: `20261024003307_private_creation_defaults`.
- Verified `profiles.is_public` default `false` and `workouts.visibility` default
  `'private'::workout_visibility`. No data-changing statements were executed.
- Ledger count: 442 before, 443 after. Original-history hash before and after:
  `cee3faa8a3cb0dbfd6cbf736fd96ebac`.
- Hosted statement SHA-256:
  `cb3f7f338ab411256947371296ee5602ec3310948b61d8a30a7e70a9ed0bb189`.
- The server generated the applied version. Only the new local migration filename
  was aligned with it; no historical migration was renamed or marked applied.
- Existing rows are unchanged. Clients/RPCs explicitly choosing public remain
  public. The legacy DEV `log_workout_atomic` omitted-visibility path was repaired
  separately with explicit approval on October 24; see the follow-up below.
  Neither repair resolves the broader schema reconciliation release hold.

Four delegated agents completed their bounded implementation, catalog review,
browser tests and PostgreSQL contention checks. No broader schema or application
release was performed.

## October 24 Follow-Up

The separately approved DEV RPC repair is applied as `20261024004407` and verified.
Current ledger: 444 entries, with all prior entries unchanged. A fresh catalog
capture shows exactly the two default changes and the single RPC SQL change in
the captured object families. Details and remaining release holds are in
[the verification record](../security/dev-privacy-verification-2026-10-24.md).

Google project `gym-app-bbeb9` (Gym app) is owner-confirmed for KRUXT. Its Google
Auth Platform was not configured; the setup form is open for guided owner
completion. Apple is signed in, but no Services IDs were present and the listed
App ID was unrelated to KRUXT. No credential/key or provider activation occurred.
The owner agreed to sign in to the Supabase CLI for schema-only export.

Subsequent owner-guided Apple registration/configuration is complete at the
configuration level: primary App ID `com.kruxt.mobile`, DEV Services ID
`com.kruxt.web.dev`, approved DEV domain/callback, and owner-entered signing
secret. Both providers are enabled and authorization starts correctly; no
agent-run real login/token exchange or secret inspection occurred. The previous
provider-incomplete statements are historical. See the latest social-login record.

The Auth-protection continuation added strict opt-in OAuth-start health checks
and safe CAPTCHA/rate-limit errors across member/admin/platform sign-in and
admin/platform recovery. All three builds, 90 preview browser cases, 15 mapping
tests, four integration fixture tests and the security suite passed. Changes are
local and wired into CI, not deployed. The owner's pending CAPTCHA form was left
untouched; a frontend widget/token integration is still missing. CLI still
reported no access token at the last check; a terminal-panel open request was
queued for owner login. Do not infer that the schema export is unblocked.
See [Auth protection readiness](../security/auth-protection-readiness-2026-10-24.md).

The next continuation removed signup-to-password-login chains in member,
gym-code and staff-invitation entry points. Null sessions show neutral email
confirmation status, clear passwords and preserve route/code context; immediate
sessions continue without a second login. Signup does not implicitly accept
policies. Busy guards prevent concurrent submissions and invitation listeners
no longer await an Auth call from inside the SDK callback. Admin confirmation
copy and the stale public-profile claim on gym joining were corrected.

Verification: 96 isolated desktop/mobile preview cases passed, as did the
security suite, 15 auth-error mappings, four admin auth UI cases and nine
release-preflight tests. The 12 gym/invitation browser-fixture cases are wired
into CI via `pnpm test:signup-journeys`; no real user data or live challenges
were used. CAPTCHA integration remains pending and enforcement must stay on
hold. The CLI remains unsigned-in; run owner-controlled `supabase login` before
attempting the reviewed DEV schema-only export. No push/deployment occurred.

## October 25 Continuation

Optional hCaptcha browser integration is now implemented locally for member,
gym-code, invitation, admin and platform password/recovery forms. It is disabled
without a public site key, uses single-use in-memory tokens and provides expiry,
load-failure and retry handling. Google/Apple remain independent of the password
challenge. A completed verification hides only a stale CAPTCHA error, never
unrelated credential or access errors. Native mobile and hosted acceptance remain
activation gates; no hosted setting, environment variable or deployment changed.
See [CAPTCHA rollout](../security/captcha-rollout-2026-10-25.md).

A fresh online production dependency audit failed with 147 findings: one
critical, 92 high, 46 moderate and eight low across 28 package families. These
are advisory findings, not confirmed exploit counts. The existing isolated
security regressions still pass, but release remains blocked. Prioritize
dependency path/reachability triage and compatible upgrades next, keeping the
existing CI audit threshold. See [the advisory record](../security/dependency-advisories-2026-10-25.md).
CLI schema-export access remains blocked pending owner-controlled login.

Owner subsequently completed `supabase login`. A read-only CLI project listing
verified `hgomsmhsybrxjdxbgkjy` is `kruxt-beta-dev`, `ACTIVE_HEALTHY`, PostgreSQL
17.6, and not linked to this checkout. Login is no longer the blocker. The CLI
is still 2.75.0; its advertised 2.122.0 update was not installed. No project link,
database password prompt, migration operation or export was run. `docker` is not
available on the current shell PATH, so the documented container-based dump
workflow still needs tooling/connection preparation. API login does not prove
that a complete restricted schema export or an isolated compatible restore is
ready. Do not substitute a lossy catalog reconstruction or replay migrations.

The owner then updated the CLI; version 2.122.0 and continued authenticated
access to healthy `kruxt-beta-dev` were verified. Its passwordless dump resolver
can create a database login role, and its output pipeline alters schema details.
That path was not executed. Native PostgreSQL 17.7 is installed; the new
owner-operated export helper uses an explicit password prompt, verified TLS,
read-only schema capture and exclusive restricted output. Its 14 offline guard
tests passed without any real database connection. Target/CA preparation and
owner execution are still required; there is no dump or restored clone yet.
See [native export workflow](../security/native-dev-schema-export-2026-10-25.md).

The first dependency remediation pass pins patched PostCSS, Zod, React Router
DOM and Vite, plus bounded same-major overrides for Undici and Nano ID. Final
live audit findings decreased from 147 to 107; high findings from 92 to 76.
One critical tar finding remains. The audit gate is unchanged and release is
still blocked. Twenty-five dependency behavior tests, three Next app builds,
mobile typechecking, the 96-case preview suite and existing security/journey
checks passed. The legacy root Vite build still fails on React Native Flow
syntax; a Vite-5 comparison also fails there. See the updated dated advisory
record. No push, deployment, hosted migration or CAPTCHA setting change occurred.

## October 26 Checkout Recovery And Compatibility

The temporary checkout lacked its Git pointer and 373 tracked files when this
continuation began. Cause is not established. Its main-repository registration
still identified HEAD `458fa4bb09400e4f38f268a9f1b2b4519da406e4` on
`codex/98-journey-design`. Only the verified Git pointer was recreated, then
the existing worktree was moved to the persistent directory:
`/Users/edoardomustarelli/Documents/Personal 1 /codex-worktrees/journey-design`.
No deleted source files were restored. Owner confirmation for a missing-only
restoration is pending; do not treat these deletions as intentional or authorized.

A restricted, ignored preservation manifest records the missing paths and hashes
of 131 existing modified/new files. All 131 hashes and modes matched after the
move. The three continuation/advisory/export documents were subsequently updated
intentionally. Installed dependency manifests/modules are also missing. Previous
build/test results above are historical, not verification of this damaged tree.

An isolated tar 6.2.1 / 7.5.22 comparison passed 22 assertions on Node 22.22.3,
including reproduction of Expo CLI 0.22.28's incompatible default-import wrapper.
A version-only override cannot clear the critical finding safely. Complete Expo
helper integration remains blocked by missing dependencies. See the advisory
record's October 26 section. No app source, lockfile, hosted setting, migration,
commit, push or deployment was changed in this continuation.

### Approved Restoration And Member UX Pass

The owner approved restoring missing files only. Exactly the 373 missing paths
from the recorded HEAD were restored without changing the index. Preservation
verification found 128 captured files byte/mode-identical and only the three
intentional documentation changes described above; no unexpected differences.
There are no remaining tracked deletions. A frozen-lockfile reinstall with
lifecycle scripts disabled restored the installed dependency environment without
changing dependency versions. Two test-only file URL conversions now use
`fileURLToPath`, fixing execution from the persistent path containing spaces.

Member refinements now provide desktop sidebar navigation, mobile bottom
navigation, direct assigned-session selection/start, real no-plan alternatives,
retryable load errors, readable feed media and actor-first posts. Unsaved plan
setup/reordering and the promotional future-weeks panel were removed from the
training task. Logger template tools are collapsed; private-save copy replaces
the developer submission checklist. Auth/consent gates, private saves, drafts,
media retry, explicit sharing and report/block handlers remain in place.
See [scope and follow-through](member-ux-refinement-2026-10-26.md).

Current verification: member production build, mobile typecheck, 169 journey
contracts, 35 workspace checks, 25 dependency behavior checks, 39 combined
preflight/export/lineage checks and the security suite passed. The full browser
suite passed 103 desktop/mobile checks, with one intentional desktop skip of a
mobile-only 320px test. Impeccable's detector reported no findings on the initial
shell/plan/feed targets; it is not an accessibility or usability certification.
The member build retains two pre-existing LogScreen hook warnings and Next's
workspace-root warning. No fresh live audit, real-account UAT, native-device
test, hosted change, commit, push or deployment occurred.

Local preview started at `http://127.0.0.1:3306/plan` (HTTP 200), using only the
existing DEV public URL and anonymous key. It requires the owner's normal
sign-in; no privileged env-file values were passed to the server. Runtime logs
are ignored under `output/runtime/`. Original launch PID: 91458; verify process
identity before stopping it. This preview is not hosted and does not clear the
critical tar, schema-export/restore, migration, CAPTCHA or release gates.

### Observed Local Member Login Failure

The owner's open preview displayed generic authentication failure after Auth
succeeded. Read-only DEV logs/catalog checks identified absent
`ensure_self_profile` as the post-login failure. Existing profiles now use a
server-verified own-ID read before optional server creation; failed reads and
identity mismatches stay blocked. New profile tests run through
`pnpm test:auth-errors` (22 pass). Member build, 169 journey contracts and 29
targeted desktop/mobile checks passed, with one intentional skip. No hosted
mutation occurred. See [diagnosis and boundaries](../security/member-login-profile-2026-10-26.md).

The same open page advanced to required-policy review, which remains blocked.
All three active policy entries lack app-valid SHA-256 bindings; approved
review documents/publication and bindings are still required. Do not bypass or
auto-accept them. The preview was restarted after fixture testing; its original
PID above is historical, not the current process. URL remains port 3306.

### Requested Legal Draft Pack

The owner said no approved documents exist and requested drafting them. Full
English review drafts now cover Terms, Privacy and Health Data, with an index
and publication checklist under `docs/legal/`. All are explicitly draft-only,
not effective or approved. Operator identity/contact, age policy, supplier/
transfer details and retention/rights operations remain completion inputs.
EU/Italian primary guidance and code-backed data flows informed the drafting;
the documents do not establish legal compliance or replace qualified review.

The health draft specifically rejects using the existing combined account-wide
health-consent gate unchanged. Contract acceptance, privacy acknowledgment and
specific health choices/withdrawal require separate appropriate handling.
No policy metadata, checksum binding, consent, database, public legal page or
hosted setting was changed. Documents alone do not unblock entry. After factual
and legal review, approve exact final bytes, publish immutable readable copies,
verify MIME/CORS/content, and separately approve any DEV activation/update.

### Legal Draft Safeguards And Consent Errors

The owner supplied their individual operator identity, postal address and
support/privacy contact. These are now incorporated into the three local
drafts (version 0.2), not published or approved for acceptance. Other factual,
operational and legal decisions remain unresolved. Do not push these private
drafts under earlier unrelated public-branch approvals.

`scripts/legal-readiness.mjs` now checks a local review manifest and exact-byte
plain-text candidates offline, without publication or database access. It
rejects draft/unresolved text, unsafe paths, invalid content/size, non-final
versions/dates and missing review bindings. The real manifest deliberately
remains blocked. Even consistent synthetic candidates cannot authorize release,
prove human approval, verify hosted publication or certify compliance. CI tests
the fail-closed behavior rather than requiring the current draft pack to pass.

Policy review errors now use a private allowlisted error boundary. Known local
policy problems retain precise guidance; raw provider/schema errors and unknown
consent types cannot be echoed to members. All existing consent, document
checksum and acceptance checks remain intact. The document-verification test
now expects the safe acceptance error, not a reflected backend message.

`docs/legal/consent-transition.md` maps the combined web/native/Postgres gate and
the coordinated purpose-specific transition required before changing it. This
is a delivery plan, not permission to change hosted contracts or infer granular
consent from old blanket acceptance.

Fresh verification: 30 authentication/profile/consent-error tests, 10 legal
readiness tests and 5 document-verification tests passed. Member TypeScript
checking and `git diff --check` passed. The local DEV preview still returned
HTTP 200 on port 3306; no restart or build was needed. Browser UAT and production
build were not rerun in this step. `pnpm legal:check` returned the intended
`BLOCKED`/exit 1 result. No hosted settings, acceptance records, migrations,
commits, pushes or deployments changed.

### First Consent-Separation Increment: Privacy Requests

Active authenticated members awaiting policy review can now reach only
`/privacy` from the review screen without accepting policies. The restricted
shell omits training/gym/back-office navigation and returns to the policy gate.
Normal ready-member navigation remains unchanged. The new access predicate
requires matched verified identities, active status, consistent session/access
states and no errors. Disabled, pending, missing-profile and failed overall
session cases still require further rights-access design; do not claim universal
access or a complete health-consent transition.

Own-request listing/submission no longer depends on policy-status RPC success.
Malformed/unavailable policy metadata is informational and never marks acceptance.
Successful intake returns a validated request ID before refreshing history;
readback failure retains success and prevents duplicate same-page submission.
Failed writes retain entered details, and errors never echo raw provider data.
Account-keyed UI state and async guards clear prior identities' forms/receipts.
Unsafe/expired-at-load download links are excluded, with no-referrer navigation.
The refreshed privacy UI uses responsive unframed sections and explicit labels,
without fixed-SLA or automatic-export promises.

Two agents implemented the service contracts and disposable database assertions;
the parent integrated the restricted route, UX, browser tests and CI wiring.
Existing backend ownership protections needed no schema change. New SQL contracts
prove own intake/reads with zero consents, anonymous/subjectless denial, foreign
ACL/RLS write denial, no auto-consent and continued rejection of workout writes.

Fresh verification: 12 privacy access/service tests, 13 isolated browser tests
(1280/390/320px plus state/error/identity cases), 30 auth tests, 169 journey tests,
10 legal-readiness tests, the full security/mobile suite, member typecheck and
the full ordered local PostgreSQL consent/privacy/class suite passed. Browser
captures were inspected on desktop and narrow mobile. `git diff --check` passed;
the existing local preview returned HTTP 200 at `http://127.0.0.1:3306/privacy`.
The browser harness mocks Next navigation/session and does not replace hosted
UAT. No new production build was run in this step. No hosted mutation, migration,
policy activation, real-user request, commit, push or deployment occurred.

See [implementation boundaries and evidence](../security/privacy-request-access-2026-10-26.md).
Next: reviewed purpose/access matrix, granular health choices and withdrawal,
server/native parity and separately approved publication/release. Retain all
existing migration, rights-fulfillment, dependency and hosted-release holds.

### Member Access Screen Design Continuity

The owner identified oversized legacy signed-out styling in the local preview.
Signed-in member CSS was scoped to `.member-workspace`, while loading, signed-out,
setup-error and activation branches still used legacy glass panels and global
marketing styles. A shared CSS-module `MemberAccessFrame` now covers those
branches and standalone policy review with a graphite full-page background,
bounded content, compact headings and standard 44px/minimum, 6px-radius buttons.
The sign-in action now targets `/#member-login` directly. Auth/activation/consent
requirements remain unchanged; this is not a session-persistence repair.

Fresh verification: 16 local browser tests pass with both actual global CSS
files loaded, covering six access states at 1280/390/320px, bounded text/layout,
no horizontal overflow, protected-content denial and direct sign-in navigation.
30 auth/error tests, member typecheck and diff whitespace checks pass. Desktop
and mobile screenshots were inspected. Existing local `/privacy` returns HTTP
200. No new production build or hosted deployment was performed.

### Member Session And Login Continuity

Continued through 30 October 2026. Four isolated tests reproduced stale session
responses restoring signed-out/previous identities, thrown checks stuck loading
and normal missing sessions misclassified as errors. `usePublicSession` now
invalidates obsolete work, clears snapshots on Auth changes, defers SDK work
outside Auth callbacks, validates matching Auth/access/profile IDs and emits safe
retryable errors. The shell prioritizes account-check errors before signed-out
UI. Profile creation, activation, consent and role requirements are preserved.

Sign-in now carries only an allowlisted canonical member destination. Workout
plan/template/day IDs survive while private payloads/unknown query parameters,
external destinations and operator/auth routes do not. Verified active access
can return to that member page; pending policies still gate training, with only
the previously restricted `/privacy` exception. Disabled/pending activation
cannot use the return reference to skip activation.

Social kickoff keeps its existing callback URL and saves a one-time, tab-scoped
route/timestamp reference. Its 15-minute expiry is checked on read; no automatic
background deletion claim. No credentials/workout payload are stored there, but
route identifiers can remain linkable personal information. Storage failure
falls back safely; development effect replay cannot consume the reference twice.
This is not hosted OAuth proof or cross-origin SSO.

Fresh verification: member production build passed; 33 targeted real Next
desktop/mobile browser journeys passed with one intentional desktop skip.
Nine destination/storage tests, nine isolated session/login browser tests,
17 privacy/access-state browser tests, 30 auth tests, 12 privacy service/access
tests and 169 training/social/class journey tests passed. The numeric privacy
load invalidation cleanup no longer adds a lint warning. Two existing LogScreen
hook warnings and Next's multiple-lockfile workspace-root warning remain.

The preview was temporarily stopped to avoid dev/build `.next` collisions, then
restored at port 3306 using only the existing validated public DEV configuration.
No Supabase/Vercel settings, hosted records, policy bindings, migrations, public
drafts, commits, pushes or deployments changed. All previous release holds remain.
See [scope and evidence](../security/member-session-continuity-2026-10-30.md).

### Consent V2: Disabled Local Decision Foundation

31 October 2026: implemented a disposable PostgreSQL prototype, not a deployable
migration, at `packages/db/consent-prototypes/processing-permissions-v2.sql`.
Separate Terms agreement and Privacy acknowledgment determine proposed account
readiness; they cannot grant private-training, coach/gym, provider or sharing
permissions. Exact purpose/scope decisions are append-only and actor-bound, with
current policy binding checks, default-disabled configuration/catalog, immutable
scope metadata and no legacy-consent import. Decline/withdraw remains possible
for known scopes while configuration/profile/version is disabled or retired.
Per-actor locks, request receipts and audit writes preserve ordering and atomic
rollback; old grant replays do not reverse a newer withdrawal.

The full local runner passed with this optional prototype, including actor/RLS/
ACL denial, stale versions, independent purposes/recipients, disabled states,
negative decisions, replay/conflicts, audit failure and unchanged old consent
evidence. Five actual competing-connection scenarios passed with observed lock
waits: same request, changed payload, grant then withdrawal, old-grant replay and
rollback retry. The accidental-install GUC guard also rejects unguarded loading.
The runner was additionally verified with hostile inherited PGHOSTADDR/PGSERVICE/
PGOPTIONS settings; local mode clears libpq variables before selecting its owned
socket, and the suite still passed. Test fixtures/clusters are disposable, not
hosted data. Shell syntax, diff checks and 10 legal-readiness tests pass.
The existing full `pnpm security:test` suite, including mobile contracts, also
passed after integration. No fresh live dependency audit was run.

Added `pnpm db:test:processing-permissions`; CI enables prototype checks only in
its existing explicitly empty PostgreSQL test service. No migration file/history
entry, hosted settings, policy activation, frontend consent UI or runtime
authorization change was made. Existing application gates remain unchanged and
the prototype remains outside the deployment migration directory.

Independent source inventory identifies P0 integration gaps. Notably native
WorkoutService uses a public `workout-proof` bucket/getPublicUrl, while the web
proof path differs. Do not treat private workout RLS as protection for a public
object URL. Coach aggregates, provider payload ingestion, derived leaderboards,
worker retries, issued media URLs and retention/erasure also need actual purpose
enforcement. These are rollout blockers, not coverage supplied by the new ledger.
See [inventory](../security/processing-enforcement-inventory-2026-10-31.md) and
the prototype README. No new application build/browser UAT was needed or run;
the unchanged local `/privacy` preview returned HTTP 200. Nothing was committed,
pushed or deployed, and personal draft details remain unpublished.

### Native Public Proof Containment

1 November 2026: contained the legacy native public-proof path in local source.
`WorkoutService.attachProofMedia` now fails with `WORKOUT_PROOF_UNAVAILABLE`
before Auth, URI reading, storage, thumbnails or workout mutation. Its old public
uploader and thumbnail helper are removed. Workout readback and native FeedService
no longer request legacy proof columns and return null proof/thumbnail URLs even
if a response contains them. This suppresses legacy rendering in the next build,
not public objects or old clients.

The legacy workout logger no longer opens media/camera pickers or renders draft
proof URIs; it offers a clear unavailable state and removal for old references.
One successful workout save with old media remains success plus `mediaWarning`,
and the alert now says “Workout saved”. It does not silently claim media was
attached or retry the save. Two agents handled feed containment/tests and the
screen; parent integrated service/flow, actual behavior tests and verification.

Eight new tests exercise the real services/feed/flow with synthetic API doubles,
including zero file/client/storage access for attachment rejection, URL suppression,
preserved workout/social data and honest one-save warning behavior. All 20 mobile
tests and mobile typecheck pass; the new files run through the existing mobile
test glob/CI security suite. No simulator/EAS/device build or hosted media UAT was
run. See [scope, limits and private-replacement checklist](../security/native-proof-containment-2026-11-01.md).
The full `pnpm security:test` suite also passed after integration; diff checks
passed. No new dependency install or live dependency audit occurred.

No bucket, object, real workout row, migration history or hosted setting changed.
The packaged public bucket policy remains a rollout blocker for old/direct
clients; existing public URLs/caches have not been revoked. Do not re-enable
native media until the schema/private storage contract, recipient/purpose checks,
signed-URL/withdrawal handling and export/erasure coverage are verified. Web media,
the disabled consent prototype and all prior release holds remain unchanged.

### Private Attachment Lost-Response Recovery

2 November 2026: repaired web attachment cleanup after an uncertain metadata
write. Returned and thrown failures now reconcile an exact owned receipt before
counting success. Empty/failed/mismatched readback and unknown/timeout codes never
authorize object deletion. Only classified database rejections allow best-effort
cleanup after another identity check. Workout creation is never repeated here.

Four regression tests reproduced the bug before the fix; those and three added
boundary tests now pass. All 176 journey tests, the full security suite and web
typecheck pass. Existing security/privacy CI already
runs this suite. No build/browser or device UAT was performed for this change.

An independent source review found remaining metadata path substitution and
registered-object mutability risks, plus differing root/packaged ownership
policies. The existing hybrid SQL fixture is not proof of either lineage or live
Storage safety. See [recovery scope and next gates](../security/private-proof-recovery-2026-11-02.md).
Native attachments remain disabled. No schema export or hosted operation was
performed; owner-controlled CA/password export prerequisites remain outstanding.
No migrations, commits, pushes, deployments or legal activation occurred.

### Disposable Private Media Authorization

6 November 2026: added `pnpm db:test:private-proof` and a guarded, test-only
[private attachment contract](../../packages/db/media-prototypes/README.md).
Isolated fixtures reproduce old path substitution and root-only reassignment,
and confirm packaged-only anonymous legacy-object access. The candidate binds
new metadata to an owned workout and object, prevents attachment reassignment
and authenticated object replacement, hides invalid legacy bindings without
deleting them, and tests owner cleanup, audience, block and anonymous denial.
Three real competing PostgreSQL connection scenarios check commit/rollback and
observed lock waits around registration versus orphan cleanup.

No hosted schema export, app wiring, database migration, bucket change or
deployment. Native attachments stay disabled. Live schema reconciliation and
real disposable Storage API testing are still required before rollout.
