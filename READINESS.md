# KRUXT Real-Life Testing Readiness

Last verified: 2026-09-01

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
| Class scheduling and member booking | Draft PR #118 CI green through `e92aa84`; local lifecycle hardening `7820d95` passed PostgreSQL concurrency tests but is not pushed |
| Web signup, activation, and policy consent | Local `codex/web-marketing-consent` through `9c04aaf`; PostgreSQL contract, 17 DB tests, typecheck, lint, and production build pass; not pushed |
| Native J1 onboarding gate | Local `codex/111-j1-onboarding` through `a9dbc06`; 10 mobile tests, typecheck, DB tests, and PostgreSQL contract pass; not pushed |
| Fable onboarding checkpoint | Preserved unchanged as `7d6328a` on `claude/j1-hardening` |

## Journey gates

### J1: Athlete

Sign up -> onboarding -> review bound policies -> select eligible gym -> log
workout -> attach proof -> feed/social -> guild/rank -> profile/GDPR.

| Gate | Status |
|------|--------|
| Shipped native entrypoint enforces onboarding | Implemented locally; publish/merge pending |
| Profile, policy review, consent, and completion are server-verified | Implemented locally; real PostgreSQL contract passes |
| Required policy acceptance is atomic | Implemented for web and mobile; approved policy documents still missing (#115) |
| Rank recompute reports actionable failures | PR #114; successful hosted run blocked on Actions secrets (#103) |
| Full workout/proof/feed/profile flow on a device | Pending Expo/device smoke |

### J2: Gym owner and staff

Login -> gym -> invites/members -> roles/status -> classes/bookings/check-ins ->
waivers/billing/compliance/support.

| Gate | Status |
|------|--------|
| Audited member operations | Built; strict four-account UAT pending (#96/#117) |
| Class scheduling, booking, waitlist, and cancellation invariants | Implemented locally; draft PR #118 must receive the final hardening commit |
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

1. Explicit authorization to push these local branches to
   `https://github.com/musta96/kruxt-beta.git`:
   `codex/class-scheduling-booking`, `codex/web-marketing-consent`, and
   `codex/111-j1-onboarding`.
2. GitHub Actions secrets `SUPABASE_URL` and legacy JWT
   `SUPABASE_SERVICE_ROLE_KEY` for the current rank Edge Function contract.
3. Hosted cross-app URL variables and the actual mobile env file pointing to
   DEV project `hgomsmhsybrxjdxbgkjy`.
4. Approved HTTPS Terms, Privacy, and Health Data documents plus their SHA-256
   checksums (#115).
5. Four distinct disposable UAT accounts and exact disposable mutation targets.
6. A physical Expo-compatible device for the final J1 smoke pass.

## Ordered path to testing

1. Publish the three verified local branches and update/create their PRs.
2. Review and merge the CI-green readiness PRs plus the three product branches.
3. Hold the Supabase deployment until migrations `202608030002` through
   `202608030006` are present together, then use the guarded bootstrap
   (`supabase db push --include-all`) against the canonical DEV project.
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
