# KRUXT Real-Life Testing Readiness

Last verified: 2026-10-19

KRUXT is one system: mobile athlete app, gym admin, public/member web, and
platform console on one Supabase backend. This file tracks the remaining gates
before inviting real testers.

## Release state

**Not ready for real testers yet.** The main code blockers now have reviewable
fixes or guarded operator tooling, but several branches are unmerged and the
hosted environment, legal documents, purge, UAT, and device checks are still
outstanding.

## Engineering checkpoints

| Area | Current status |
|------|----------------|
| Platform inert controls | PR #112 open, mergeable, CI green |
| Admin dashboard failure/empty states | PR #113 open, mergeable, CI green |
| Rank diagnostics + cross-app handoffs | PR #114 open, mergeable, CI green; hosted secrets/URLs still required |
| Demo-data purge safety | PR #116 open, mergeable, CI green; no live purge has run |
| Four-account BZone UAT harness | PR #117 open, mergeable, CI green; strict credentialed run still pending |
| Class scheduling and member booking | PR #118 review-ready through `1ee7269`; general CI, PostgreSQL workflow, and all three Vercel previews green |
| Web signup, activation, and policy consent | Draft PR #131 through `36bdd67`; general CI and PostgreSQL workflow green; Vercel previews queued |
| Native J1 onboarding gate | Draft PR #130 through `e945b77`; general CI and PostgreSQL workflow green; Vercel previews queued |
| Fable onboarding checkpoint | Preserved unchanged as `7d6328a` on `claude/j1-hardening` |

## Integration evidence

The local `codex/readiness-integration-rehearsal` branch combines all eight
readiness/product lanes in `/tmp/kruxt-readiness-integration-20261019`.
Conflicts in env examples, ignore rules, test scripts, and package commands were
resolved by preserving each lane's behavior.

- Typecheck: all seven packages pass.
- Configured lint: all seven package commands pass; web/admin/platform execute
  ESLint, while mobile/shared/DB lint commands remain repository placeholders.
- Node database/tooling tests: 45 pass; mobile tests: 11 pass.
- Disposable PostgreSQL 17: full ordered migrations through `202608030006`,
  mobile onboarding contract, both consent/activation contracts, class upgrade
  contract, staff lifecycle contract, and ten concurrency scenarios pass.
- Dedicated workflows now execute mobile, consent, and class PostgreSQL checks.
  All three dedicated PostgreSQL workflows passed on the published heads.
- Production builds for web, admin, and platform pass. Admin/platform builds
  require network access for the existing Google Fonts configuration.
- Playwright desktop and 390px mobile checks pass: no horizontal overflow,
  broken images, console errors, or false missing-session banner; registration
  renders and the signed-out class route requires sign-in. Screenshots are in
  the integration checkout's `output/playwright/` directory.
- Strict BZone preflight correctly refuses to launch without real account,
  target, mobile-env, and mutation-confirmation inputs. No live UAT or purge ran.

Local build checks use an inert public-key placeholder. They verify compilation
and rendering, not hosted authentication or data access.

## Journey gates

### J1: Athlete

Sign up -> onboarding -> review bound policies -> select eligible gym -> log
workout -> attach proof -> feed/social -> guild/rank -> profile/GDPR.

| Gate | Status |
|------|--------|
| Shipped native entrypoint enforces onboarding | Implemented locally; publish/merge pending |
| Profile, policy review, consent, and completion are server-verified | Implemented locally; real PostgreSQL contract passes; disabled profiles fail closed |
| Required policy acceptance is atomic | Implemented for web and mobile; approved policy documents still missing (#115) |
| Rank recompute reports actionable failures | PR #114; successful hosted run blocked on Actions secrets (#103) |
| Full workout/proof/feed/profile flow on a device | Pending Expo/device smoke |

### J2: Gym owner and staff

Login -> gym -> invites/members -> roles/status -> classes/bookings/check-ins ->
waivers/billing/compliance/support.

| Gate | Status |
|------|--------|
| Audited member operations | Built; strict four-account UAT pending (#96/#117) |
| Class scheduling, staff mutations, waitlist, cancellation, and completion | Implemented locally; draft PR #118 must receive the reviewed repairs |
| Admin controls show truthful states | PRs #112 and #113 ready for review |
| Demo controls and identities absent from tester view | Guardrails in PR #116; operator purge and hosted env verification pending |

### J3: Cross-app and hosted runtime

| Gate | Status |
|------|--------|
| All apps point to DEV project `hgomsmhsybrxjdxbgkjy` | Web/admin/platform bundles evidenced by #117; actual mobile env still must be supplied and verified |
| Cross-app URLs use real hosted destinations | Code/env examples in #114; Vercel and mobile env values still need configuration (#105) |
| Invite activation hands off correctly across web/mobile | Pending credentialed UAT and device smoke |
| Legal/support destinations are real and reviewable | Blocked on approved versioned documents and SHA-256 bindings (#115) |

## Required operator inputs

1. GitHub Actions secrets `SUPABASE_URL` and legacy JWT
   `SUPABASE_SERVICE_ROLE_KEY` for the current rank Edge Function contract.
2. Hosted cross-app URL variables and the actual mobile env file pointing to
   DEV project `hgomsmhsybrxjdxbgkjy`.
3. Approved versioned HTTPS Terms, Privacy, and Health Data documents plus their
   SHA-256 checksums (#115). Web review requires PDF/plain-text responses with
   CORS access; it hashes the downloaded bytes and displays that verified copy.
   Native review still opens the published URL and requires immutable hosting
   plus physical-device verification.
4. Four distinct disposable UAT accounts and exact disposable mutation targets.
   No configured account file was found locally. Use
   `docs/bzone-uat.env.example` as the blank template; store populated values in
   the ignored `.env.uat.local`, never in the tracked example.
5. A physical Expo-compatible device for the final J1 smoke pass.

## Ordered path to testing

1. Review PRs #130, #131, #118, and #114; require general CI, the PostgreSQL
   workflows, and Vercel previews to pass. The four branches were published with
   Edoardo's explicit authorization on 2026-10-19.
2. Review and merge the CI-green readiness PRs plus the three product branches.
3. Hold the Supabase deployment until migrations `202608030001` through
   `202608030006` are present together, then use the guarded bootstrap
   (`supabase db push --include-all`) against the canonical DEV project.
   If an older revision was already applied, ship a forward repair migration;
   editing an applied migration does not update the hosted database. Validate
   the new class-window constraint separately as documented in
   `packages/db/tests/README.class-postgres.md`.
4. Configure Actions/Vercel/mobile environment values and publish the approved
   checksummed legal documents.
5. Run the #116 purge dry-run, review it, apply only with the exact confirmation,
   and require `readyForRealTesting: true` in the post-audit.
6. Run #117 in strict four-account mode and fix every failed or skipped journey.
7. Run the native J1 flow on a real device, then invite testers only after all
   gates above are green.

**Definition of ready:** no visible control is inert, no demo identity is
visible, required policies are content-bound, one DEV Supabase project is used
end to end, strict UAT passes, and the complete athlete journey passes on a
physical device.
