#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${KRUXT_TEST_DATABASE_URL:-}" ]]; then
  echo "KRUXT_TEST_DATABASE_URL is required" >&2
  exit 1
fi

PSQL=(psql "$KRUXT_TEST_DATABASE_URL" -X -q -v ON_ERROR_STOP=1)
OWNER="7d000000-0000-0000-0000-000000000001"
MEMBER_ONE="7d000000-0000-0000-0000-000000000002"
MEMBER_TWO="7d000000-0000-0000-0000-000000000003"
MEMBER_THREE="7d000000-0000-0000-0000-000000000004"
MEMBER_FOUR="7d000000-0000-0000-0000-000000000005"
MEMBER_FIVE="7d000000-0000-0000-0000-000000000006"
MEMBER_SIX="7d000000-0000-0000-0000-000000000007"
GYM_ID="7d000000-0000-0000-0000-000000000010"
FAIR_CLASS="7d000000-0000-0000-0000-000000000020"
BOOK_SUSPEND_CLASS="7d000000-0000-0000-0000-000000000021"
WAIT_SUSPEND_CLASS="7d000000-0000-0000-0000-000000000022"
LATE_CLASS="7d000000-0000-0000-0000-000000000023"
CANCEL_CLASS="7d000000-0000-0000-0000-000000000024"
CAPACITY_CLASS="7d000000-0000-0000-0000-000000000025"
ADMIN_CLASS="7d000000-0000-0000-0000-000000000026"

cleanup() {
  "${PSQL[@]}" -c "
    delete from public.class_bookings where class_id::text like '7d000000-0000-0000-0000-00000000002%';
    delete from public.class_waitlist where class_id::text like '7d000000-0000-0000-0000-00000000002%';
    delete from public.event_outbox where aggregate_id::text like '7d000000-0000-0000-0000-00000000002%';
    delete from public.gym_classes where id::text like '7d000000-0000-0000-0000-00000000002%';
    delete from public.gym_memberships where gym_id = '$GYM_ID';
    delete from public.gyms where id = '$GYM_ID';
    -- Audit rows are append-only and retain actor_user_id references. Keep the
    -- deterministic identity fixtures so teardown never mutates audit history.
  " >/dev/null
}

trap cleanup EXIT
cleanup

