# Dependency Upgrade Checkpoint

Reviewed 2026-10-22. Local only; tracking #133. Branch
`codex/security-next-upgrade` includes account-disablement checkpoint `785d03b`.
No repair branch has been published or deployed by this work.

## Framework Repair

Web, admin and platform pin Next.js **15.5.28** with matching
`eslint-config-next`. React remains 18.3.1, within the package's declared peer
range; Expo/React Native versions are unchanged. Dependencies are installed in an
isolated checkout, not the shared readiness preview. Generated Next type references
are retained. The gym-classes route awaits asynchronous `params`.

The upgraded linter required internal home/member links to use `next/link`.
Browser testing exposed delayed AuthGateway rendering that missed hash scrolling;
the gateway now restores the member-login anchor after its session check.

## Audit Measurement

`pnpm audit --prod --json` against the baseline and upgraded pnpm lockfiles:

| Registry entries | Baseline | Upgraded |
| --- | ---: | ---: |
| Critical | 4 | 2 |
| High | 100 | 92 |
| Moderate | 55 | 45 |
| Low | 7 | 6 |

The upgraded result contains no Next.js advisories. Counts describe registry
matches, not demonstrated exploitability or distinct reachable attack paths.
The audit still exits nonzero, and the high/critical CI gate remains blocked.
Remaining critical entries are `shell-quote` (patch >=1.8.4) and `tar` (patch
>=7.5.19). Trace their consumers and test compatible upgrades; do not force a
breaking tar override into the native toolchain without verification.

## Verification

- All three application production builds pass with telemetry disabled and inert
  loopback Supabase configuration. Hosted authentication was not exercised.
- Seven configured package typechecks pass.
- Application lint passes; Next 15 warns that `next lint` is deprecated for Next 16.
- Security suite: 45 Node checks and 12 mobile regressions pass.
- `pnpm test:preview`: four Chromium tests pass across desktop and mobile.
  Tests manage their local production servers on ports 3293/3294, deny requests
  outside those loopback origins, submit no credentials, and check product image
  loading, width overflow, member-anchor scrolling and admin login rendering.
  Build web/admin first with disposable configuration; no real test accounts needed.
- Browser screenshots are written to ignored `output/playwright/next-upgrade/`.
- Proposed `preview-compatibility` CI job builds all three apps against inert
  Auth configuration, then runs the loopback browser suite. It has not run on
  GitHub; this branch is still local.

The web build warns about historical npm lockfiles. Existing Vercel install
commands explicitly use frozen pnpm 10.6.5; no npm lockfiles or deployment config
were modified. Reconcile legacy lockfiles separately with their owner.

Full authenticated user journeys, native device builds, hosted Edge/runtime
parity, remaining dependency repairs and the approved-scope penetration test are
still required. Existing JWT/session revocation and retention gaps remain release
blockers; automatic erasure stays disabled.

## Sources

- [Next.js 15 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-15)
- [Maintainer AVIF image advisory](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4)
- [Maintainer Windows-hosting advisory](https://github.com/advisories/GHSA-p293-qw3h-jr36)
- [Exact package metadata](https://registry.npmjs.org/next/15.5.28)
