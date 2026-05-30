-- PT / staff private coaching workspace.
-- Pro/Enterprise capability, coach-scoped athlete data, plan publishing,
-- per-exercise swaps, private notes, sessions, messages, and goals.

insert into public.platform_capability_catalog (
  capability_key,
  category,
  sort_order,
  label,
  description,
  value_type,
  global_bool_default,
  global_limit_default,
  is_billing_sensitive,
  metadata
)
values (
  'private_coaching_workspace',
  'operations',
  180,
  'Private coaching workspace',
  'Coach-scoped athlete workspace with plan publishing, messages, sessions, notes, goals, and sensitive-data controls.',
  'boolean',
  false,
  null,
  false,
  '{"tier":"pro","sensitiveData":true,"warning":"Disabling hides the PT workspace and blocks plan/message/session actions."}'::jsonb
)
on conflict (capability_key) do update
set
  category = excluded.category,
  sort_order = excluded.sort_order,
  label = excluded.label,
  description = excluded.description,
  value_type = excluded.value_type,
  global_bool_default = excluded.global_bool_default,
  global_limit_default = excluded.global_limit_default,
  is_billing_sensitive = excluded.is_billing_sensitive,
  metadata = public.platform_capability_catalog.metadata || excluded.metadata,
  updated_at = now();

insert into public.platform_entitlement_template_capabilities (template_key, capability_key, bool_value, limit_value)
values
  ('starter', 'private_coaching_workspace', false, null),
  ('pro', 'private_coaching_workspace', true, null),
  ('enterprise', 'private_coaching_workspace', true, null)
on conflict (template_key, capability_key) do update
set
  bool_value = excluded.bool_value,
  limit_value = excluded.limit_value,
  updated_at = now();

alter table public.gym_member_workout_plans
  add column if not exists published_at timestamptz,
  add column if not exists published_by uuid references public.profiles(id) on delete set null,
  add column if not exists version_number integer not null default 1 check (version_number > 0),
  add column if not exists parent_plan_id uuid references public.gym_member_workout_plans(id) on delete set null,
  add column if not exists template_key text,
  add column if not exists source text not null default 'manual'
    check (source in ('manual', 'template', 'ai_draft', 'import'));

create index if not exists idx_gym_member_workout_plans_published
  on public.gym_member_workout_plans(gym_id, member_user_id, published_at desc)
  where published_at is not null;

