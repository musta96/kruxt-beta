# Demo/test data purge

Issue #104 covers data that can leak into real-life testing. The repository has
one intentional demo creation path plus product baseline seeds that must remain:

- `apps/admin/src/services/seed-bzone.ts` creates BZone gym identity, branding,
  plans, four weeks of classes, an Italian waiver, manual billing instructions,
  four demo people, shifts, a workout plan, and demo-coach assignments.
- `202605300001_bzone_demo_people_seed.sql` creates the four fixed
  `demo.*+bzone@kruxt.test` auth users and their related public rows.
- The exercise-catalog migrations, default feature flags, and policy versions
  are product baseline data, not demo content, and must not be purged.

The BZone code path does not create workouts or feed events. The purge audit
still scans workouts, feed events, social interactions, classes, bookings,
waitlists, gym membership rows, and every auth email ending in `.test`, because
testers or earlier scripts may have created additional data outside the seed.
It recursively scans the user-scoped prefixes in `workout-proof`,
`workout-proof-media`, `profile-avatars`, and `privacy-exports`; database
cascades do not remove Storage objects.

Two non-database sample surfaces were also audited. The mobile
`DesignShowcase.tsx` contains sample rows but has no imports and is unreachable
from production navigation. The web library and plan setup contain static BZone
copy (`BZone Coaching` and `BZone gym floor`); these are editorial defaults, not
seeded accounts, workouts, or feed records. They remain unchanged because the
plan screen is part of PR #99's UI write set and should be resolved with that PR.

## Seed protection

The admin control is available only when both conditions are true:

1. the build is not production;
2. `NEXT_PUBLIC_ENABLE_DEMO_SEED=true`.

The database also requires the `demo_seed_enabled` feature flag to be enabled
at 100 percent. The guard migration forces an existing flag back to disabled
with zero-percent rollout. Enabling the browser flag alone is not enough. The
seed RPC requires either the gym-owner `danger.destructive` permission, the
platform `platform.gyms.manage` permission, or a service-role call.

## Audit first

Set credentials for the exact project being inspected. The secret is read from
the environment and is never written to the report.

```bash
export KRUXT_SUPABASE_URL="https://<project-ref>.supabase.co"
export KRUXT_SUPABASE_PROJECT_REF="<project-ref>"
export KRUXT_SUPABASE_SECRET_KEY="<secret-key>"
node packages/db/scripts/purge-demo-data.mjs --mode dry-run
```

The default mode performs reads only and writes
`demo-data-purge-report.json` locally with owner-only (`0600`) permissions. The
default filename is ignored by Git. Review these sections:

- `auth.verifiedBzoneDemoUsers`: the only users eligible for automated purge;
- `auth.suspiciousDemoMarkers`: mismatched IDs, emails, or metadata; apply mode
  refuses to run until these are reviewed;
- `auth.otherTestUsers`: other `.test` accounts, reported but never wildcard
  deleted;
- `linkedRows`: profile, workout, feed, membership, class, and social rows tied
  to test user IDs;
- `storage`: proof, avatar, and privacy-export objects under test-user prefixes;
- `ownership.testOwnedGyms`: a blocking check for the `auth.users` foreign-key
  restriction on gym owners;
- `visibility`: every public gym and visible BZone candidates;
- `candidateGyms`: BZone signatures and counts for plans, classes, waivers, and
  billing settings.

## Apply a bounded purge

Apply mode hard-deletes only the four users whose fixed UUID, exact email, and
server-controlled `app_metadata.demo_persona=true` marker all match. User
metadata is never accepted as deletion proof. Profile foreign-key cascades
remove their workouts, feed events, memberships, bookings, waitlist entries,
shifts, and social rows. Recursively discovered Storage files under those four
user IDs are deleted by exact path in batches of at most 100 before the auth
users. Each auth user is fetched and revalidated immediately before deletion.

```bash
node packages/db/scripts/purge-demo-data.mjs \
  --mode apply \
  --confirm "PURGE_BZONE_DEMO_FROM_<project-ref>"
```

To keep a seeded gym out of fresh-account discovery, pass its UUID explicitly:

```bash
node packages/db/scripts/purge-demo-data.mjs \
  --mode apply \
  --quarantine-gym-id "<gym-uuid>" \
  --confirm "PURGE_BZONE_DEMO_FROM_<project-ref>"
```

Quarantine only sets `gyms.is_public=false`; it is reversible. The tool refuses
gym UUIDs without linked test data or a matching BZone identity/brand signature.
Quarantine operations run last, after Storage and auth-user operations.
It never deletes a gym, membership plan, class schedule, waiver, or unknown
`.test` account because the original seeder can overwrite a real operator-owned
gym and those rows cannot be distinguished safely after the fact.

Before the first mutation, apply mode writes the complete preflight and planned
operation ledger to the owner-only report. It checkpoints an operation before
and after execution and records its attempt count. If an operation fails, the
script checkpoints the failure and runs a fresh audit in `finally`. Re-run the
same command with the same report path to resume from current database and
Storage state; completed operations remain in the audit trail, while resources
still found by the new preflight are planned again safely.

The purge is complete only when the post-run report says
`readyForRealTesting: true`. Vercel must also have
`NEXT_PUBLIC_ENABLE_DEMO_SEED` unset or false for every production deployment.
