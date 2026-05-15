-- Member coaching ownership and staff-authored workout plans.

alter table public.gym_memberships
  add column if not exists coach_user_id uuid references public.profiles(id) on delete set null;

create index if not exists idx_gym_memberships_coach
  on public.gym_memberships(gym_id, coach_user_id)
  where coach_user_id is not null;

create or replace function public.validate_gym_membership_coach()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.coach_user_id is null then
    return new;
  end if;

  if new.coach_user_id = new.user_id then
    raise exception 'A member cannot be assigned as their own coach';
  end if;

  if not exists (
    select 1
    from public.gym_memberships gm
    where gm.gym_id = new.gym_id
      and gm.user_id = new.coach_user_id
      and gm.membership_status in ('trial', 'active')
      and gm.role in ('leader', 'officer', 'coach')
  ) then
    raise exception 'Assigned coach must be active staff in the same gym';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_gym_memberships_validate_coach on public.gym_memberships;
create trigger trg_gym_memberships_validate_coach
before insert or update of coach_user_id, gym_id, user_id
on public.gym_memberships
for each row
execute function public.validate_gym_membership_coach();

create table if not exists public.gym_member_workout_plans (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  member_user_id uuid not null references public.profiles(id) on delete cascade,
  coach_user_id uuid references public.profiles(id) on delete set null,
  title text not null,
  goal text,
  status text not null default 'active'
    check (status in ('draft', 'active', 'paused', 'completed', 'archived')),
  starts_at date,
  ends_at date,
  plan_json jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create index if not exists idx_gym_member_workout_plans_member
  on public.gym_member_workout_plans(gym_id, member_user_id, status, updated_at desc);

create index if not exists idx_gym_member_workout_plans_coach
  on public.gym_member_workout_plans(gym_id, coach_user_id, updated_at desc)
  where coach_user_id is not null;

create or replace function public.validate_gym_member_workout_plan_subjects()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.gym_memberships gm
    where gm.gym_id = new.gym_id
      and gm.user_id = new.member_user_id
      and gm.membership_status in ('pending', 'trial', 'active', 'paused')
  ) then
    raise exception 'Workout plan member must belong to the same gym';
  end if;

  if new.coach_user_id is not null then
    if new.coach_user_id = new.member_user_id then
      raise exception 'A member cannot be assigned as their own workout plan coach';
    end if;

    if not exists (
      select 1
      from public.gym_memberships gm
      where gm.gym_id = new.gym_id
        and gm.user_id = new.coach_user_id
        and gm.membership_status in ('trial', 'active')
        and gm.role in ('leader', 'officer', 'coach')
    ) then
      raise exception 'Workout plan coach must be active staff in the same gym';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_gym_member_workout_plans_validate_subjects on public.gym_member_workout_plans;
create trigger trg_gym_member_workout_plans_validate_subjects
before insert or update of gym_id, member_user_id, coach_user_id
on public.gym_member_workout_plans
for each row
execute function public.validate_gym_member_workout_plan_subjects();

drop trigger if exists trg_gym_member_workout_plans_set_updated_at on public.gym_member_workout_plans;
create trigger trg_gym_member_workout_plans_set_updated_at
before update on public.gym_member_workout_plans
for each row
execute function public.set_updated_at();

alter table public.gym_member_workout_plans enable row level security;

drop policy if exists gym_member_workout_plans_select on public.gym_member_workout_plans;
create policy gym_member_workout_plans_select
on public.gym_member_workout_plans for select to authenticated
using (
  member_user_id = auth.uid()
  or coach_user_id = auth.uid()
  or public.is_gym_staff(gym_id, auth.uid())
);

drop policy if exists gym_member_workout_plans_insert on public.gym_member_workout_plans;
create policy gym_member_workout_plans_insert
on public.gym_member_workout_plans for insert to authenticated
with check (public.is_gym_staff(gym_id, auth.uid()));

drop policy if exists gym_member_workout_plans_update on public.gym_member_workout_plans;
create policy gym_member_workout_plans_update
on public.gym_member_workout_plans for update to authenticated
using (public.is_gym_staff(gym_id, auth.uid()))
with check (public.is_gym_staff(gym_id, auth.uid()));

