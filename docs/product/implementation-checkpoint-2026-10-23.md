# Journey Implementation Checkpoint

Local branch: `codex/98-journey-design`. This is implementation evidence, not a
production release, GDPR certification, or hosted penetration-test report.
Research and journey maps in this folder remain working documents.

## Delivered Locally

- Exact persisted plan/day and template/day references reach Log without placing
  coaching notes, training payloads or media in a URL. Missing/ambiguous days fail
  explicitly rather than silently loading another session.
- Coaching guidance remains a separate reference; it is not automatically copied
  into shareable workout notes. Athletes record their own completed metrics.
- Workouts save privately. A confirmed save survives a failed progress readback
  or attachment upload. Attachment retries do not repeat the workout mutation.
- A per-viewer receipt guards repeat clicks and reloads. An uncertain response
  requires checking activity before explicitly permitting another attempt.
  This is not server-wide idempotency across devices or concurrent browser tabs.
- Media retries retain registered attachments, reject conflicting content at an
  occupied position and use new object paths after failed metadata registration.
  Cleanup targets only the failed attempt, never committed media. Cleanup can
  still fail; orphan reconciliation remains an operational requirement.
- Sharing is a separate, verified, owner-scoped audience change.
- Five primary athlete destinations, secondary tools, skip navigation and clear
  links to the gym workspace replace the equal-weight member link collection.
- Gym and operator drawers support mobile widths, keyboard focus, Escape,
  navigation close and desktop collapse independently.
- Gym lookup failures remain errors with retry, not evidence of absent membership
  or permission to create a gym. Existing role enforcement is retained.
- Following/My gym/Recent feeds, pending follow requests, incoming decisions,
  cancel/unfollow, blocking/unblocking and workout reports use existing contracts.
  Feed/comment queries fail closed if safety preferences cannot be read.
- Challenge actions reflect actual completion and leave acknowledgments.
  Saved workout sessions are the library's default; prototype programs remain
  previews, without unverified coaching attribution.
- Journey unit tests and workspace tests are connected to CI alongside the
  existing security and desktop/mobile compatibility checks.
- Operator access preserves all six built-in roles and displays the active
  permission catalog, role defaults, explicit overrides and effective access.
  Founder-only override editing requires review, an audit reason and verified
  MFA. Unknown and partial saves are reconciled rather than retried blindly.
- Local PostgreSQL hardening closes ordinary API writes to operator accounts,
  defaults, catalog and overrides. Guarded override RPCs require an active
  founder, AAL2 and the canonical edit capability; audit failure rolls back the
  mutation. This migration is not deployed. See
  [operator boundaries](../security/operator-permission-boundaries-2026-10-23.md).

## Not Yet Delivered

1. A published, editor-reviewed Discover catalog with provenance, enrollment and
   selected-program persistence. Recent activity is not curated Discover.
2. A fair new challenge. Current server scoring is repeatable and lacks unique
   evidence, daily deduplication and rest-aware rules. See
   [challenge boundaries](../rank-challenge-fairness-boundaries.md).
3. Full durable draft recovery, multiple-set fidelity review, native parity,
   broad secondary-page control repair and all class/coaching journey slices.
4. Hosted multi-account UAT or pilot-user research. Local browser fixtures do not
   establish hosted RLS correctness, usable real-world flows or product demand.
5. Google/Apple activation. Both provider
   forms are blank and disabled. The owner has now completed Vercel sign-in and
   approved the two exact DEV recovery callbacks; they were added without changing
   the six existing entries or Site URL. Both recovery pages load. Supabase accepted
   the authorized recovery-email request. The owner has since confirmed completing
   the reset and working access; this was not an agent-run password test. Google
   and Apple OAuth remain unconfigured/unverified. See the latest hosted section in
   [social login status](../security/social-login-rollout.md).
6. Production publication or rollout. No migrations, deployments, role grants,
   payment operations, pilot invitations or hosted penetration tests were run.
7. Named custom operator roles, invitations, role reassignment and canonical
   cross-workflow capability enforcement. Support-session scope, expiry and
   revocation remain separate security work. Per-person overrides do not solve
   these gaps. See [operator access model](operator-access-model.md).

## Validation Commands

Use a build configured with inert loopback credentials for browser fixtures:
`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY=public-test-placeholder`.
Never deploy that test bundle.

- `pnpm test:journeys`: handoff, save lifecycle, audience, media, social safety,
  scoped connections and participation contracts.
- `pnpm test:workspaces`: real component fixtures for mobile navigation and
  challenge actions, with framework/network boundaries replaced.
- `pnpm test:preview`: desktop/mobile route, auth/recovery and member journeys.
- `pnpm security:test`: existing authorization/privacy/auth/monitoring regressions.
- Build and typecheck all three web applications before a DEV preview.

Local run on 2026-10-23: all three builds and typechecks passed; 66 desktop/mobile
browser cases, 41 journey service cases and 3 workspace/challenge cases passed.
The existing security command passed its 53 infrastructure/privacy tests,
17 auth/recovery tests and 12 mobile cases. Mocked account switching during an
in-flight save, public-to-followers audience reload, missing save responses,
partial uploads and coaching-guidance exclusion are included. Desktop/mobile
captures were inspected; the mechanical component detector reported no findings
on its scoped pass. This does not establish full accessibility or hosted safety.

Operator follow-up on the same date: the final platform production build and all
three web typechecks passed. The expanded workspace suite passed 34 cases
(20 MFA, 11 operator editor, 3 existing navigation/challenge cases); the existing
66 desktop/mobile preview cases passed. Security regressions passed, including
eight new operator service cases. The targeted PostgreSQL operator contract
passed 21 assertions, 224 expected denials and three cross-connection lock
checks. The full ordered package migration and consent/privacy contract also
passed with the new forward migration. Desktop and 320px editor captures were
inspected. Auth, QR and identities in browser tests were synthetic; this does
not verify hosted Auth, migration lineage or live operator changes.

The dependency advisory release gate and existing privacy/security readiness
gaps remain open. Client filtering does not replace server-side block enforcement,
moderation operations, media validation or an independent security assessment.

## Next Acceptance Gate

Reconcile migration lineage and review the operator migration before any hosted
application. Run the
[disposable-account and pilot protocol](pilot-validation-protocol.md).
Complete provider/recovery verification before inviting pilot users. Validate
server contracts in an isolated disposable database before designing the fair
challenge; do not change scoring only in the client.
