select set_config('request.jwt.claim.role', 'service_role', false);
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  if (select updated_at from public.gym_classes where id='7f000000-0000-0000-0000-000000000020')
    <> '2000-01-01'::timestamptz then
    raise exception 'Selective backfill rewrote a valid class';
  end if;
  if not exists (select 1 from public.gym_classes where id='7f000000-0000-0000-0000-000000000021'
    and booking_opens_at is not null and booking_closes_at=starts_at) then
    raise exception 'Legacy missing windows were not repaired';
  end if;
  if (select array_agg(position order by position) from public.class_waitlist
    where class_id='7f000000-0000-0000-0000-000000000020') <> array[5,6] then
    raise exception 'Normalization rewrote an already unique queue';
  end if;
  if (select count(distinct position) from public.class_waitlist
    where class_id='7f000000-0000-0000-0000-000000000021') <> 2 then
    raise exception 'Legacy duplicate positions were not repaired';
  end if;
  if not exists (select 1 from pg_constraint
    where conname='gym_classes_scheduled_booking_window_check' and not convalidated) then
    raise exception 'Booking window validation was not deferred';
  end if;
end $$;
delete from public.gyms where id='7f000000-0000-0000-0000-000000000010';
delete from auth.users where id in ('7f000000-0000-0000-0000-000000000001','7f000000-0000-0000-0000-000000000002');
\echo '[ok] selective legacy repairs and deferred constraint validation'