"${PSQL[@]}" -c "
  insert into auth.users(id, instance_id, aud, role, email, created_at, updated_at)
  select id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email, now(), now()
  from (values
    ('$OWNER'::uuid, 'lifecycle-owner@example.test'),
    ('$MEMBER_ONE'::uuid, 'lifecycle-one@example.test'),
    ('$MEMBER_TWO'::uuid, 'lifecycle-two@example.test'),
    ('$MEMBER_THREE'::uuid, 'lifecycle-three@example.test'),
    ('$MEMBER_FOUR'::uuid, 'lifecycle-four@example.test'),
    ('$MEMBER_FIVE'::uuid, 'lifecycle-five@example.test'),
    ('$MEMBER_SIX'::uuid, 'lifecycle-six@example.test')
  ) fixtures(id, email)
  on conflict (id) do update set email = excluded.email, updated_at = now();

  insert into public.profiles(id, username, display_name) values
    ('$OWNER', 'lifecycle-owner', 'Lifecycle Owner'),
    ('$MEMBER_ONE', 'lifecycle-one', 'Lifecycle One'),
    ('$MEMBER_TWO', 'lifecycle-two', 'Lifecycle Two'),
    ('$MEMBER_THREE', 'lifecycle-three', 'Lifecycle Three'),
    ('$MEMBER_FOUR', 'lifecycle-four', 'Lifecycle Four'),
    ('$MEMBER_FIVE', 'lifecycle-five', 'Lifecycle Five'),
    ('$MEMBER_SIX', 'lifecycle-six', 'Lifecycle Six')
  on conflict (id) do update
  set username = excluded.username,
      display_name = excluded.display_name;

  insert into public.gyms(id, owner_user_id, name, slug)
  values ('$GYM_ID', '$OWNER', 'Lifecycle Concurrency Gym', 'lifecycle-concurrency-gym');

  insert into public.gym_memberships(gym_id, user_id, role, membership_status) values
    ('$GYM_ID', '$OWNER', 'leader', 'active'),
    ('$GYM_ID', '$MEMBER_ONE', 'member', 'active'),
    ('$GYM_ID', '$MEMBER_TWO', 'member', 'active'),
    ('$GYM_ID', '$MEMBER_THREE', 'member', 'active'),
    ('$GYM_ID', '$MEMBER_FOUR', 'member', 'active'),
    ('$GYM_ID', '$MEMBER_FIVE', 'member', 'active'),
    ('$GYM_ID', '$MEMBER_SIX', 'member', 'active');

  insert into public.gym_classes(
    id, gym_id, title, capacity, status, starts_at, ends_at, booking_opens_at, booking_closes_at
  ) values
    ('$FAIR_CLASS', '$GYM_ID', 'Fairness Race', 1, 'scheduled', now() + interval '3 hours', now() + interval '4 hours', now() - interval '1 hour', now() + interval '2 hours'),
    ('$BOOK_SUSPEND_CLASS', '$GYM_ID', 'Booking Suspension Race', 1, 'scheduled', now() + interval '3 hours', now() + interval '4 hours', now() - interval '1 hour', now() + interval '2 hours'),
    ('$WAIT_SUSPEND_CLASS', '$GYM_ID', 'Waitlist Suspension Race', 1, 'scheduled', now() + interval '3 hours', now() + interval '4 hours', now() - interval '1 hour', now() + interval '2 hours'),
    ('$LATE_CLASS', '$GYM_ID', 'Late Member Cancellation', 2, 'scheduled', now() + interval '3 hours', now() + interval '4 hours', now() - interval '2 hours', now() - interval '1 hour'),
    ('$CANCEL_CLASS', '$GYM_ID', 'Class Cancellation Race', 3, 'scheduled', now() + interval '3 hours', now() + interval '4 hours', now() - interval '1 hour', now() + interval '2 hours'),
    ('$CAPACITY_CLASS', '$GYM_ID', 'Capacity Reduction Race', 2, 'scheduled', now() + interval '3 hours', now() + interval '4 hours', now() - interval '1 hour', now() + interval '2 hours');

  insert into public.gym_classes(id, gym_id, title, capacity, status, starts_at, ends_at)
  values ('$ADMIN_CLASS', '$GYM_ID', 'Admin Default Window', 2, 'scheduled', now() + interval '3 hours', now() + interval '4 hours');

  insert into public.class_bookings(class_id, user_id, status, source_channel) values
    ('$FAIR_CLASS', '$OWNER', 'booked', 'concurrency_fixture'),
    ('$WAIT_SUSPEND_CLASS', '$OWNER', 'booked', 'concurrency_fixture'),
    ('$LATE_CLASS', '$MEMBER_FIVE', 'booked', 'concurrency_fixture'),
    ('$CANCEL_CLASS', '$MEMBER_ONE', 'booked', 'concurrency_fixture'),
    ('$CANCEL_CLASS', '$MEMBER_TWO', 'booked', 'concurrency_fixture'),
    ('$CAPACITY_CLASS', '$MEMBER_ONE', 'booked', 'concurrency_fixture');

  insert into public.class_waitlist(class_id, user_id, position, status) values
    ('$LATE_CLASS', '$MEMBER_SIX', 1, 'pending'),
    ('$CANCEL_CLASS', '$MEMBER_THREE', 1, 'pending');
"

# Fairness: once a seat opens, a fresh booking and promotion race each other.
# Promotion must win the seat regardless of class-lock acquisition order.
"${PSQL[@]}" -c "
  select set_config('request.jwt.claim.role', 'authenticated', false);
  select set_config('request.jwt.claim.sub', '$MEMBER_ONE', false);
  select public.join_waitlist('$FAIR_CLASS');
" >/dev/null

FAIR_BOOKING_ID=$("${PSQL[@]}" -Atc "select id from public.class_bookings where class_id = '$FAIR_CLASS' and user_id = '$OWNER';")
"${PSQL[@]}" -c "
  select set_config('request.jwt.claim.role', 'authenticated', false);
  select set_config('request.jwt.claim.sub', '$OWNER', false);
  select public.cancel_gym_class_booking('$FAIR_BOOKING_ID');
" >/dev/null