create table if not exists public.coach_plan_templates (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  coach_user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  goal text,
  plan_json jsonb not null default '{}'::jsonb,
  is_shared boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coach_athlete_notes (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  coach_user_id uuid not null references public.profiles(id) on delete cascade,
  member_user_id uuid not null references public.profiles(id) on delete cascade,
  note_type text not null default 'session_note'
    check (note_type in ('session_note', 'injury', 'preference', 'technique', 'crm', 'risk', 'general')),
  title text not null,
  body text not null,
  visibility text not null default 'coach_private'
    check (visibility in ('coach_private', 'member_visible')),
  sensitive boolean not null default true,
  retention_until timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coach_athlete_messages (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  coach_user_id uuid not null references public.profiles(id) on delete cascade,
  member_user_id uuid not null references public.profiles(id) on delete cascade,
  sender_user_id uuid not null references public.profiles(id) on delete cascade,
  message_type text not null default 'direct'
    check (message_type in ('direct', 'broadcast', 'system')),
  body text,
  attachment_type text
    check (attachment_type is null or attachment_type in ('plan', 'exercise', 'video', 'photo', 'session', 'goal', 'note')),
  attachment_ref jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  retained_until timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (body is not null or attachment_type is not null)
);

create table if not exists public.coach_sessions (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  coach_user_id uuid not null references public.profiles(id) on delete cascade,
  member_user_id uuid not null references public.profiles(id) on delete cascade,
  staff_shift_id uuid references public.staff_shifts(id) on delete set null,
  title text not null default '1:1 coaching session',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'confirmed', 'completed', 'missed', 'cancelled')),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.gym_workout_plan_exercise_swaps (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  workout_plan_id uuid not null references public.gym_member_workout_plans(id) on delete cascade,
  member_user_id uuid not null references public.profiles(id) on delete cascade,
  coach_user_id uuid not null references public.profiles(id) on delete cascade,
  exercise_path jsonb not null default '{}'::jsonb,
  original_exercise text not null,
  replacement_exercise text not null,
  reason text,
  created_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.coach_athlete_goals (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  coach_user_id uuid not null references public.profiles(id) on delete cascade,
  member_user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  metric_key text,
  target_value numeric(12,2),
  current_value numeric(12,2),
  unit text,
  due_at date,
  status text not null default 'active'
    check (status in ('active', 'achieved', 'paused', 'archived')),
  created_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coach_athlete_progress_photos (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  coach_user_id uuid not null references public.profiles(id) on delete cascade,
  member_user_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  caption text,
  consent_granted boolean not null default false,
  visibility text not null default 'coach_private'
    check (visibility in ('coach_private', 'member_visible')),
  created_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_coach_plan_templates_gym_coach
  on public.coach_plan_templates(gym_id, coach_user_id, updated_at desc);

create index if not exists idx_coach_plan_templates_shared
  on public.coach_plan_templates(gym_id, is_shared, updated_at desc)
  where is_shared = true;

create index if not exists idx_coach_athlete_notes_pair
  on public.coach_athlete_notes(gym_id, coach_user_id, member_user_id, updated_at desc);

create index if not exists idx_coach_athlete_messages_pair
  on public.coach_athlete_messages(gym_id, coach_user_id, member_user_id, created_at desc);

create index if not exists idx_coach_athlete_messages_unread
  on public.coach_athlete_messages(gym_id, coach_user_id, read_at)
  where read_at is null;

create index if not exists idx_coach_sessions_pair_time
  on public.coach_sessions(gym_id, coach_user_id, member_user_id, starts_at desc);

create index if not exists idx_coach_sessions_staff_shift
  on public.coach_sessions(staff_shift_id)
  where staff_shift_id is not null;

create index if not exists idx_gym_workout_plan_exercise_swaps_plan
  on public.gym_workout_plan_exercise_swaps(workout_plan_id, created_at desc);

create index if not exists idx_coach_athlete_goals_pair
  on public.coach_athlete_goals(gym_id, coach_user_id, member_user_id, status, updated_at desc);

create index if not exists idx_coach_athlete_progress_photos_pair
  on public.coach_athlete_progress_photos(gym_id, coach_user_id, member_user_id, created_at desc);

drop trigger if exists trg_coach_plan_templates_set_updated_at on public.coach_plan_templates;
create trigger trg_coach_plan_templates_set_updated_at
before update on public.coach_plan_templates
for each row execute function public.set_updated_at();

drop trigger if exists trg_coach_athlete_notes_set_updated_at on public.coach_athlete_notes;
create trigger trg_coach_athlete_notes_set_updated_at
before update on public.coach_athlete_notes
for each row execute function public.set_updated_at();

drop trigger if exists trg_coach_sessions_set_updated_at on public.coach_sessions;
create trigger trg_coach_sessions_set_updated_at
before update on public.coach_sessions
for each row execute function public.set_updated_at();

drop trigger if exists trg_coach_athlete_goals_set_updated_at on public.coach_athlete_goals;
create trigger trg_coach_athlete_goals_set_updated_at
before update on public.coach_athlete_goals
for each row execute function public.set_updated_at();

create or replace function public.gym_capability_enabled(
  p_gym_id uuid,
  p_capability_key text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_key text := lower(trim(coalesce(p_capability_key, '')));
  v_template_key text;
  v_enabled boolean;
begin
  if p_gym_id is null or v_key = '' then
    return false;
  end if;

  select gta.template_key
  into v_template_key
  from public.gym_entitlement_template_assignments gta
  join public.platform_entitlement_templates pet
    on pet.template_key = gta.template_key
   and pet.is_active = true
  where gta.gym_id = p_gym_id
  limit 1;

  if v_template_key is null then
    select pp.entitlement_template_key
    into v_template_key
    from public.gym_platform_subscriptions gps
    join public.platform_plans pp on pp.id = gps.platform_plan_id
    where gps.gym_id = p_gym_id
      and gps.status in ('trialing', 'active', 'past_due', 'unpaid')
      and pp.entitlement_template_key is not null
    order by gps.created_at desc
    limit 1;
  end if;

  select coalesce(go.bool_value, ptc.bool_value, c.global_bool_default)
  into v_enabled
  from public.platform_capability_catalog c
  left join public.platform_entitlement_template_capabilities ptc
    on ptc.template_key = v_template_key
   and ptc.capability_key = c.capability_key
  left join public.gym_capability_overrides go
    on go.gym_id = p_gym_id
   and go.capability_key = c.capability_key
  where c.capability_key = v_key
    and c.value_type = 'boolean'
  limit 1;

  return coalesce(v_enabled, false);
end;
$$;

create or replace function public.coach_is_assigned_to_athlete(
  p_gym_id uuid,
  p_member_user_id uuid,
  p_coach_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_gym_id is not null
    and p_member_user_id is not null
    and p_coach_user_id is not null
    and public.gym_capability_enabled(p_gym_id, 'private_coaching_workspace')
    and exists (
      select 1
      from public.gym_memberships coach
      where coach.gym_id = p_gym_id
        and coach.user_id = p_coach_user_id
        and coach.membership_status in ('trial', 'active')
        and coach.role in ('leader', 'officer', 'coach')
    )
    and exists (
      select 1
      from public.gym_memberships athlete
      where athlete.gym_id = p_gym_id
        and athlete.user_id = p_member_user_id
        and athlete.coach_user_id = p_coach_user_id
        and athlete.membership_status in ('trial', 'active', 'paused')
        and athlete.role = 'member'
    );
$$;

create or replace function public.coach_require_workspace_access(
  p_gym_id uuid
)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  if not public.gym_capability_enabled(p_gym_id, 'private_coaching_workspace') then
    raise exception 'Private coaching workspace is not enabled for this gym';
  end if;

  if not exists (
    select 1
    from public.gym_memberships gm
    where gm.gym_id = p_gym_id
      and gm.user_id = v_actor
      and gm.membership_status in ('trial', 'active')
      and gm.role in ('leader', 'officer', 'coach')
  ) then
    raise exception 'Coach workspace access is required';
  end if;

  return v_actor;
end;
$$;

create or replace function public.coach_validate_subjects()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.coach_is_assigned_to_athlete(new.gym_id, new.member_user_id, new.coach_user_id) then
    raise exception 'Coach must be assigned to this athlete';
  end if;

  if new.created_by is null then
    new.created_by := auth.uid();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_coach_athlete_notes_validate_subjects on public.coach_athlete_notes;
create trigger trg_coach_athlete_notes_validate_subjects
before insert or update of gym_id, coach_user_id, member_user_id
on public.coach_athlete_notes
for each row execute function public.coach_validate_subjects();

drop trigger if exists trg_coach_sessions_validate_subjects on public.coach_sessions;
create trigger trg_coach_sessions_validate_subjects
before insert or update of gym_id, coach_user_id, member_user_id
on public.coach_sessions
for each row execute function public.coach_validate_subjects();

drop trigger if exists trg_gym_workout_plan_exercise_swaps_validate_subjects on public.gym_workout_plan_exercise_swaps;
create trigger trg_gym_workout_plan_exercise_swaps_validate_subjects
before insert or update of gym_id, coach_user_id, member_user_id
on public.gym_workout_plan_exercise_swaps
for each row execute function public.coach_validate_subjects();

drop trigger if exists trg_coach_athlete_goals_validate_subjects on public.coach_athlete_goals;
create trigger trg_coach_athlete_goals_validate_subjects
before insert or update of gym_id, coach_user_id, member_user_id
on public.coach_athlete_goals
for each row execute function public.coach_validate_subjects();

drop trigger if exists trg_coach_athlete_progress_photos_validate_subjects on public.coach_athlete_progress_photos;
create trigger trg_coach_athlete_progress_photos_validate_subjects
before insert or update of gym_id, coach_user_id, member_user_id
on public.coach_athlete_progress_photos
for each row execute function public.coach_validate_subjects();

create or replace function public.coach_validate_message_subjects()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.coach_is_assigned_to_athlete(new.gym_id, new.member_user_id, new.coach_user_id) then
    raise exception 'Coach must be assigned to this athlete';
  end if;

  if new.sender_user_id not in (new.coach_user_id, new.member_user_id) then
    raise exception 'Message sender must be the coach or athlete';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_coach_athlete_messages_validate_subjects on public.coach_athlete_messages;
create trigger trg_coach_athlete_messages_validate_subjects
before insert or update of gym_id, coach_user_id, member_user_id, sender_user_id
on public.coach_athlete_messages
for each row execute function public.coach_validate_message_subjects();

create or replace function public.coach_list_my_athletes(
  p_gym_id uuid
)
returns table (
  membership_id uuid,
  member_user_id uuid,
  display_name text,
  username text,
  avatar_url text,
  membership_status public.membership_status,
  membership_plan_id uuid,
  membership_plan_name text,
  last_session_at timestamptz,
  next_session_at timestamptz,
  adherence_percent numeric,
  needs_attention boolean,
  needs_attention_reasons text[],
  unread_messages integer,
  latest_plan_id uuid,
  latest_plan_title text,
  latest_plan_status text,
  latest_plan_updated_at timestamptz,
  last_workout_at timestamptz,
  checkins_30d integer,
  workouts_30d integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.coach_require_workspace_access(p_gym_id);
begin
  return query
  with roster as (
    select
      gm.id as membership_id,
      gm.user_id as member_user_id,
      gm.membership_status,
      gm.membership_plan_id,
      p.display_name,
      p.username,
      p.avatar_url,
      gmp.name as membership_plan_name
    from public.gym_memberships gm
    join public.profiles p on p.id = gm.user_id
    left join public.gym_membership_plans gmp on gmp.id = gm.membership_plan_id
    where gm.gym_id = p_gym_id
      and gm.coach_user_id = v_actor
      and gm.membership_status in ('trial', 'active', 'paused')
      and gm.role = 'member'
  ),
  latest_plan as (
    select distinct on (gwp.member_user_id)
      gwp.member_user_id,
      gwp.id,
      gwp.title,
      gwp.status,
      gwp.updated_at
    from public.gym_member_workout_plans gwp
    where gwp.gym_id = p_gym_id
      and gwp.coach_user_id = v_actor
    order by gwp.member_user_id, gwp.updated_at desc
  ),
  session_stats as (
    select
      cs.member_user_id,
      max(cs.starts_at) filter (where cs.status = 'completed') as last_session_at,
      min(cs.starts_at) filter (where cs.status in ('scheduled', 'confirmed') and cs.starts_at >= now()) as next_session_at,
      count(*) filter (
        where cs.starts_at >= now() - interval '30 days'
          and cs.starts_at <= now()
          and cs.status in ('scheduled', 'confirmed', 'completed', 'missed')
      )::integer as scheduled_sessions_30d,
      count(*) filter (
        where cs.starts_at >= now() - interval '30 days'
          and cs.starts_at <= now()
          and cs.status = 'completed'
      )::integer as completed_sessions_30d
    from public.coach_sessions cs
    where cs.gym_id = p_gym_id
      and cs.coach_user_id = v_actor
    group by cs.member_user_id
  ),
  workout_stats as (
    select
      w.user_id as member_user_id,
      max(w.started_at) as last_workout_at,
      count(*) filter (where w.started_at >= now() - interval '30 days')::integer as workouts_30d
    from public.workouts w
    where w.gym_id = p_gym_id
      and exists (select 1 from roster r where r.member_user_id = w.user_id)
    group by w.user_id
  ),
  checkin_stats as (
    select
      gc.user_id as member_user_id,
      count(*) filter (where gc.checked_in_at >= now() - interval '30 days')::integer as checkins_30d
    from public.gym_checkins gc
    where gc.gym_id = p_gym_id
      and exists (select 1 from roster r where r.member_user_id = gc.user_id)
    group by gc.user_id
  ),
  unread_stats as (
    select
      cam.member_user_id,
      count(*)::integer as unread_messages
    from public.coach_athlete_messages cam
    where cam.gym_id = p_gym_id
      and cam.coach_user_id = v_actor
      and cam.sender_user_id <> v_actor
      and cam.read_at is null
    group by cam.member_user_id
  ),
  scored as (
    select
      r.*,
      lp.id as latest_plan_id,
      lp.title as latest_plan_title,
      lp.status as latest_plan_status,
      lp.updated_at as latest_plan_updated_at,
      ss.last_session_at,
      ss.next_session_at,
      ws.last_workout_at,
      coalesce(cs.checkins_30d, 0) as checkins_30d,
      coalesce(ws.workouts_30d, 0) as workouts_30d,
      coalesce(us.unread_messages, 0) as unread_messages,
      case
        when coalesce(ss.scheduled_sessions_30d, 0) > 0 then
          round((coalesce(ss.completed_sessions_30d, 0)::numeric / ss.scheduled_sessions_30d::numeric) * 100, 0)
        else
          least(100::numeric, coalesce(ws.workouts_30d, 0)::numeric * 12.5)
      end as adherence_percent
    from roster r
    left join latest_plan lp on lp.member_user_id = r.member_user_id
    left join session_stats ss on ss.member_user_id = r.member_user_id
    left join workout_stats ws on ws.member_user_id = r.member_user_id
    left join checkin_stats cs on cs.member_user_id = r.member_user_id
    left join unread_stats us on us.member_user_id = r.member_user_id
  )
  select
    s.membership_id,
    s.member_user_id,
    s.display_name,
    s.username,
    s.avatar_url,
    s.membership_status,
    s.membership_plan_id,
    s.membership_plan_name,
    s.last_session_at,
    s.next_session_at,
    s.adherence_percent,
    cardinality(array_remove(array[
      case when s.unread_messages > 0 then 'message_unread' end,
      case when s.latest_plan_id is null then 'unassigned_to_plan' end,
      case when s.last_workout_at is null or s.last_workout_at < now() - interval '14 days' then 'stalled_progress' end,
      case when s.adherence_percent < 60 then 'adherence_drop' end
    ], null)) > 0 as needs_attention,
    array_remove(array[
      case when s.unread_messages > 0 then 'message_unread' end,
      case when s.latest_plan_id is null then 'unassigned_to_plan' end,
      case when s.last_workout_at is null or s.last_workout_at < now() - interval '14 days' then 'stalled_progress' end,
      case when s.adherence_percent < 60 then 'adherence_drop' end
    ], null)::text[] as needs_attention_reasons,
    s.unread_messages,
    s.latest_plan_id,
    s.latest_plan_title,
    s.latest_plan_status,
    s.latest_plan_updated_at,
    s.last_workout_at,
    s.checkins_30d,
    s.workouts_30d
  from scored s
  order by needs_attention desc, s.next_session_at asc nulls last, s.display_name asc;
end;
$$;

create or replace function public.coach_get_athlete_private_workspace(
  p_gym_id uuid,
  p_member_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.coach_require_workspace_access(p_gym_id);
  v_is_assigned boolean := public.coach_is_assigned_to_athlete(p_gym_id, p_member_user_id, v_actor);
  v_response jsonb;
begin
  if not v_is_assigned then
    perform public.append_audit_log(
      'coach.workspace.masked_access',
      'gym_memberships',
      null,
      'Coach workspace access masked because athlete is not assigned to actor',
      jsonb_build_object('gymId', p_gym_id, 'memberUserId', p_member_user_id)
    );

    return jsonb_build_object(
      'masked', true,
      'profile', jsonb_build_object(
        'memberUserId', p_member_user_id,
        'displayName', 'Private athlete',
        'username', null,
        'avatarUrl', null
      ),
      'stats', '{}'::jsonb,
      'plans', '[]'::jsonb,
      'messages', '[]'::jsonb,
      'sessions', '[]'::jsonb,
      'notes', '[]'::jsonb,
      'goals', '[]'::jsonb,
      'exerciseSwaps', '[]'::jsonb,
      'activity', '[]'::jsonb
    );
  end if;

  with membership as (
    select
      gm.id as membership_id,
      gm.membership_status,
      gm.membership_plan_id,
      p.id as member_user_id,
      p.display_name,
      p.username,
      p.avatar_url,
      gmp.name as membership_plan_name
    from public.gym_memberships gm
    join public.profiles p on p.id = gm.user_id
    left join public.gym_membership_plans gmp on gmp.id = gm.membership_plan_id
    where gm.gym_id = p_gym_id
      and gm.user_id = p_member_user_id
      and gm.coach_user_id = v_actor
    limit 1
  ),
  plan_rows as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', gwp.id,
        'title', gwp.title,
        'goal', gwp.goal,
        'status', gwp.status,
        'startsAt', gwp.starts_at,
        'endsAt', gwp.ends_at,
        'planJson', gwp.plan_json,
        'versionNumber', gwp.version_number,
        'publishedAt', gwp.published_at,
        'source', gwp.source,
        'updatedAt', gwp.updated_at
      )
      order by gwp.updated_at desc
    ), '[]'::jsonb) as plans
    from (
      select *
      from public.gym_member_workout_plans gwp
      where gwp.gym_id = p_gym_id
        and gwp.member_user_id = p_member_user_id
        and gwp.coach_user_id = v_actor
      order by gwp.updated_at desc
      limit 10
    ) gwp
  ),
  message_rows as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', cam.id,
        'senderUserId', cam.sender_user_id,
        'messageType', cam.message_type,
        'body', cam.body,
        'attachmentType', cam.attachment_type,
        'attachmentRef', cam.attachment_ref,
        'readAt', cam.read_at,
        'createdAt', cam.created_at
      )
      order by cam.created_at asc
    ), '[]'::jsonb) as messages
    from (
      select *
      from public.coach_athlete_messages cam
      where cam.gym_id = p_gym_id
        and cam.member_user_id = p_member_user_id
        and cam.coach_user_id = v_actor
      order by cam.created_at desc
      limit 30
    ) cam
  ),
  session_rows as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', cs.id,
        'staffShiftId', cs.staff_shift_id,
        'title', cs.title,
        'startsAt', cs.starts_at,
        'endsAt', cs.ends_at,
        'status', cs.status,
        'notes', cs.notes,
        'createdAt', cs.created_at
      )
      order by cs.starts_at desc
    ), '[]'::jsonb) as sessions
    from (
      select *
      from public.coach_sessions cs
      where cs.gym_id = p_gym_id
        and cs.member_user_id = p_member_user_id
        and cs.coach_user_id = v_actor
      order by cs.starts_at desc
      limit 30
    ) cs
  ),
  note_rows as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', cano.id,
        'noteType', cano.note_type,
        'title', cano.title,
        'body', cano.body,
        'visibility', cano.visibility,
        'sensitive', cano.sensitive,
        'createdAt', cano.created_at,
        'updatedAt', cano.updated_at
      )
      order by cano.updated_at desc
    ), '[]'::jsonb) as notes
    from (
      select *
      from public.coach_athlete_notes cano
      where cano.gym_id = p_gym_id
        and cano.member_user_id = p_member_user_id
        and cano.coach_user_id = v_actor
      order by cano.updated_at desc
      limit 20
    ) cano
  ),
  goal_rows as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', cag.id,
        'title', cag.title,
        'metricKey', cag.metric_key,
        'targetValue', cag.target_value,
        'currentValue', cag.current_value,
        'unit', cag.unit,
        'dueAt', cag.due_at,
        'status', cag.status,
        'updatedAt', cag.updated_at
      )
      order by cag.updated_at desc
    ), '[]'::jsonb) as goals
    from public.coach_athlete_goals cag
    where cag.gym_id = p_gym_id
      and cag.member_user_id = p_member_user_id
      and cag.coach_user_id = v_actor
      and cag.status <> 'archived'
  ),
  swap_rows as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', gps.id,
        'workoutPlanId', gps.workout_plan_id,
        'exercisePath', gps.exercise_path,
        'originalExercise', gps.original_exercise,
        'replacementExercise', gps.replacement_exercise,
        'reason', gps.reason,
        'createdAt', gps.created_at
      )
      order by gps.created_at desc
    ), '[]'::jsonb) as exercise_swaps
    from (
      select *
      from public.gym_workout_plan_exercise_swaps gps
      where gps.gym_id = p_gym_id
        and gps.member_user_id = p_member_user_id
        and gps.coach_user_id = v_actor
      order by gps.created_at desc
      limit 20
    ) gps
  ),
  activity_rows as (
    select coalesce(jsonb_agg(item order by occurred_at desc), '[]'::jsonb) as activity
    from (
      select item, occurred_at
      from (
        select
          jsonb_build_object(
            'type', 'checkin',
            'id', gc.id,
            'title', concat('Check-in ', gc.result),
            'occurredAt', gc.checked_in_at,
            'detail', gc.event_type
          ) as item,
          gc.checked_in_at as occurred_at
        from public.gym_checkins gc
        where gc.gym_id = p_gym_id
          and gc.user_id = p_member_user_id
        union all
        select
          jsonb_build_object(
            'type', 'workout',
            'id', w.id,
            'title', w.title,
            'occurredAt', w.started_at,
            'detail', w.workout_type
          ) as item,
          w.started_at as occurred_at
        from public.workouts w
        where w.gym_id = p_gym_id
          and w.user_id = p_member_user_id
      ) combined_activity
      order by occurred_at desc
      limit 20
    ) activity
  ),
  stats as (
    select jsonb_build_object(
      'checkins30d', (select count(*) from public.gym_checkins gc where gc.gym_id = p_gym_id and gc.user_id = p_member_user_id and gc.checked_in_at >= now() - interval '30 days'),
      'workouts30d', (select count(*) from public.workouts w where w.gym_id = p_gym_id and w.user_id = p_member_user_id and w.started_at >= now() - interval '30 days'),
      'prs90d', (select count(*) from public.workouts w where w.gym_id = p_gym_id and w.user_id = p_member_user_id and w.is_pr = true and w.started_at >= now() - interval '90 days'),
      'latestWorkoutAt', (select max(w.started_at) from public.workouts w where w.gym_id = p_gym_id and w.user_id = p_member_user_id),
      'completedSessions30d', (select count(*) from public.coach_sessions cs where cs.gym_id = p_gym_id and cs.member_user_id = p_member_user_id and cs.coach_user_id = v_actor and cs.status = 'completed' and cs.starts_at >= now() - interval '30 days'),
      'scheduledSessions30d', (select count(*) from public.coach_sessions cs where cs.gym_id = p_gym_id and cs.member_user_id = p_member_user_id and cs.coach_user_id = v_actor and cs.starts_at >= now() - interval '30 days')
    ) as stats
  )
  select jsonb_build_object(
    'masked', false,
    'profile', jsonb_build_object(
      'membershipId', m.membership_id,
      'memberUserId', m.member_user_id,
      'displayName', m.display_name,
      'username', m.username,
      'avatarUrl', m.avatar_url,
      'membershipStatus', m.membership_status,
      'membershipPlanId', m.membership_plan_id,
      'membershipPlanName', m.membership_plan_name
    ),
    'stats', stats.stats,
    'plans', plan_rows.plans,
    'messages', message_rows.messages,
    'sessions', session_rows.sessions,
    'notes', note_rows.notes,
    'goals', goal_rows.goals,
    'exerciseSwaps', swap_rows.exercise_swaps,
    'activity', activity_rows.activity
  )
  into v_response
  from membership m, plan_rows, message_rows, session_rows, note_rows, goal_rows, swap_rows, activity_rows, stats;

  return coalesce(v_response, jsonb_build_object('masked', true));
