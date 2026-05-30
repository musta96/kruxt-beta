-- Operator-created gym owner / staff / member profiles.
-- The operator creates a pending profile and sends an expiring auth link;
-- the invited person sets their own password during activation.

alter table public.profiles
  add column if not exists activation_status text not null default 'active',
  add column if not exists activation_status_updated_at timestamptz not null default now(),
  add column if not exists activated_at timestamptz;

do $$
begin
  alter table public.profiles
    add constraint profiles_activation_status_check
    check (activation_status in ('pending_activation', 'active', 'disabled'));
exception
  when duplicate_object then null;
end $$;

update public.profiles
set
  activation_status = coalesce(nullif(activation_status, ''), 'active'),
  activation_status_updated_at = coalesce(activation_status_updated_at, updated_at, now()),
  activated_at = coalesce(activated_at, created_at)
where activation_status = 'active'
  and activated_at is null;

create table if not exists public.gym_profile_invitations (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  invited_user_id uuid references public.profiles(id) on delete set null,
  email text not null,
  display_name text not null,
  requested_role text not null check (requested_role in ('owner', 'admin', 'staff', 'pt', 'member')),
  gym_role public.gym_role not null,
  membership_plan_id uuid references public.gym_membership_plans(id) on delete set null,
  coach_user_id uuid references public.profiles(id) on delete set null,
  status text not null default 'pending_activation'
    check (status in ('pending_activation', 'active', 'invite_expired', 'disabled')),
  invite_attempt integer not null default 1 check (invite_attempt > 0),
  invited_by uuid references public.profiles(id) on delete set null,
  invited_by_context text not null default 'gym_staff'
    check (invited_by_context in ('platform', 'gym_owner', 'gym_staff')),
  sent_at timestamptz,
  expires_at timestamptz not null,
  activated_at timestamptz,
  disabled_at timestamptz,
  last_email_status text,
  last_email_provider text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_gym_profile_invitations_set_updated_at on public.gym_profile_invitations;
create trigger trg_gym_profile_invitations_set_updated_at
before update on public.gym_profile_invitations
for each row execute function public.set_updated_at();

create index if not exists idx_gym_profile_invitations_gym_status
  on public.gym_profile_invitations(gym_id, status, created_at desc);

create index if not exists idx_gym_profile_invitations_email
  on public.gym_profile_invitations(lower(email));

create index if not exists idx_gym_profile_invitations_user
  on public.gym_profile_invitations(invited_user_id)
  where invited_user_id is not null;

create index if not exists idx_gym_profile_invitations_expires_at
  on public.gym_profile_invitations(expires_at)
  where status = 'pending_activation';

create unique index if not exists idx_gym_profile_invitations_one_pending_email
  on public.gym_profile_invitations(gym_id, lower(email))
  where status = 'pending_activation';

alter table public.gym_profile_invitations enable row level security;

drop policy if exists gym_profile_invitations_select on public.gym_profile_invitations;
create policy gym_profile_invitations_select
on public.gym_profile_invitations
for select
using (
  public.is_service_role()
  or invited_user_id = auth.uid()
  or public.is_gym_staff(gym_id, auth.uid())
  or exists (
    select 1
    from public.gyms g
    where g.id = gym_profile_invitations.gym_id
      and g.owner_user_id = auth.uid()
  )
  or public.platform_operator_has_permission('platform.tenants.create_staff_invite', auth.uid())
);

drop policy if exists gym_profile_invitations_insert_service on public.gym_profile_invitations;
create policy gym_profile_invitations_insert_service
on public.gym_profile_invitations
for insert
with check (public.is_service_role());

drop policy if exists gym_profile_invitations_update_service on public.gym_profile_invitations;
create policy gym_profile_invitations_update_service
on public.gym_profile_invitations
for update
using (public.is_service_role())
with check (public.is_service_role());

grant select on table public.gym_profile_invitations to authenticated;
grant select, insert, update on table public.gym_profile_invitations to service_role;
