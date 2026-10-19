# Class PostgreSQL tests

The dedicated `class-postgres` workflow starts PostgreSQL 17 and runs:

```sh
KRUXT_TEST_DATABASE_URL=postgresql://... bash packages/db/tests/run_class_postgres.sh
```

Use an **empty, disposable database** owned by a role that can create roles,
schemas and extensions. The runner refuses databases containing public tables.
It creates a minimal Supabase Auth/Storage surface, then applies the actual
baseline and class migrations 002, 003 and 006. Each class migration runs in one
transaction. The historic squashed baseline uses newly added enum labels
immediately and therefore requires autocommit when initializing plain PostgreSQL.
Business tables, authorization functions, RLS and triggers are not mocked.
This is a focused class suite, not a full Supabase-stack integration test.

For a local Homebrew PostgreSQL 17 installation:

```sh
bash packages/db/tests/run_class_postgres_ephemeral.sh
```

Set `PG_BIN` for another PostgreSQL binary directory. The ephemeral runner stops
its server on exit and retains its temporary directory/logs for diagnosis.

To check compatibility with the other readiness lanes without modifying their
checkout, set `KRUXT_CLASS_INTEGRATION_ROOT` to the integration checkout when
running the ephemeral script. It uses that checkout's Supabase bootstrap and full
ordered migrations, substituting the local class 002/003/006 migrations.

The upgrade fixture verifies that valid booking windows and unique queues are
left untouched, missing windows and duplicate positions are repaired, and
constraint validation remains deferred. The SQL contracts exercise member/staff permissions, direct-write rejection,
queue order, capacity, suspended/non-members, atomic cancellation with edits,
terminal transitions, completion cleanup and audit/outbox idempotency. The
concurrency suite overlaps requests around class/membership locks, including
staff requests blocked behind cancellation, suspension, promotion and completion.
The new staff races wait for the holder's database state before starting waiters.
Fixture setup explicitly uses a service-role JWT with no subject, so the web004
self-membership/profile guards do not mistake fixture provisioning for self-service.
Behavioral authorization tests switch back to authenticated or anon contexts.
Concurrency fixtures retain identities because audit history is immutable.

## Deployment

These edits complete the pending class migrations. If an environment has already
applied an earlier revision of 002 or 006, do not assume editing the file updates
that environment: generate a forward migration containing the repair first.

Deploy the RPCs and updated clients together. Authenticated direct child writes
and class updates are revoked. Old staff clients using table writes will fail
until updated; member booking/cancellation RPCs remain available.
Staff legacy `waitlisted` booking statuses are rejected; use the separate waitlist
and its FIFO promotion RPC.

Migration 006 repairs only invalid/missing scheduled booking windows. Its
constraint is added `NOT VALID`, enforcing new writes without scanning the table
under the migration's DDL locks. In a separate transaction after rollout, run:

```sql
set lock_timeout = '5s';
alter table public.gym_classes
  validate constraint gym_classes_scheduled_booking_window_check;
```

The test runner executes this separate validation too. Validation takes a
SHARE UPDATE EXCLUSIVE lock (ordinary writes can continue). Migration DDL still
needs brief exclusive locks; 002 and 006 fail after five seconds rather than waiting
indefinitely. Waitlist uniqueness uses the existing class-row serialization and
a trigger instead of building a new blocking partial unique index.

Completion is allowed only after class end. It preserves attended bookings,
marks outstanding bookings `no_show`, cancels legacy `waitlisted` bookings, and
expires pending waitlist entries. Terminal status cannot be reversed. Repeating
completion/cancellation emits no duplicate lifecycle event when nothing changes.

Database owners/service roles remain trusted maintenance actors; browser grants
do not constrain them. No hosted migrations, device/browser smoke, or production
load testing are performed by this local suite.