"${PSQL[@]}" -c "
  select set_config('request.jwt.claim.role', 'authenticated', false);
  select set_config('request.jwt.claim.sub', '$MEMBER_TWO', false);
  select public.book_gym_class('$FAIR_CLASS');
" >/tmp/kruxt-lifecycle-fair-book.log 2>&1 &
FAIR_BOOK_PID=$!

"${PSQL[@]}" -c "
  select set_config('request.jwt.claim.role', 'authenticated', false);
  select set_config('request.jwt.claim.sub', '$OWNER', false);
  select public.promote_waitlist_member('$FAIR_CLASS');
" >/tmp/kruxt-lifecycle-fair-promote.log 2>&1 &
FAIR_PROMOTE_PID=$!

set +e
wait "$FAIR_BOOK_PID"
FAIR_BOOK_STATUS=$?
wait "$FAIR_PROMOTE_PID"
FAIR_PROMOTE_STATUS=$?
set -e

if [[ "$FAIR_BOOK_STATUS" -eq 0 || "$FAIR_PROMOTE_STATUS" -ne 0 ]]; then
  cat /tmp/kruxt-lifecycle-fair-book.log
  cat /tmp/kruxt-lifecycle-fair-promote.log
  echo "Fairness race allowed a fresh booking to bypass the pending queue" >&2
  exit 1
fi

FAIR_USER=$("${PSQL[@]}" -Atc "select user_id from public.class_bookings where class_id = '$FAIR_CLASS' and status = 'booked';")
if [[ "$FAIR_USER" != "$MEMBER_ONE" ]]; then
  echo "Expected queued member promotion, found $FAIR_USER" >&2
  exit 1
fi
echo "[ok] fairness race preserved queue ownership"

# A concurrent membership pause must win before booking/waitlist eligibility is
# materialized when it already owns the membership row lock.
"${PSQL[@]}" -c "
  begin;
  update public.gym_memberships set membership_status = 'paused'
  where gym_id = '$GYM_ID' and user_id = '$MEMBER_THREE';
  select pg_sleep(1);
  commit;
" >/tmp/kruxt-lifecycle-pause-book.log 2>&1 &
PAUSE_BOOK_PID=$!
sleep 0.1

set +e
"${PSQL[@]}" -c "
  select set_config('request.jwt.claim.role', 'authenticated', false);
  select set_config('request.jwt.claim.sub', '$MEMBER_THREE', false);
  select public.book_gym_class('$BOOK_SUSPEND_CLASS');
" >/tmp/kruxt-lifecycle-suspended-book.log 2>&1
SUSPENDED_BOOK_STATUS=$?
wait "$PAUSE_BOOK_PID"
set -e

if [[ "$SUSPENDED_BOOK_STATUS" -eq 0 ]]; then
  echo "Concurrent membership pause allowed booking" >&2
  exit 1
fi

"${PSQL[@]}" -c "update public.gym_memberships set membership_status = 'active' where gym_id = '$GYM_ID' and user_id = '$MEMBER_THREE';" >/dev/null

"${PSQL[@]}" -c "
  begin;
  update public.gym_memberships set membership_status = 'paused'
  where gym_id = '$GYM_ID' and user_id = '$MEMBER_FOUR';
  select pg_sleep(1);
  commit;
" >/tmp/kruxt-lifecycle-pause-wait.log 2>&1 &
PAUSE_WAIT_PID=$!
sleep 0.1

set +e
"${PSQL[@]}" -c "
  select set_config('request.jwt.claim.role', 'authenticated', false);
  select set_config('request.jwt.claim.sub', '$MEMBER_FOUR', false);
  select public.join_waitlist('$WAIT_SUSPEND_CLASS');
" >/tmp/kruxt-lifecycle-suspended-wait.log 2>&1
SUSPENDED_WAIT_STATUS=$?
wait "$PAUSE_WAIT_PID"
set -e

if [[ "$SUSPENDED_WAIT_STATUS" -eq 0 ]]; then
  echo "Concurrent membership pause allowed waitlist join" >&2
  exit 1
fi
echo "[ok] membership suspension race blocked booking and waitlist"

