begin;
set local lock_timeout = '5s';

create table public.gym_class_series (
  id uuid primary key,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  title text not null check (length(title) between 1 and 120),
  description text not null default '' check (length(description) <= 2000),
  capacity integer not null check (capacity between 1 and 10000),
  coach_user_id uuid references public.profiles(id) on delete set null,
  time_zone text not null,
  schedule jsonb not null,
  request_hash bytea not null,
  publication_receipt jsonb not null default '[]',
  created_at timestamptz not null default now(),
  unique(id,gym_id)
);
create index gym_class_series_gym on public.gym_class_series(gym_id);
alter table public.gym_classes add column series_id uuid references public.gym_class_series(id) on delete restrict;
alter table public.gym_classes add column series_occurrence_key text;
alter table public.gym_classes add constraint gym_class_series_gym_fk
  foreign key(series_id,gym_id) references public.gym_class_series(id,gym_id);
alter table public.gym_classes add constraint gym_class_series_key_check
  check ((series_id is null)=(series_occurrence_key is null)
    and (series_occurrence_key is null or length(series_occurrence_key) between 1 and 200));
create unique index gym_class_series_occurrence on public.gym_classes(series_id, series_occurrence_key)
  where series_id is not null;
create table public.gym_class_series_subscriptions (
  series_id uuid not null references public.gym_class_series(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  subscribed_at timestamptz not null default now(),
  primary key(series_id,user_id)
);
create table public.gym_class_announcements (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  series_id uuid not null references public.gym_class_series(id) on delete cascade,
  class_id uuid references public.gym_classes(id) on delete set null,
  audience text not null check (audience in ('series_subscribers','occurrence_attendees')),
  occurrence_starts_at timestamptz,
  time_zone text not null,
  body text not null check (length(btrim(body)) between 1 and 2000),
  created_by uuid references public.profiles(id) on delete set null,
  request_id uuid not null,
  request_hash bytea not null,
  recipient_count integer not null,
  created_at timestamptz not null default now(),
  unique(gym_id,request_id), unique(id,gym_id)
);
create index gym_class_announcements_gym_date on public.gym_class_announcements(gym_id,created_at desc);
create index gym_class_announcements_series on public.gym_class_announcements(series_id);
create table public.gym_class_announcement_recipients (
  announcement_id uuid not null,
  gym_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key(announcement_id,user_id),
  foreign key(announcement_id,gym_id) references public.gym_class_announcements(id,gym_id) on delete cascade
);
create index gym_class_announcement_recipient_user on public.gym_class_announcement_recipients(user_id,gym_id);
alter table public.gym_class_series enable row level security;
alter table public.gym_class_series_subscriptions enable row level security;
alter table public.gym_class_announcements enable row level security;
alter table public.gym_class_announcement_recipients enable row level security;
revoke all on public.gym_class_series, public.gym_class_series_subscriptions,
  public.gym_class_announcements, public.gym_class_announcement_recipients from public,anon,authenticated;
grant select on public.gym_class_series, public.gym_class_series_subscriptions,
  public.gym_class_announcements, public.gym_class_announcement_recipients to authenticated;
create policy class_series_member_read on public.gym_class_series for select to authenticated
  using (public.is_gym_member(gym_id));
create policy class_series_own_subscription on public.gym_class_series_subscriptions for select to authenticated
  using (user_id=auth.uid() and exists(select 1 from public.gym_class_series s where s.id=series_id));
create policy class_announcement_recipient_read on public.gym_class_announcement_recipients for select to authenticated
  using (user_id=auth.uid() and public.is_gym_member(gym_id));
create policy class_announcement_read on public.gym_class_announcements for select to authenticated
  using (public.is_gym_staff(gym_id) or exists(select 1 from public.gym_class_announcement_recipients r
    where r.announcement_id=id and r.user_id=auth.uid()));

create function public.require_class_series_staff(p_gym_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  perform 1 from public.gym_memberships where gym_id=p_gym_id and user_id=auth.uid()
    and membership_status in ('active','trial') and role in ('leader','officer','coach') for share;
  if not found then raise exception 'Active gym staff access required' using errcode='42501'; end if;
  if public.gym_capability_enabled(p_gym_id,'classes_scheduling') is distinct from true
    or not exists(select 1 from public.gym_permission_catalog where permission_key='ops.classes.manage' and is_active)
    or exists(select 1 from public.gym_user_permission_overrides where gym_id=p_gym_id and user_id=auth.uid() and permission_key='ops.classes.manage' and not is_allowed)
    or public.user_has_gym_permission(p_gym_id,'ops.classes.manage',auth.uid()) is distinct from true then
    raise exception 'Class management permission and scheduling capability required' using errcode='42501';
  end if;
end;
$$;
revoke all on function public.require_class_series_staff(uuid) from public,anon,authenticated,service_role;

-- PostgreSQL's timezone database supplies civil-time conversion. Round-trip
-- nearby offsets to reject both skipped and ambiguous local times.
create function public.class_series_instant(p_local timestamp, p_zone text) returns timestamptz
language plpgsql stable set search_path='' as $$
declare v_instant timestamptz; v_count integer;
begin
  with offsets as (
    select distinct (sample at time zone p_zone)-(sample at time zone 'UTC') as delta
    from generate_series((p_local at time zone p_zone)-interval '2 days',
      (p_local at time zone p_zone)+interval '2 days',interval '6 hours') sample
  ), candidates as (
    select (p_local at time zone 'UTC')-delta as instant from offsets
  ) select min(instant),count(*) into v_instant,v_count from candidates where instant at time zone p_zone=p_local;
  if v_count<>1 then raise exception 'Ambiguous or nonexistent class time: % in %',p_local,p_zone using errcode='22023'; end if;
  return v_instant;
end;
$$;
revoke all on function public.class_series_instant(timestamp,text) from public,anon,authenticated,service_role;

create function public.publish_gym_class_series(p_gym_id uuid,p_draft jsonb,p_capacity integer,
  p_description text default '',p_coach_user_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_id uuid; v_first date; v_last date; v_zone text; v_hash bytea;
  v_existing public.gym_class_series; v_slot jsonb; v_date date; v_start timestamptz; v_end timestamptz;
  v_count integer:=0; v_slot_ids text[]:='{}'; v_rows jsonb:='[]';
begin
  perform public.require_class_series_staff(p_gym_id);
  if public.gym_staff_can(p_gym_id,'class.assign_coach') is distinct from true then
    raise exception 'Only a gym leader or officer can publish a class series' using errcode='42501';
  end if;
  if p_capacity is null or p_capacity not between 1 and 10000 or p_description is null or length(p_description)>2000
    or p_draft is null or octet_length(p_draft::text)>65536 or jsonb_typeof(p_draft)<>'object' or p_draft->>'version' is distinct from '1'
    or jsonb_typeof(p_draft->'title') is distinct from 'string'
    or length(btrim(p_draft->>'title')) not between 1 and 120
    or jsonb_typeof(p_draft->'slots') is distinct from 'array'
    or jsonb_typeof(p_draft->'excludedDates') is distinct from 'array' then
    raise exception 'Invalid series fields' using errcode='22023';
  end if;
  v_id:=(p_draft->>'id')::uuid;
  if v_id is null then raise exception 'Series ID required' using errcode='22023'; end if;
  if (p_draft->>'startDate') !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$'
    or (p_draft->>'endDate') !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'Invalid date range' using errcode='22023'; end if;
  v_first:=(p_draft->>'startDate')::date; v_last:=(p_draft->>'endDate')::date; v_zone:=p_draft->>'timeZone';
  if v_first is null or v_last is null or v_last<v_first or v_last-v_first>365
    or not exists(select 1 from pg_catalog.pg_timezone_names where name=v_zone)
    or jsonb_array_length(p_draft->'slots') not between 1 and 28
    or jsonb_array_length(p_draft->'excludedDates')>366 then
    raise exception 'Invalid date range, time zone or weekly slots' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(p_draft->'excludedDates') e where jsonb_typeof(e)<>'string'
    or (e#>>'{}') !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$'
    or (e#>>'{}')::date not between v_first and v_last) then raise exception 'Invalid excluded date' using errcode='22023'; end if;
  if p_coach_user_id is not null then
    perform 1 from public.gym_memberships where gym_id=p_gym_id and user_id=p_coach_user_id
      and membership_status in ('active','trial') and role in ('leader','officer','coach') for share;
    if not found then raise exception 'Coach must be active staff of this gym' using errcode='42501'; end if;
  end if;
  v_hash:=sha256(convert_to(jsonb_build_array(p_draft,p_capacity,p_description,p_coach_user_id)::text,'UTF8'));
  perform pg_catalog.pg_advisory_xact_lock(hashtextextended(v_id::text,93717));
  select * into v_existing from public.gym_class_series where id=v_id for update;
  if found then
    if v_existing.gym_id<>p_gym_id or v_existing.created_by<>auth.uid() or v_existing.request_hash<>v_hash then
      raise exception 'Series request conflicts with an existing publication' using errcode='40001'; end if;
    return jsonb_build_object('seriesId',v_id,'occurrences',v_existing.publication_receipt,'replayed',true);
  end if;
  for v_slot in select value from jsonb_array_elements(p_draft->'slots') loop
    if jsonb_typeof(v_slot)<>'object' or coalesce(v_slot->>'id','') !~ '^[A-Za-z0-9_-]{1,80}$'
      or v_slot->>'id'=any(v_slot_ids) or coalesce(v_slot->>'weekday','') !~ '^[1-7]$'
      or coalesce(v_slot->>'startTime','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      or coalesce(v_slot->>'endTime','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      or v_slot->>'endTime'<=v_slot->>'startTime' then raise exception 'Invalid weekly slot' using errcode='22023'; end if;
    v_slot_ids:=array_append(v_slot_ids,v_slot->>'id');
  end loop;
  if exists(select 1 from jsonb_array_elements(p_draft->'slots') a cross join jsonb_array_elements(p_draft->'slots') b
    where a->>'id'<b->>'id' and a->>'weekday'=b->>'weekday'
      and a->>'startTime'<b->>'endTime' and b->>'startTime'<a->>'endTime') then
    raise exception 'Weekly slots overlap' using errcode='22023'; end if;
  insert into public.gym_class_series(id,gym_id,created_by,title,description,capacity,coach_user_id,time_zone,schedule,request_hash)
    values(v_id,p_gym_id,auth.uid(),btrim(p_draft->>'title'),p_description,p_capacity,p_coach_user_id,v_zone,p_draft,v_hash);
  for v_date in select d::date from generate_series(v_first::timestamp,v_last::timestamp,interval '1 day') d loop
    if (p_draft->'excludedDates') ? v_date::text then continue; end if;
    for v_slot in select value from jsonb_array_elements(p_draft->'slots') where (value->>'weekday')::int=extract(isodow from v_date) loop
      v_start:=public.class_series_instant(v_date+(v_slot->>'startTime')::time,v_zone);
      v_end:=public.class_series_instant(v_date+(v_slot->>'endTime')::time,v_zone);
      if v_start<=now() or v_end<=v_start then raise exception 'Series must contain only future, positive-duration occurrences' using errcode='22023'; end if;
      v_count:=v_count+1;
      if v_count>1500 then raise exception 'Series exceeds 1500 occurrences' using errcode='22023'; end if;
      insert into public.gym_classes(gym_id,series_id,series_occurrence_key,title,description,coach_user_id,capacity,starts_at,ends_at,booking_opens_at,booking_closes_at)
        values(p_gym_id,v_id,v_id::text||'/'||(v_slot->>'id')||'/'||v_date::text,btrim(p_draft->>'title'),p_description,p_coach_user_id,p_capacity,v_start,v_end,now(),v_start);
    end loop;
  end loop;
  if v_count=0 then raise exception 'No publishable occurrences' using errcode='22023'; end if;
  perform public.append_audit_log('class.series_published','gym_class_series',v_id,'Staff published class series',jsonb_build_object('gymId',p_gym_id,'occurrences',v_count));
  select jsonb_agg(jsonb_build_object('id',id,'key',series_occurrence_key,'startsAt',starts_at,'endsAt',ends_at) order by starts_at)
    into v_rows from public.gym_classes where series_id=v_id;
  update public.gym_class_series set publication_receipt=v_rows where id=v_id;
  return jsonb_build_object('seriesId',v_id,'occurrences',v_rows,'replayed',false);
end;
$$;
revoke all on function public.publish_gym_class_series(uuid,jsonb,integer,text,uuid) from public,anon,service_role;
grant execute on function public.publish_gym_class_series(uuid,jsonb,integer,text,uuid) to authenticated;

create function public.subscribe_gym_class_series(p_series_id uuid,p_subscribed boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_gym uuid;
begin
  if auth.uid() is null or p_subscribed is null then raise exception 'Authenticated subscription decision required' using errcode='42501'; end if;
  select gym_id into v_gym from public.gym_class_series where id=p_series_id for share;
  if v_gym is null then raise exception 'Series unavailable' using errcode='42501'; end if;
  if p_subscribed then
    perform 1 from public.gym_memberships where gym_id=v_gym and user_id=auth.uid() and membership_status in ('active','trial') for share;
    if not found then raise exception 'Active gym membership required' using errcode='42501'; end if;
    insert into public.gym_class_series_subscriptions(series_id,user_id) values(p_series_id,auth.uid()) on conflict do nothing;
  else
    delete from public.gym_class_series_subscriptions where series_id=p_series_id and user_id=auth.uid();
  end if;
  return jsonb_build_object('seriesId',p_series_id,'subscribed',p_subscribed);
end;
$$;
revoke all on function public.subscribe_gym_class_series(uuid,boolean) from public,anon,service_role;
grant execute on function public.subscribe_gym_class_series(uuid,boolean) to authenticated;

create function public.announce_gym_class_series(p_series_id uuid,p_audience text,p_body text,p_request_id uuid,
  p_class_id uuid default null,p_cancel_occurrence boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_gym uuid; v_zone text; v_start timestamptz; v_hash bytea;
  v_message public.gym_class_announcements; v_recipients uuid[]; v_status public.class_status;
begin
  select gym_id,time_zone into v_gym,v_zone from public.gym_class_series where id=p_series_id for share;
  if v_gym is null then raise exception 'Series unavailable' using errcode='42501'; end if;
  if p_audience is null or p_audience not in ('series_subscribers','occurrence_attendees') or p_body is null
    or length(btrim(p_body)) not between 1 and 2000 or p_request_id is null or p_cancel_occurrence is null
    or (p_audience='series_subscribers' and (p_class_id is not null or p_cancel_occurrence))
    or (p_audience='occurrence_attendees' and p_class_id is null) then raise exception 'Invalid announcement scope' using errcode='22023'; end if;
  if p_class_id is not null then
    select status,starts_at into v_status,v_start from public.gym_classes where id=p_class_id and series_id=p_series_id and gym_id=v_gym for update;
    if not found then raise exception 'Occurrence does not belong to this series' using errcode='42501'; end if;
  end if;
  -- Match existing class lifecycle order: occurrence first, then memberships.
  perform public.require_class_series_staff(v_gym);
  if p_class_id is null then
    if public.gym_staff_can(v_gym,'class.assign_coach') is distinct from true then
      raise exception 'Only a gym leader or officer can announce to series subscribers' using errcode='42501'; end if;
  elsif public.gym_staff_can(v_gym,case when p_cancel_occurrence then 'class.cancel' else 'class.edit' end,null,p_class_id) is distinct from true then
    raise exception 'Only authorized staff can announce or cancel this occurrence' using errcode='42501';
  end if;
  v_hash:=sha256(convert_to(jsonb_build_array(p_series_id,p_audience,btrim(p_body),p_class_id,p_cancel_occurrence)::text,'UTF8'));
  perform pg_catalog.pg_advisory_xact_lock(hashtextextended(v_gym::text||p_request_id::text,93718));
  select * into v_message from public.gym_class_announcements where gym_id=v_gym and request_id=p_request_id;
  if found then
    if v_message.created_by is distinct from auth.uid() or v_message.request_hash<>v_hash then
      raise exception 'Announcement request conflicts' using errcode='40001'; end if;
    return jsonb_build_object('announcementId',v_message.id,'recipientCount',v_message.recipient_count,'replayed',true,'channel','in_app');
  end if;
  if p_cancel_occurrence and v_status<>'scheduled' then raise exception 'Only scheduled occurrences can be cancelled' using errcode='22023'; end if;
  -- Resolve and lock current eligible memberships before the cancellation
  -- changes booking status. One row per person, never the entire gym by default.
  select coalesce(array_agg(user_id),'{}') into v_recipients from (
    select m.user_id from public.gym_memberships m where m.gym_id=v_gym and m.membership_status in ('active','trial') and (
      (p_audience='series_subscribers' and exists(select 1 from public.gym_class_series_subscriptions s where s.series_id=p_series_id and s.user_id=m.user_id))
      or (p_audience='occurrence_attendees' and (exists(select 1 from public.class_bookings b where b.class_id=p_class_id and b.user_id=m.user_id and b.status in ('booked','waitlisted'))
        or exists(select 1 from public.class_waitlist w where w.class_id=p_class_id and w.user_id=m.user_id and w.status='pending')))
    ) for share of m
  ) eligible;
  insert into public.gym_class_announcements(gym_id,series_id,class_id,audience,occurrence_starts_at,time_zone,body,created_by,request_id,request_hash,recipient_count)
    values(v_gym,p_series_id,p_class_id,p_audience,v_start,v_zone,btrim(p_body),auth.uid(),p_request_id,v_hash,cardinality(v_recipients)) returning * into v_message;
  insert into public.gym_class_announcement_recipients(announcement_id,gym_id,user_id)
    select v_message.id,v_gym,u from unnest(v_recipients) u;
  if p_cancel_occurrence then perform public.update_gym_class_by_staff(p_class_id,'{"status":"cancelled"}'::jsonb); end if;
  perform public.append_audit_log('class.announcement_posted','gym_class_announcements',v_message.id,'Staff posted in-app class announcement',
    jsonb_build_object('gymId',v_gym,'recipients',cardinality(v_recipients),'cancelled',p_cancel_occurrence));
  return jsonb_build_object('announcementId',v_message.id,'recipientCount',cardinality(v_recipients),'replayed',false,'channel','in_app');
end;
$$;
revoke all on function public.announce_gym_class_series(uuid,text,text,uuid,uuid,boolean) from public,anon,service_role;
grant execute on function public.announce_gym_class_series(uuid,text,text,uuid,uuid,boolean) to authenticated;
commit;
