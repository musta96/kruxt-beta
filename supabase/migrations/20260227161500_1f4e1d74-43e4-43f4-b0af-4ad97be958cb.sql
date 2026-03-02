create table if not exists public.gym_staff_invites (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  email text not null,
  role public.gym_role not null default 'member',
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  token_hash text not null unique,
  invited_by uuid not null references public.profiles(id),
  accepted_by uuid references public.profiles(id),
  accepted_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gym_staff_invites_gym_id_idx
  on public.gym_staff_invites (gym_id);

create index if not exists gym_staff_invites_email_idx
  on public.gym_staff_invites (lower(email));

create index if not exists gym_staff_invites_status_idx
  on public.gym_staff_invites (status);

alter table public.gym_staff_invites enable row level security;

drop policy if exists gym_staff_invites_select on public.gym_staff_invites;
create policy gym_staff_invites_select
on public.gym_staff_invites
for select
to authenticated
using (
  public.can_manage_gym_config(gym_id, auth.uid())
  or public.is_platform_founder(auth.uid())
);

drop policy if exists gym_staff_invites_insert on public.gym_staff_invites;
create policy gym_staff_invites_insert
on public.gym_staff_invites
for insert
to authenticated
with check (
  public.can_manage_gym_config(gym_id, auth.uid())
  or public.is_platform_founder(auth.uid())
);

drop policy if exists gym_staff_invites_update on public.gym_staff_invites;
create policy gym_staff_invites_update
on public.gym_staff_invites
for update
to authenticated
using (
  public.can_manage_gym_config(gym_id, auth.uid())
  or public.is_platform_founder(auth.uid())
)
with check (
  public.can_manage_gym_config(gym_id, auth.uid())
  or public.is_platform_founder(auth.uid())
);

drop policy if exists gym_staff_invites_delete on public.gym_staff_invites;
create policy gym_staff_invites_delete
on public.gym_staff_invites
for delete
to authenticated
using (
  public.can_manage_gym_config(gym_id, auth.uid())
  or public.is_platform_founder(auth.uid())
);