# Booking-close is not a cancellation deadline. Booking and waitlist exits race
# on the class lock but both must succeed before class start.
LATE_BOOKING_ID=$("${PSQL[@]}" -Atc "select id from public.class_bookings where class_id = '$LATE_CLASS' and user_id = '$MEMBER_FIVE';")
LATE_WAITLIST_ID=$("${PSQL[@]}" -Atc "select id from public.class_waitlist where class_id = '$LATE_CLASS' and user_id = '$MEMBER_SIX';")

"${PSQL[@]}" -c "
  select set_config('request.jwt.claim.role', 'authenticated', false);
  select set_config('request.jwt.claim.sub', '$MEMBER_FIVE', false);
  select public.cancel_gym_class_booking('$LATE_BOOKING_ID');
" >/tmp/kruxt-lifecycle-late-cancel.log 2>&1 &
LATE_CANCEL_PID=$!

"${PSQL[@]}" -c "
  select set_config('request.jwt.claim.role', 'authenticated', false);
  select set_config('request.jwt.claim.sub', '$MEMBER_SIX', false);
  select public.leave_class_waitlist('$LATE_WAITLIST_ID');
" >/tmp/kruxt-lifecycle-late-leave.log 2>&1 &
LATE_LEAVE_PID=$!

wait "$LATE_CANCEL_PID"
wait "$LATE_LEAVE_PID"