end;
$$;

create or replace function public.coach_publish_workout_plan(
  p_gym_id uuid,
  p_member_user_id uuid,
  p_title text,
  p_goal text default null,
  p_plan_json jsonb default '{}'::jsonb,
  p_workout_plan_id uuid default null,
  p_source text default 'manual'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.coach_require_workspace_access(p_gym_id);
  v_title text := trim(coalesce(p_title, ''));
  v_source text := coalesce(nullif(lower(trim(coalesce(p_source, 'manual'))), ''), 'manual');
  v_plan public.gym_member_workout_plans%rowtype;
begin
  if not public.coach_is_assigned_to_athlete(p_gym_id, p_member_user_id, v_actor) then
    raise exception 'Coach must be assigned to this athlete';
  end if;

  if v_title = '' then
    raise exception 'Workout plan title is required';
  end if;

  if v_source not in ('manual', 'template', 'ai_draft', 'import') then
    raise exception 'Invalid workout plan source';
  end if;

  if p_workout_plan_id is null then
    insert into public.gym_member_workout_plans (
      gym_id,
      member_user_id,
      coach_user_id,
      title,
      goal,
      status,
      starts_at,
      plan_json,
      created_by,
      published_at,
      published_by,
      version_number,
      source
    )
    values (
      p_gym_id,
      p_member_user_id,
      v_actor,
      v_title,
      nullif(trim(coalesce(p_goal, '')), ''),
      'active',
      current_date,
      coalesce(p_plan_json, '{}'::jsonb),
      v_actor,
      now(),
      v_actor,
      1,
      v_source
    )
    returning * into v_plan;
  else
    update public.gym_member_workout_plans gwp
    set
      title = v_title,
      goal = nullif(trim(coalesce(p_goal, '')), ''),
      status = 'active',
      plan_json = coalesce(p_plan_json, '{}'::jsonb),
      published_at = now(),
      published_by = v_actor,
      version_number = gwp.version_number + 1,
      source = v_source,
      updated_at = now()
    where gwp.id = p_workout_plan_id
      and gwp.gym_id = p_gym_id
      and gwp.member_user_id = p_member_user_id
      and gwp.coach_user_id = v_actor
    returning * into v_plan;

    if v_plan.id is null then
      raise exception 'Workout plan not found for this coach and athlete';
    end if;
  end if;

  perform public.append_audit_log(
    'coach.workout_plan.published',
    'gym_member_workout_plans',
    v_plan.id,
    'Coach published workout plan to athlete app',
    jsonb_build_object(
      'gymId', p_gym_id,
      'memberUserId', p_member_user_id,
      'versionNumber', v_plan.version_number,
      'source', v_plan.source
    )
  );

  return to_jsonb(v_plan);
end;
$$;

create or replace function public.coach_swap_workout_plan_exercise(
  p_gym_id uuid,
  p_workout_plan_id uuid,
  p_member_user_id uuid,
  p_exercise_path jsonb,
  p_original_exercise text,
  p_replacement_exercise text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.coach_require_workspace_access(p_gym_id);
  v_plan public.gym_member_workout_plans%rowtype;
  v_swap public.gym_workout_plan_exercise_swaps%rowtype;
  v_swap_payload jsonb;
begin
  if not public.coach_is_assigned_to_athlete(p_gym_id, p_member_user_id, v_actor) then
    raise exception 'Coach must be assigned to this athlete';
  end if;

  select *
  into v_plan
  from public.gym_member_workout_plans gwp
  where gwp.id = p_workout_plan_id
    and gwp.gym_id = p_gym_id
    and gwp.member_user_id = p_member_user_id
    and gwp.coach_user_id = v_actor
  limit 1;

  if v_plan.id is null then
    raise exception 'Workout plan not found for this coach and athlete';
  end if;

  if trim(coalesce(p_original_exercise, '')) = '' or trim(coalesce(p_replacement_exercise, '')) = '' then
    raise exception 'Original and replacement exercises are required';
  end if;

  insert into public.gym_workout_plan_exercise_swaps (
    gym_id,
    workout_plan_id,
    member_user_id,
    coach_user_id,
    exercise_path,
    original_exercise,
    replacement_exercise,
    reason,
    created_by
  )
  values (
    p_gym_id,
    p_workout_plan_id,
    p_member_user_id,
    v_actor,
    coalesce(p_exercise_path, '{}'::jsonb),
    trim(p_original_exercise),
    trim(p_replacement_exercise),
    nullif(trim(coalesce(p_reason, '')), ''),
    v_actor
  )
  returning * into v_swap;

  v_swap_payload := jsonb_build_object(
    'id', v_swap.id,
    'exercisePath', v_swap.exercise_path,
    'originalExercise', v_swap.original_exercise,
    'replacementExercise', v_swap.replacement_exercise,
    'reason', v_swap.reason,
    'createdAt', v_swap.created_at
  );

  update public.gym_member_workout_plans gwp
  set
    plan_json = jsonb_set(
      coalesce(gwp.plan_json, '{}'::jsonb),
      '{coachSwaps}',
      coalesce(gwp.plan_json->'coachSwaps', '[]'::jsonb) || jsonb_build_array(v_swap_payload),
      true
    ),
    version_number = gwp.version_number + 1,
    published_at = now(),
    published_by = v_actor,
    updated_at = now()
  where gwp.id = v_plan.id;

  perform public.append_audit_log(
    'coach.workout_plan.exercise_swapped',
    'gym_workout_plan_exercise_swaps',
    v_swap.id,
    'Coach swapped one exercise in a published workout plan',
    jsonb_build_object(
      'gymId', p_gym_id,
      'memberUserId', p_member_user_id,
      'workoutPlanId', p_workout_plan_id,
      'originalExercise', v_swap.original_exercise,
      'replacementExercise', v_swap.replacement_exercise
    )
  );

  return to_jsonb(v_swap);
end;
$$;

create or replace function public.coach_send_athlete_message(
  p_gym_id uuid,
  p_member_user_id uuid,
  p_body text default null,
  p_attachment_type text default null,
  p_attachment_ref jsonb default '{}'::jsonb,
  p_message_type text default 'direct'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.coach_require_workspace_access(p_gym_id);
  v_message public.coach_athlete_messages%rowtype;
  v_type text := coalesce(nullif(lower(trim(coalesce(p_message_type, 'direct'))), ''), 'direct');
  v_attachment_type text := nullif(lower(trim(coalesce(p_attachment_type, ''))), '');
begin
  if not public.coach_is_assigned_to_athlete(p_gym_id, p_member_user_id, v_actor) then
    raise exception 'Coach must be assigned to this athlete';
  end if;

  if nullif(trim(coalesce(p_body, '')), '') is null and v_attachment_type is null then
    raise exception 'Message body or attachment is required';
  end if;

  insert into public.coach_athlete_messages (
    gym_id,
    coach_user_id,
    member_user_id,
    sender_user_id,
    message_type,
    body,
    attachment_type,
    attachment_ref,
    retained_until
  )
  values (
    p_gym_id,
    v_actor,
    p_member_user_id,
    v_actor,
    v_type,
    nullif(trim(coalesce(p_body, '')), ''),
    v_attachment_type,
    coalesce(p_attachment_ref, '{}'::jsonb),
    now() + interval '7 years'
  )
  returning * into v_message;

  perform public.append_audit_log(
    'coach.message.sent',
    'coach_athlete_messages',
    v_message.id,
    'Coach sent in-app coaching message',
    jsonb_build_object(
      'gymId', p_gym_id,
      'memberUserId', p_member_user_id,
      'messageType', v_message.message_type,
      'attachmentType', v_message.attachment_type,
      'bodyLength', char_length(coalesce(v_message.body, ''))
    )
  );

  return to_jsonb(v_message);
end;
$$;

create or replace function public.coach_schedule_private_session(
  p_gym_id uuid,
  p_member_user_id uuid,
  p_title text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.coach_require_workspace_access(p_gym_id);
  v_shift_id uuid;
  v_session public.coach_sessions%rowtype;
  v_title text := coalesce(nullif(trim(coalesce(p_title, '')), ''), '1:1 coaching session');
begin
  if not public.coach_is_assigned_to_athlete(p_gym_id, p_member_user_id, v_actor) then
    raise exception 'Coach must be assigned to this athlete';
  end if;

  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then
    raise exception 'Session end must be after start';
  end if;

  insert into public.staff_shifts (
    gym_id,
    staff_user_id,
    created_by,
    title,
    shift_role,
    starts_at,
    ends_at,
    status,
    notes,
    metadata
  )
  values (
    p_gym_id,
    v_actor,
    v_actor,
    v_title,
    'private_coaching',
    p_starts_at,
    p_ends_at,
    'scheduled',
    nullif(trim(coalesce(p_notes, '')), ''),
    jsonb_build_object('source', 'private_coaching_workspace', 'memberUserId', p_member_user_id)
  )
  returning id into v_shift_id;

  insert into public.coach_sessions (
    gym_id,
    coach_user_id,
    member_user_id,
    staff_shift_id,
    title,
    starts_at,
    ends_at,
    status,
    notes,
    created_by,
    metadata
  )
  values (
    p_gym_id,
    v_actor,
    p_member_user_id,
    v_shift_id,
    v_title,
    p_starts_at,
    p_ends_at,
    'scheduled',
    nullif(trim(coalesce(p_notes, '')), ''),
    v_actor,
    jsonb_build_object('syncedToStaffShift', true)
  )
  returning * into v_session;

  perform public.append_audit_log(
    'coach.session.scheduled',
    'coach_sessions',
    v_session.id,
    'Coach scheduled private coaching session',
    jsonb_build_object(
      'gymId', p_gym_id,
      'memberUserId', p_member_user_id,
      'staffShiftId', v_shift_id,
      'startsAt', p_starts_at,
      'endsAt', p_ends_at
    )
  );

  return to_jsonb(v_session);
end;
$$;

create or replace function public.coach_create_athlete_note(
  p_gym_id uuid,
  p_member_user_id uuid,
  p_title text,
  p_body text,
  p_note_type text default 'session_note',
  p_visibility text default 'coach_private'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.coach_require_workspace_access(p_gym_id);
  v_note public.coach_athlete_notes%rowtype;
begin
  if not public.coach_is_assigned_to_athlete(p_gym_id, p_member_user_id, v_actor) then
    raise exception 'Coach must be assigned to this athlete';
  end if;

  if trim(coalesce(p_title, '')) = '' or trim(coalesce(p_body, '')) = '' then
    raise exception 'Note title and body are required';
  end if;

  insert into public.coach_athlete_notes (
    gym_id,
    coach_user_id,
    member_user_id,
    note_type,
    title,
    body,
    visibility,
    retention_until,
    created_by
  )
  values (
    p_gym_id,
    v_actor,
    p_member_user_id,
    coalesce(nullif(lower(trim(coalesce(p_note_type, 'session_note'))), ''), 'session_note'),
    trim(p_title),
    trim(p_body),
    coalesce(nullif(lower(trim(coalesce(p_visibility, 'coach_private'))), ''), 'coach_private'),
    now() + interval '7 years',
    v_actor
  )
  returning * into v_note;

  perform public.append_audit_log(
    'coach.note.created',
    'coach_athlete_notes',
    v_note.id,
    'Coach added private athlete note',
    jsonb_build_object('gymId', p_gym_id, 'memberUserId', p_member_user_id, 'noteType', v_note.note_type)
  );

  return to_jsonb(v_note);
end;
$$;

create or replace function public.coach_upsert_athlete_goal(
  p_gym_id uuid,
  p_member_user_id uuid,
  p_title text,
  p_metric_key text default null,
  p_target_value numeric default null,
  p_current_value numeric default null,
  p_unit text default null,
  p_due_at date default null,
  p_goal_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.coach_require_workspace_access(p_gym_id);
  v_goal public.coach_athlete_goals%rowtype;
begin
  if not public.coach_is_assigned_to_athlete(p_gym_id, p_member_user_id, v_actor) then
    raise exception 'Coach must be assigned to this athlete';
  end if;

  if trim(coalesce(p_title, '')) = '' then
    raise exception 'Goal title is required';
  end if;

  if p_goal_id is null then
    insert into public.coach_athlete_goals (
      gym_id,
      coach_user_id,
      member_user_id,
      title,
      metric_key,
      target_value,
      current_value,
      unit,
      due_at,
      created_by
    )
    values (
      p_gym_id,
      v_actor,
      p_member_user_id,
      trim(p_title),
      nullif(trim(coalesce(p_metric_key, '')), ''),
      p_target_value,
      p_current_value,
      nullif(trim(coalesce(p_unit, '')), ''),
      p_due_at,
      v_actor
    )
    returning * into v_goal;
  else
    update public.coach_athlete_goals cag
    set
      title = trim(p_title),
      metric_key = nullif(trim(coalesce(p_metric_key, '')), ''),
      target_value = p_target_value,
      current_value = p_current_value,
      unit = nullif(trim(coalesce(p_unit, '')), ''),
      due_at = p_due_at,
      updated_at = now()
    where cag.id = p_goal_id
      and cag.gym_id = p_gym_id
      and cag.member_user_id = p_member_user_id
      and cag.coach_user_id = v_actor
    returning * into v_goal;

    if v_goal.id is null then
      raise exception 'Goal not found for this coach and athlete';
    end if;
  end if;

  perform public.append_audit_log(
    'coach.goal.upserted',
    'coach_athlete_goals',
    v_goal.id,
    'Coach updated athlete goal',
    jsonb_build_object('gymId', p_gym_id, 'memberUserId', p_member_user_id)
  );

  return to_jsonb(v_goal);
end;
$$;

create or replace function public.coach_save_plan_template(
  p_gym_id uuid,
  p_title text,
  p_goal text default null,
  p_plan_json jsonb default '{}'::jsonb,
  p_is_shared boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.coach_require_workspace_access(p_gym_id);
  v_template public.coach_plan_templates%rowtype;
begin
  if trim(coalesce(p_title, '')) = '' then
    raise exception 'Template title is required';
  end if;

  insert into public.coach_plan_templates (
    gym_id,
    coach_user_id,
    title,
    goal,
    plan_json,
    is_shared,
    created_by
  )
  values (
    p_gym_id,
    v_actor,
    trim(p_title),
    nullif(trim(coalesce(p_goal, '')), ''),
    coalesce(p_plan_json, '{}'::jsonb),
    coalesce(p_is_shared, false),
    v_actor
  )
  returning * into v_template;

  perform public.append_audit_log(
    'coach.plan_template.saved',
    'coach_plan_templates',
    v_template.id,
    'Coach saved workout plan template',
    jsonb_build_object('gymId', p_gym_id, 'isShared', v_template.is_shared)
  );

  return to_jsonb(v_template);
end;
$$;

create or replace function public.coach_list_plan_templates(
  p_gym_id uuid
)
returns table (
  id uuid,
  gym_id uuid,
  coach_user_id uuid,
  title text,
  goal text,
  plan_json jsonb,
  is_shared boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.coach_require_workspace_access(p_gym_id);
begin
  return query
  select
    cpt.id,
    cpt.gym_id,
    cpt.coach_user_id,
    cpt.title,
    cpt.goal,
    cpt.plan_json,
    cpt.is_shared,
    cpt.created_at,
    cpt.updated_at
  from public.coach_plan_templates cpt
  where cpt.gym_id = p_gym_id
    and (cpt.coach_user_id = v_actor or cpt.is_shared = true)
  order by cpt.is_shared desc, cpt.updated_at desc;
end;
$$;

create or replace function public.platform_get_capability_impact_count(
  p_gym_id uuid,
  p_capability_key text
)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_key text := lower(trim(coalesce(p_capability_key, '')));
  v_count integer := 0;
begin
  if p_gym_id is null then
    return 0;
  end if;

  if v_key = 'member_payments' then
    select count(*)::integer into v_count
    from public.member_subscriptions ms
    where ms.gym_id = p_gym_id
      and ms.status in ('trialing', 'active', 'past_due', 'unpaid');
  elsif v_key = 'kruxt_subscription_billing' then
    select count(*)::integer into v_count
    from public.gym_platform_subscriptions gps
    where gps.gym_id = p_gym_id
      and gps.status in ('trialing', 'active', 'past_due', 'unpaid');
  elsif v_key = 'payment_provider_connection' then
    select (
      (select count(*) from public.member_subscriptions ms where ms.gym_id = p_gym_id and ms.provider = 'stripe' and ms.status in ('trialing', 'active', 'past_due', 'unpaid'))
      + (select count(*) from public.invoice_provider_connections ipc where ipc.gym_id = p_gym_id and ipc.connection_status in ('pending', 'active'))
    )::integer into v_count;
  elsif v_key = 'manual_payment_recording' then
    select count(*)::integer into v_count
    from public.invoices i
    where i.gym_id = p_gym_id
      and i.status in ('draft', 'open');
  elsif v_key = 'refunds_credits' then
    select count(*)::integer into v_count
    from public.refunds r
    join public.payment_transactions pt on pt.id = r.payment_transaction_id
    where pt.gym_id = p_gym_id
      and r.status in ('pending', 'succeeded');
  elsif v_key = 'dunning_retry' then
    select count(*)::integer into v_count
    from public.dunning_events de
    join public.member_subscriptions ms on ms.id = de.subscription_id
    where ms.gym_id = p_gym_id
      and de.stage <> 'cancelled';
  elsif v_key = 'classes_scheduling' then
    select count(*)::integer into v_count
    from public.gym_classes gc
    where gc.gym_id = p_gym_id
      and gc.status = 'scheduled'
      and gc.ends_at >= now();
  elsif v_key = 'check_ins' then
    select count(*)::integer into v_count
    from public.gym_checkins gi
    where gi.gym_id = p_gym_id
      and gi.checked_in_at >= now() - interval '30 days';
  elsif v_key = 'waivers_esign' then
    select count(*)::integer into v_count
    from public.waivers w
    where w.gym_id = p_gym_id
      and w.is_active = true;
  elsif v_key = 'wearable_integrations' then
    select count(*)::integer into v_count
    from public.device_connections dc
    join public.gym_memberships gm on gm.user_id = dc.user_id
    where gm.gym_id = p_gym_id
      and gm.membership_status in ('trial', 'active')
      and dc.status = 'active';
  elsif v_key = 'staff_scheduling' then
    select count(*)::integer into v_count
    from public.staff_shifts ss
    where ss.gym_id = p_gym_id
      and ss.status in ('scheduled', 'confirmed', 'in_progress')
      and ss.ends_at >= now();
  elsif v_key = 'pt_assignment' then
    select count(*)::integer into v_count
    from public.gym_memberships gm
    where gm.gym_id = p_gym_id
      and gm.coach_user_id is not null
      and gm.membership_status in ('trial', 'active', 'paused');
  elsif v_key = 'workout_plans' then
    select count(*)::integer into v_count
    from public.gym_member_workout_plans gwp
    where gwp.gym_id = p_gym_id
      and gwp.status in ('draft', 'active', 'paused');
  elsif v_key = 'private_coaching_workspace' then
    select count(*)::integer into v_count
    from public.gym_memberships gm
    where gm.gym_id = p_gym_id
      and gm.coach_user_id is not null
      and gm.membership_status in ('trial', 'active', 'paused')
      and gm.role = 'member';
  elsif v_key = 'public_page_publish' then
    select count(*)::integer into v_count
    from public.gym_public_page_drafts gppd
    where gppd.gym_id = p_gym_id
      and gppd.status in ('ready', 'published');
  elsif v_key = 'invite_links_qr' then
    select count(*)::integer into v_count
    from public.gym_invite_codes gic
    where gic.gym_id = p_gym_id
      and gic.is_active = true
      and (gic.expires_at is null or gic.expires_at > now());
  elsif v_key = 'self_serve_join_approval' then
    select count(*)::integer into v_count
    from public.gym_join_requests gjr
    where gjr.gym_id = p_gym_id
      and gjr.status = 'pending';
  elsif v_key = 'dsar_handling' then
    select count(distinct pr.id)::integer into v_count
    from public.privacy_requests pr
    join public.gym_memberships gm on gm.user_id = pr.user_id
    where gm.gym_id = p_gym_id
      and public.is_privacy_request_open_status(pr.status);
  elsif v_key = 'data_export' then
    select count(distinct pej.id)::integer into v_count
    from public.privacy_export_jobs pej
    join public.gym_memberships gm on gm.user_id = pej.user_id
    where gm.gym_id = p_gym_id
      and pej.status in ('queued', 'running', 'retry_scheduled');
  elsif v_key = 'member_cap' then
    select count(*)::integer into v_count
    from public.gym_memberships gm
    where gm.gym_id = p_gym_id
      and gm.membership_status in ('trial', 'active');
  elsif v_key = 'staff_seats' then
    select count(*)::integer into v_count
    from public.gym_memberships gm
    where gm.gym_id = p_gym_id
      and gm.membership_status in ('trial', 'active')
      and gm.role in ('leader', 'officer', 'coach');
  else
    v_count := 0;
  end if;

  return coalesce(v_count, 0);
end;
$$;

alter table public.coach_plan_templates enable row level security;
alter table public.coach_athlete_notes enable row level security;
alter table public.coach_athlete_messages enable row level security;
alter table public.coach_sessions enable row level security;
alter table public.gym_workout_plan_exercise_swaps enable row level security;
alter table public.coach_athlete_goals enable row level security;
alter table public.coach_athlete_progress_photos enable row level security;

drop policy if exists coach_plan_templates_select on public.coach_plan_templates;
create policy coach_plan_templates_select
on public.coach_plan_templates for select to authenticated
using (
  public.is_service_role()
  or (
    public.gym_capability_enabled(gym_id, 'private_coaching_workspace')
    and (
      coach_user_id = auth.uid()
      or (is_shared = true and public.is_gym_staff(gym_id, auth.uid()))
    )
  )
);

drop policy if exists coach_plan_templates_insert on public.coach_plan_templates;
create policy coach_plan_templates_insert
on public.coach_plan_templates for insert to authenticated
with check (
  public.is_service_role()
  or (
    coach_user_id = auth.uid()
    and public.gym_capability_enabled(gym_id, 'private_coaching_workspace')
    and public.is_gym_staff(gym_id, auth.uid())
  )
);

drop policy if exists coach_plan_templates_update on public.coach_plan_templates;
create policy coach_plan_templates_update
on public.coach_plan_templates for update to authenticated
using (public.is_service_role() or coach_user_id = auth.uid())
with check (public.is_service_role() or coach_user_id = auth.uid());

drop policy if exists coach_plan_templates_delete on public.coach_plan_templates;
create policy coach_plan_templates_delete
on public.coach_plan_templates for delete to authenticated
using (public.is_service_role() or coach_user_id = auth.uid());

drop policy if exists coach_athlete_notes_select on public.coach_athlete_notes;
create policy coach_athlete_notes_select
on public.coach_athlete_notes for select to authenticated
using (
  public.is_service_role()
  or (
    coach_user_id = auth.uid()
    and public.coach_is_assigned_to_athlete(gym_id, member_user_id, auth.uid())
  )
  or (
    visibility = 'member_visible'
    and member_user_id = auth.uid()
    and public.gym_capability_enabled(gym_id, 'private_coaching_workspace')
  )
);

drop policy if exists coach_athlete_notes_manage on public.coach_athlete_notes;
create policy coach_athlete_notes_manage
on public.coach_athlete_notes for all to authenticated
using (
  public.is_service_role()
  or (
    coach_user_id = auth.uid()
    and public.coach_is_assigned_to_athlete(gym_id, member_user_id, auth.uid())
  )
)
with check (
  public.is_service_role()
  or (
    coach_user_id = auth.uid()
    and public.coach_is_assigned_to_athlete(gym_id, member_user_id, auth.uid())
  )
);

drop policy if exists coach_athlete_messages_select on public.coach_athlete_messages;
create policy coach_athlete_messages_select
on public.coach_athlete_messages for select to authenticated
using (
  public.is_service_role()
  or (
    public.gym_capability_enabled(gym_id, 'private_coaching_workspace')
    and (coach_user_id = auth.uid() or member_user_id = auth.uid())
  )
);

drop policy if exists coach_athlete_messages_insert on public.coach_athlete_messages;
create policy coach_athlete_messages_insert
on public.coach_athlete_messages for insert to authenticated
with check (
  public.is_service_role()
  or (
    sender_user_id = auth.uid()
    and public.gym_capability_enabled(gym_id, 'private_coaching_workspace')
    and (
      (
        coach_user_id = auth.uid()
        and public.coach_is_assigned_to_athlete(gym_id, member_user_id, auth.uid())
      )
      or (
        member_user_id = auth.uid()
        and public.coach_is_assigned_to_athlete(gym_id, member_user_id, coach_user_id)
      )
    )
  )
);

drop policy if exists coach_athlete_messages_update on public.coach_athlete_messages;
create policy coach_athlete_messages_update
on public.coach_athlete_messages for update to authenticated
using (
  public.is_service_role()
  or (
    public.gym_capability_enabled(gym_id, 'private_coaching_workspace')
    and (coach_user_id = auth.uid() or member_user_id = auth.uid())
  )
)
with check (
  public.is_service_role()
  or (
    public.gym_capability_enabled(gym_id, 'private_coaching_workspace')
    and (coach_user_id = auth.uid() or member_user_id = auth.uid())
  )
);

drop policy if exists coach_sessions_select on public.coach_sessions;
create policy coach_sessions_select
on public.coach_sessions for select to authenticated
using (
  public.is_service_role()
  or (
    public.gym_capability_enabled(gym_id, 'private_coaching_workspace')
    and (coach_user_id = auth.uid() or member_user_id = auth.uid())
  )
);

drop policy if exists coach_sessions_manage on public.coach_sessions;
create policy coach_sessions_manage
on public.coach_sessions for all to authenticated
using (
  public.is_service_role()
  or (
    coach_user_id = auth.uid()
    and public.coach_is_assigned_to_athlete(gym_id, member_user_id, auth.uid())
  )
)
with check (
  public.is_service_role()
  or (
    coach_user_id = auth.uid()
    and public.coach_is_assigned_to_athlete(gym_id, member_user_id, auth.uid())
  )
);

drop policy if exists gym_workout_plan_exercise_swaps_select on public.gym_workout_plan_exercise_swaps;
create policy gym_workout_plan_exercise_swaps_select
on public.gym_workout_plan_exercise_swaps for select to authenticated
using (
  public.is_service_role()
  or (
    public.gym_capability_enabled(gym_id, 'private_coaching_workspace')
    and (coach_user_id = auth.uid() or member_user_id = auth.uid())
  )
);

drop policy if exists gym_workout_plan_exercise_swaps_insert on public.gym_workout_plan_exercise_swaps;
create policy gym_workout_plan_exercise_swaps_insert
on public.gym_workout_plan_exercise_swaps for insert to authenticated
with check (
  public.is_service_role()
  or (
    coach_user_id = auth.uid()
    and public.coach_is_assigned_to_athlete(gym_id, member_user_id, auth.uid())
  )
);

drop policy if exists coach_athlete_goals_select on public.coach_athlete_goals;
create policy coach_athlete_goals_select
on public.coach_athlete_goals for select to authenticated
using (
  public.is_service_role()
  or (
    public.gym_capability_enabled(gym_id, 'private_coaching_workspace')
    and (coach_user_id = auth.uid() or member_user_id = auth.uid())
  )
);

drop policy if exists coach_athlete_goals_manage on public.coach_athlete_goals;
create policy coach_athlete_goals_manage
on public.coach_athlete_goals for all to authenticated
using (
  public.is_service_role()
  or (
    coach_user_id = auth.uid()
    and public.coach_is_assigned_to_athlete(gym_id, member_user_id, auth.uid())
  )
)
with check (
  public.is_service_role()
  or (
    coach_user_id = auth.uid()
    and public.coach_is_assigned_to_athlete(gym_id, member_user_id, auth.uid())
  )
);

drop policy if exists coach_athlete_progress_photos_select on public.coach_athlete_progress_photos;
create policy coach_athlete_progress_photos_select
on public.coach_athlete_progress_photos for select to authenticated
using (
  public.is_service_role()
  or (
    consent_granted = true
    and public.gym_capability_enabled(gym_id, 'private_coaching_workspace')
    and (coach_user_id = auth.uid() or member_user_id = auth.uid())
  )
);

drop policy if exists coach_athlete_progress_photos_manage on public.coach_athlete_progress_photos;
create policy coach_athlete_progress_photos_manage
on public.coach_athlete_progress_photos for all to authenticated
using (
  public.is_service_role()
  or (
    coach_user_id = auth.uid()
    and public.coach_is_assigned_to_athlete(gym_id, member_user_id, auth.uid())
  )
  or member_user_id = auth.uid()
)
with check (
  public.is_service_role()
  or (
    coach_user_id = auth.uid()
    and public.coach_is_assigned_to_athlete(gym_id, member_user_id, auth.uid())
  )
  or member_user_id = auth.uid()
);

grant select, insert, update, delete on public.coach_plan_templates to authenticated;
grant select, insert, update, delete on public.coach_athlete_notes to authenticated;
grant select, insert, update on public.coach_athlete_messages to authenticated;
grant select, insert, update, delete on public.coach_sessions to authenticated;
grant select, insert on public.gym_workout_plan_exercise_swaps to authenticated;
grant select, insert, update, delete on public.coach_athlete_goals to authenticated;
grant select, insert, update, delete on public.coach_athlete_progress_photos to authenticated;

grant select, insert, update, delete on public.coach_plan_templates to service_role;
grant select, insert, update, delete on public.coach_athlete_notes to service_role;
grant select, insert, update, delete on public.coach_athlete_messages to service_role;
grant select, insert, update, delete on public.coach_sessions to service_role;
grant select, insert, update, delete on public.gym_workout_plan_exercise_swaps to service_role;
grant select, insert, update, delete on public.coach_athlete_goals to service_role;
grant select, insert, update, delete on public.coach_athlete_progress_photos to service_role;

revoke all on function public.gym_capability_enabled(uuid, text) from public;
grant execute on function public.gym_capability_enabled(uuid, text) to authenticated;
grant execute on function public.gym_capability_enabled(uuid, text) to service_role;

revoke all on function public.coach_is_assigned_to_athlete(uuid, uuid, uuid) from public;
grant execute on function public.coach_is_assigned_to_athlete(uuid, uuid, uuid) to authenticated;
grant execute on function public.coach_is_assigned_to_athlete(uuid, uuid, uuid) to service_role;

revoke all on function public.coach_require_workspace_access(uuid) from public;
grant execute on function public.coach_require_workspace_access(uuid) to authenticated;
grant execute on function public.coach_require_workspace_access(uuid) to service_role;

revoke all on function public.coach_list_my_athletes(uuid) from public;
grant execute on function public.coach_list_my_athletes(uuid) to authenticated;
grant execute on function public.coach_list_my_athletes(uuid) to service_role;

revoke all on function public.coach_get_athlete_private_workspace(uuid, uuid) from public;
grant execute on function public.coach_get_athlete_private_workspace(uuid, uuid) to authenticated;
grant execute on function public.coach_get_athlete_private_workspace(uuid, uuid) to service_role;

revoke all on function public.coach_publish_workout_plan(uuid, uuid, text, text, jsonb, uuid, text) from public;
grant execute on function public.coach_publish_workout_plan(uuid, uuid, text, text, jsonb, uuid, text) to authenticated;
grant execute on function public.coach_publish_workout_plan(uuid, uuid, text, text, jsonb, uuid, text) to service_role;

revoke all on function public.coach_swap_workout_plan_exercise(uuid, uuid, uuid, jsonb, text, text, text) from public;
grant execute on function public.coach_swap_workout_plan_exercise(uuid, uuid, uuid, jsonb, text, text, text) to authenticated;
grant execute on function public.coach_swap_workout_plan_exercise(uuid, uuid, uuid, jsonb, text, text, text) to service_role;

revoke all on function public.coach_send_athlete_message(uuid, uuid, text, text, jsonb, text) from public;
grant execute on function public.coach_send_athlete_message(uuid, uuid, text, text, jsonb, text) to authenticated;
grant execute on function public.coach_send_athlete_message(uuid, uuid, text, text, jsonb, text) to service_role;

revoke all on function public.coach_schedule_private_session(uuid, uuid, text, timestamptz, timestamptz, text) from public;
grant execute on function public.coach_schedule_private_session(uuid, uuid, text, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.coach_schedule_private_session(uuid, uuid, text, timestamptz, timestamptz, text) to service_role;

revoke all on function public.coach_create_athlete_note(uuid, uuid, text, text, text, text) from public;
grant execute on function public.coach_create_athlete_note(uuid, uuid, text, text, text, text) to authenticated;
grant execute on function public.coach_create_athlete_note(uuid, uuid, text, text, text, text) to service_role;

revoke all on function public.coach_upsert_athlete_goal(uuid, uuid, text, text, numeric, numeric, text, date, uuid) from public;
grant execute on function public.coach_upsert_athlete_goal(uuid, uuid, text, text, numeric, numeric, text, date, uuid) to authenticated;
grant execute on function public.coach_upsert_athlete_goal(uuid, uuid, text, text, numeric, numeric, text, date, uuid) to service_role;

revoke all on function public.coach_save_plan_template(uuid, text, text, jsonb, boolean) from public;
grant execute on function public.coach_save_plan_template(uuid, text, text, jsonb, boolean) to authenticated;
grant execute on function public.coach_save_plan_template(uuid, text, text, jsonb, boolean) to service_role;

revoke all on function public.coach_list_plan_templates(uuid) from public;
grant execute on function public.coach_list_plan_templates(uuid) to authenticated;
grant execute on function public.coach_list_plan_templates(uuid) to service_role;
