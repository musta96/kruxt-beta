# Private Workout Media Contract

**Disposable PostgreSQL only. Not a migration or a rollout approval.** This
candidate is outside both migration directories and no client uses it. Keep
native attachments disabled. Do not apply this file to hosted DEV or production.

Run `pnpm db:test:private-proof` with native PostgreSQL 17 tools. The runner
creates and removes its own temporary cluster, uses a private Unix socket with
TCP disabled, clears inherited `PG*` connection settings, and loads synthetic
rows only. `PG_BIN` can select the local PostgreSQL binary directory. The SQL
refuses installation without an explicit disposable-session opt-in or without
the expected private bucket. The opt-in is an accident guard, not proof of isolation.

## What The Tests Show

- Packaged-only fixture: the legacy bucket remains public, with anonymous object
  visibility. Root-only and combined fixtures: an attacker can claim a victim's
  unregistered path under the old policies. Only the combined fixture's existing
  hardening rejects foreign-workout reassignment before this candidate is installed.
- The candidate binds new registrations to an owned workout, a canonical
  uploader/workout/attempt/file path, and an existing object with matching
  `owner_id`. It freezes attachment identity, blocks authenticated Storage
  updates, and preserves private and blocked audience denial for reads.
- Invalid legacy bindings are hidden, not deleted or rewritten. Owners can read
  and clean up their own unregistered objects; other members cannot. Registered
  objects cannot be deleted before their registration is removed. Policy helpers
  are outside the exposed schema and cannot be called directly by members.
- Real concurrent connections prove both orderings of registration and orphan
  deletion, plus registration rollback. Registration locks the object row;
  deletion rechecks after the wait. Both operations reject fixed snapshots
  rather than relying on a stale authorization view.

## Before Rollout

These fixtures combine representative migration fragments with minimal Auth and
Storage tables. They do not prove full migration replay, hosted catalog parity,
Storage API permissions or byte-level upload, copy, upsert, signing, cache and
download behavior. The candidate does not modify the legacy public bucket or
revoke old public or signed URLs. Privileged workers still need their own
authorization, retention and erasure workflow; purpose and withdrawal checks
are not implemented here. It does not constitute a hosted penetration test.

First complete [the owner-operated DEV schema export](../../../docs/security/native-dev-schema-export-2026-10-25.md)
and isolated restore. Then design a forward repair from the verified catalog,
including review of legacy objects and managed Storage compatibility. Use the
Storage API for actual blob operations, not direct SQL deletion. Verify the
candidate behavior with disposable users and real Storage before any release.
See Supabase's [object ownership](https://supabase.com/docs/guides/storage/security/ownership)
and [Storage access control](https://supabase.com/docs/guides/storage/security/access-control).