LATE_STATES=$("${PSQL[@]}" -Atc "
  select
    (select status from public.class_bookings where id = '$LATE_BOOKING_ID') || ',' ||
    (select status from public.class_waitlist where id = '$LATE_WAITLIST_ID');
")
if [[ "$LATE_STATES" != "cancelled,cancelled" ]]; then
  echo "Late cancellation policy failed: $LATE_STATES" >&2
  exit 1
fi
echo "[ok] booking-close did not block pre-start member exits"

# Cancellation races a new booking. Regardless of order, the final class and
# every active child record must be cancelled with one lifecycle event/audit.
CANCEL_AUDIT_BEFORE=$("${PSQL[@]}" -Atc "select count(*) from public.audit_logs where target_id = '$CANCEL_CLASS' and action = 'class.cancelled';")

"${PSQL[@]}" -c "
  select set_config('request.jwt.claim.role', 'authenticated', false);
  select set_config('request.jwt.claim.sub', '$OWNER', false);
  select public.cancel_gym_class('$CANCEL_CLASS');
" >/tmp/kruxt-lifecycle-class-cancel.log 2>&1 &
CLASS_CANCEL_PID=$!

"${PSQL[@]}" -c "
  select set_config('request.jwt.claim.role', 'authenticated', false);
  select set_config('request.jwt.claim.sub', '$MEMBER_FOUR', false);
  select public.book_gym_class('$CANCEL_CLASS');
" >/tmp/kruxt-lifecycle-cancel-book.log 2>&1 &
CANCEL_BOOK_PID=$!

set +e
wait "$CLASS_CANCEL_PID"
CLASS_CANCEL_STATUS=$?
wait "$CANCEL_BOOK_PID"
set -e

if [[ "$CLASS_CANCEL_STATUS" -ne 0 ]]; then
  cat /tmp/kruxt-lifecycle-class-cancel.log
  echo "Class cancellation RPC failed" >&2
  exit 1
fi

CANCEL_INVARIANT=$("${PSQL[@]}" -Atc "
  select
    gc.status || ',' ||
    count(*) filter (where cb.status in ('booked', 'waitlisted')) || ',' ||
    (select count(*) from public.class_waitlist cw where cw.class_id = gc.id and cw.status = 'pending') || ',' ||
    (select count(*) from public.event_outbox eo where eo.aggregate_id = gc.id and eo.event_type = 'class.cancelled') || ',' ||
    (select count(*) from public.audit_logs al where al.target_id = gc.id and al.action = 'class.cancelled')
  from public.gym_classes gc
  left join public.class_bookings cb on cb.class_id = gc.id
  where gc.id = '$CANCEL_CLASS'
  group by gc.id, gc.status;
")
IFS=',' read -r CANCELLED_STATUS ACTIVE_BOOKINGS PENDING_WAITLIST CANCEL_EVENTS CANCEL_AUDITS <<<"$CANCEL_INVARIANT"
if [[ "$CANCELLED_STATUS" != "cancelled" || "$ACTIVE_BOOKINGS" != "0" || "$PENDING_WAITLIST" != "0" || "$CANCEL_EVENTS" != "1" ]] \
  || (( CANCEL_AUDITS != CANCEL_AUDIT_BEFORE + 1 )); then
  echo "Class cancellation cascade invariant failed: $CANCEL_INVARIANT" >&2
  exit 1
fi
echo "[ok] class cancellation race cascaded and emitted lifecycle records"

# Capacity reduction and a second booking race on the class row. Both may not
# succeed if the result would place active bookings above capacity.
"${PSQL[@]}" -c "update public.gym_classes set capacity = 1 where id = '$CAPACITY_CLASS';" >/tmp/kruxt-lifecycle-capacity-update.log 2>&1 &
CAPACITY_UPDATE_PID=$!

"${PSQL[@]}" -c "
  select set_config('request.jwt.claim.role', 'authenticated', false);
  select set_config('request.jwt.claim.sub', '$MEMBER_TWO', false);
  select public.book_gym_class('$CAPACITY_CLASS');
" >/tmp/kruxt-lifecycle-capacity-book.log 2>&1 &
CAPACITY_BOOK_PID=$!

set +e
wait "$CAPACITY_UPDATE_PID"
CAPACITY_UPDATE_STATUS=$?
wait "$CAPACITY_BOOK_PID"
CAPACITY_BOOK_STATUS=$?
set -e

if [[ "$CAPACITY_UPDATE_STATUS" -eq 0 && "$CAPACITY_BOOK_STATUS" -eq 0 ]]; then
  echo "Capacity reduction and competing booking both succeeded" >&2
  exit 1
fi

CAPACITY_INVARIANT=$("${PSQL[@]}" -Atc "
  select gc.capacity || ',' || count(cb.id)
  from public.gym_classes gc
  left join public.class_bookings cb on cb.class_id = gc.id and cb.status in ('booked', 'attended')
  where gc.id = '$CAPACITY_CLASS'
  group by gc.id, gc.capacity;
")
CAPACITY_VALUE=${CAPACITY_INVARIANT%%,*}
ACTIVE_VALUE=${CAPACITY_INVARIANT##*,}
if (( ACTIVE_VALUE > CAPACITY_VALUE )); then
  echo "Capacity invariant failed after race: $CAPACITY_INVARIANT" >&2
  exit 1
fi
echo "[ok] capacity race preserved active-booking bound"

# The admin-style insert omitted both windows. The lifecycle trigger must fill
# a valid window and allow two simultaneous member bookings.
ADMIN_WINDOW=$("${PSQL[@]}" -Atc "
  select (booking_opens_at is not null and booking_closes_at is not null and booking_opens_at <= booking_closes_at and booking_closes_at <= starts_at)::text
  from public.gym_classes where id = '$ADMIN_CLASS';
")
if [[ "$ADMIN_WINDOW" != "true" ]]; then
  echo "Admin schedule did not receive a valid booking window" >&2
  exit 1
fi

"${PSQL[@]}" -c "
  select set_config('request.jwt.claim.role', 'authenticated', false);
  select set_config('request.jwt.claim.sub', '$MEMBER_ONE', false);
  select public.book_gym_class('$ADMIN_CLASS');
" >/tmp/kruxt-lifecycle-admin-book-one.log 2>&1 &
ADMIN_BOOK_ONE_PID=$!

"${PSQL[@]}" -c "
  select set_config('request.jwt.claim.role', 'authenticated', false);
  select set_config('request.jwt.claim.sub', '$MEMBER_TWO', false);
  select public.book_gym_class('$ADMIN_CLASS');
" >/tmp/kruxt-lifecycle-admin-book-two.log 2>&1 &
ADMIN_BOOK_TWO_PID=$!

wait "$ADMIN_BOOK_ONE_PID"
wait "$ADMIN_BOOK_TWO_PID"

ADMIN_BOOKINGS=$("${PSQL[@]}" -Atc "select count(*) from public.class_bookings where class_id = '$ADMIN_CLASS' and status = 'booked';")
if [[ "$ADMIN_BOOKINGS" != "2" ]]; then
  echo "Admin schedule-to-bookability contract failed: $ADMIN_BOOKINGS bookings" >&2
  exit 1
fi
echo "[ok] admin schedule defaults remained bookable under parallel booking"