drop policy if exists gym_member_workout_plans_delete on public.gym_member_workout_plans;
create policy gym_member_workout_plans_delete
on public.gym_member_workout_plans for delete to authenticated
using (public.is_gym_staff(gym_id, auth.uid()));

create table if not exists public.gym_invite_codes (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9-]{4,64}$'),
  label text,
  role public.gym_role not null default 'member',
  membership_status public.membership_status not null default 'active',
  membership_plan_id uuid references public.gym_membership_plans(id) on delete set null,
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  redeemed_count integer not null default 0 check (redeemed_count >= 0),
  expires_at timestamptz,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (redeemed_count <= coalesce(max_redemptions, redeemed_count))
);

create index if not exists idx_gym_invite_codes_gym_active
  on public.gym_invite_codes(gym_id, is_active, expires_at);

create table if not exists public.gym_join_requests (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  requested_membership_plan_id uuid references public.gym_membership_plans(id) on delete set null,
  source text not null default 'public_request'
    check (source in ('public_request', 'invite_code', 'staff_created')),
  invite_code_id uuid references public.gym_invite_codes(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  note text,
  staff_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_gym_join_requests_gym_status
  on public.gym_join_requests(gym_id, status, created_at desc);

create index if not exists idx_gym_join_requests_user
  on public.gym_join_requests(user_id, created_at desc);

create unique index if not exists idx_gym_join_requests_one_pending
  on public.gym_join_requests(gym_id, user_id)
  where status = 'pending';

create table if not exists public.gym_invite_code_redemptions (
  id uuid primary key default gen_random_uuid(),
  invite_code_id uuid not null references public.gym_invite_codes(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  membership_id uuid references public.gym_memberships(id) on delete set null,
  redeemed_at timestamptz not null default now(),
  unique(invite_code_id, user_id)
);

create index if not exists idx_gym_invite_code_redemptions_gym
  on public.gym_invite_code_redemptions(gym_id, redeemed_at desc);

drop trigger if exists trg_gym_invite_codes_set_updated_at on public.gym_invite_codes;
create trigger trg_gym_invite_codes_set_updated_at
before update on public.gym_invite_codes
for each row
execute function public.set_updated_at();

drop trigger if exists trg_gym_join_requests_set_updated_at on public.gym_join_requests;
create trigger trg_gym_join_requests_set_updated_at
before update on public.gym_join_requests
for each row
execute function public.set_updated_at();

create or replace function public.request_gym_membership(
  p_gym_id uuid,
  p_membership_plan_id uuid default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_membership_id uuid;
  v_membership_status public.membership_status;
  v_request_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (select 1 from public.profiles p where p.id = v_user_id) then
    raise exception 'Create your public profile before requesting gym access';
  end if;

  if not exists (select 1 from public.gyms g where g.id = p_gym_id and g.is_public = true) then
    raise exception 'Gym is not available for public access requests';
  end if;

  if p_membership_plan_id is not null and not exists (
    select 1
    from public.gym_membership_plans gmp
    where gmp.id = p_membership_plan_id
      and gmp.gym_id = p_gym_id
      and gmp.is_active = true
  ) then
    raise exception 'Membership plan is not available for this gym';
  end if;

  insert into public.gym_memberships(
    gym_id,
    user_id,
    role,
    membership_status,
    membership_plan_id
  )
  values (
    p_gym_id,
    v_user_id,
    'member',
    'pending',
    p_membership_plan_id
  )
  on conflict (gym_id, user_id) do update
    set membership_plan_id = coalesce(excluded.membership_plan_id, public.gym_memberships.membership_plan_id),
        membership_status = case
          when public.gym_memberships.membership_status = 'cancelled' then 'pending'::public.membership_status
          else public.gym_memberships.membership_status
        end
  returning id, membership_status
  into v_membership_id, v_membership_status;

  if v_membership_status in ('active', 'trial', 'paused') then
    return v_membership_id;
  end if;

  update public.gym_join_requests gjr
  set requested_membership_plan_id = coalesce(p_membership_plan_id, gjr.requested_membership_plan_id),
      source = 'public_request',
      note = nullif(trim(coalesce(p_note, '')), ''),
      invite_code_id = null
  where gjr.gym_id = p_gym_id
    and gjr.user_id = v_user_id
    and gjr.status = 'pending'
  returning id
  into v_request_id;

  if v_request_id is null then
    insert into public.gym_join_requests(
      gym_id,
      user_id,
      requested_membership_plan_id,
      source,
      status,
      note
    )
    values (
      p_gym_id,
      v_user_id,
      p_membership_plan_id,
      'public_request',
      'pending',
      nullif(trim(coalesce(p_note, '')), '')
    )
    returning id
    into v_request_id;
  end if;

  return v_membership_id;
end;
$$;

create or replace function public.redeem_gym_invite_code(
  p_code text,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_code text := upper(trim(coalesce(p_code, '')));
  v_invite public.gym_invite_codes%rowtype;
  v_membership_id uuid;
  v_request_status text;
  v_redemption_id uuid;
  v_existing_request_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (select 1 from public.profiles p where p.id = v_user_id) then
    raise exception 'Create your public profile before redeeming a gym invite';
  end if;

  select *
  into v_invite
  from public.gym_invite_codes gic
  where gic.code = v_code
  for update;

  if v_invite.id is null then
    raise exception 'Invite code not found';
  end if;

  if not v_invite.is_active then
    raise exception 'Invite code is inactive';
  end if;

  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    raise exception 'Invite code has expired';
  end if;

  if v_invite.max_redemptions is not null and v_invite.redeemed_count >= v_invite.max_redemptions then
    raise exception 'Invite code has reached its redemption limit';
  end if;

  if v_invite.membership_plan_id is not null and not exists (
    select 1
    from public.gym_membership_plans gmp
    where gmp.id = v_invite.membership_plan_id
      and gmp.gym_id = v_invite.gym_id
      and gmp.is_active = true
  ) then
    raise exception 'Invite code membership plan is no longer available';
  end if;

  insert into public.gym_memberships(
    gym_id,
    user_id,
    role,
    membership_status,
    membership_plan_id,
    started_at
  )
  values (
    v_invite.gym_id,
    v_user_id,
    v_invite.role,
    v_invite.membership_status,
    v_invite.membership_plan_id,
    case when v_invite.membership_status in ('active', 'trial') then now() else null end
  )
  on conflict (gym_id, user_id) do update
    set role = excluded.role,
        membership_status = case
          when public.gym_memberships.membership_status in ('active', 'trial') then public.gym_memberships.membership_status
          else excluded.membership_status
        end,
        membership_plan_id = coalesce(excluded.membership_plan_id, public.gym_memberships.membership_plan_id),
        started_at = coalesce(public.gym_memberships.started_at, excluded.started_at)
  returning id
  into v_membership_id;

  insert into public.gym_invite_code_redemptions(
    invite_code_id,
    gym_id,
    user_id,
    membership_id
  )
  values (
    v_invite.id,
    v_invite.gym_id,
    v_user_id,
    v_membership_id
  )
  on conflict (invite_code_id, user_id) do nothing
  returning id
  into v_redemption_id;

  if v_redemption_id is not null then
    update public.gym_invite_codes
    set redeemed_count = redeemed_count + 1
    where id = v_invite.id;
  else
    return v_membership_id;
  end if;

  v_request_status := case
    when v_invite.membership_status in ('active', 'trial') then 'approved'
    else 'pending'
  end;

  if v_request_status = 'approved' then
    update public.gym_join_requests
    set status = 'cancelled',
        staff_note = coalesce(staff_note, 'Superseded by invite code redemption')
    where gym_id = v_invite.gym_id
      and user_id = v_user_id
      and status = 'pending';
  end if;

  if v_request_status = 'pending' then
    update public.gym_join_requests gjr
    set requested_membership_plan_id = v_invite.membership_plan_id,
        source = 'invite_code',
        invite_code_id = v_invite.id,
        note = nullif(trim(coalesce(p_note, '')), '')
    where gjr.gym_id = v_invite.gym_id
      and gjr.user_id = v_user_id
      and gjr.status = 'pending'
    returning id
    into v_existing_request_id;

    if v_existing_request_id is not null then
      return v_membership_id;
    end if;
  end if;

  insert into public.gym_join_requests(
    gym_id,
    user_id,
    requested_membership_plan_id,
    source,
    invite_code_id,
    status,
    note,
    reviewed_by,
    reviewed_at
  )
  values (
    v_invite.gym_id,
    v_user_id,
    v_invite.membership_plan_id,
    'invite_code',
    v_invite.id,
    v_request_status,
    nullif(trim(coalesce(p_note, '')), ''),
    case when v_request_status = 'approved' then v_invite.created_by else null end,
    case when v_request_status = 'approved' then now() else null end
  );

  return v_membership_id;
end;
$$;

create or replace function public.review_gym_join_request(
  p_request_id uuid,
  p_next_status text,
  p_staff_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_request public.gym_join_requests%rowtype;
  v_membership_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_next_status not in ('approved', 'rejected', 'cancelled') then
    raise exception 'Invalid join request status';
  end if;

  select *
  into v_request
  from public.gym_join_requests gjr
  where gjr.id = p_request_id
  for update;

  if v_request.id is null then
    raise exception 'Join request not found';
  end if;

  if not public.is_gym_staff(v_request.gym_id, v_user_id) then
    raise exception 'Gym staff access is required';
  end if;

  insert into public.gym_memberships(
    gym_id,
    user_id,
    role,
    membership_status,
    membership_plan_id,
    started_at
  )
  values (
    v_request.gym_id,
    v_request.user_id,
    'member',
    case when p_next_status = 'approved' then 'active'::public.membership_status else 'cancelled'::public.membership_status end,
    v_request.requested_membership_plan_id,
    case when p_next_status = 'approved' then now() else null end
  )
  on conflict (gym_id, user_id) do update
    set membership_status = case
          when p_next_status = 'approved' then 'active'::public.membership_status
          when public.gym_memberships.membership_status = 'pending' then 'cancelled'::public.membership_status
          else public.gym_memberships.membership_status
        end,
        membership_plan_id = coalesce(v_request.requested_membership_plan_id, public.gym_memberships.membership_plan_id),
        started_at = case
          when p_next_status = 'approved' then coalesce(public.gym_memberships.started_at, now())
          else public.gym_memberships.started_at
        end
  returning id
  into v_membership_id;

  update public.gym_join_requests
  set status = p_next_status,
      staff_note = nullif(trim(coalesce(p_staff_note, '')), ''),
      reviewed_by = v_user_id,
      reviewed_at = now()
  where id = p_request_id;

  return v_membership_id;
end;
$$;

revoke all on function public.request_gym_membership(uuid, uuid, text) from public;
grant execute on function public.request_gym_membership(uuid, uuid, text) to authenticated;

revoke all on function public.redeem_gym_invite_code(text, text) from public;
grant execute on function public.redeem_gym_invite_code(text, text) to authenticated;

revoke all on function public.review_gym_join_request(uuid, text, text) from public;
grant execute on function public.review_gym_join_request(uuid, text, text) to authenticated;

alter table public.gym_invite_codes enable row level security;
alter table public.gym_join_requests enable row level security;
alter table public.gym_invite_code_redemptions enable row level security;

drop policy if exists gym_invite_codes_staff_all on public.gym_invite_codes;
create policy gym_invite_codes_staff_all
on public.gym_invite_codes for all to authenticated
using (public.is_gym_staff(gym_id, auth.uid()))
with check (public.is_gym_staff(gym_id, auth.uid()));

drop policy if exists gym_join_requests_select_self_or_staff on public.gym_join_requests;
create policy gym_join_requests_select_self_or_staff
on public.gym_join_requests for select to authenticated
using (user_id = auth.uid() or public.is_gym_staff(gym_id, auth.uid()));

drop policy if exists gym_join_requests_insert_self on public.gym_join_requests;
create policy gym_join_requests_insert_self
on public.gym_join_requests for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists gym_join_requests_update_self_cancel_or_staff on public.gym_join_requests;
create policy gym_join_requests_update_self_cancel_or_staff
on public.gym_join_requests for update to authenticated
using (public.is_gym_staff(gym_id, auth.uid()) or (user_id = auth.uid() and status = 'pending'))
with check (public.is_gym_staff(gym_id, auth.uid()) or (user_id = auth.uid() and status = 'cancelled'));

drop policy if exists gym_invite_redemptions_select_self_or_staff on public.gym_invite_code_redemptions;
create policy gym_invite_redemptions_select_self_or_staff
on public.gym_invite_code_redemptions for select to authenticated
using (user_id = auth.uid() or public.is_gym_staff(gym_id, auth.uid()));
