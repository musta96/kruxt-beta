-- Custom gym roles: editable Pro-tier role clones with audit-logged permission mutations.

create table if not exists public.gym_custom_roles (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  role_key text not null,
  label text not null,
  description text,
  base_role public.gym_role not null default 'coach',
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(gym_id, role_key),
  check (role_key = lower(role_key)),
  check (length(role_key) between 2 and 64),
  check (role_key ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$'),
  check (length(trim(label)) between 2 and 80)
);

create table if not exists public.gym_custom_role_permissions (
  id uuid primary key default gen_random_uuid(),
  custom_role_id uuid not null references public.gym_custom_roles(id) on delete cascade,
  permission_key text not null references public.gym_permission_catalog(permission_key) on delete cascade,
  is_allowed boolean not null default false,
  updated_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(custom_role_id, permission_key)
);

create table if not exists public.gym_custom_role_assignments (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  custom_role_id uuid not null references public.gym_custom_roles(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_gym_custom_roles_gym_active
  on public.gym_custom_roles(gym_id, is_active, created_at);

create index if not exists idx_gym_custom_role_permissions_role
  on public.gym_custom_role_permissions(custom_role_id, permission_key);

create index if not exists idx_gym_custom_role_assignments_gym_user
  on public.gym_custom_role_assignments(gym_id, user_id)
  where revoked_at is null;

create unique index if not exists uq_gym_custom_role_assignments_active_user
  on public.gym_custom_role_assignments(gym_id, user_id)
  where revoked_at is null;

drop trigger if exists trg_gym_custom_roles_set_updated_at on public.gym_custom_roles;
create trigger trg_gym_custom_roles_set_updated_at
before update on public.gym_custom_roles
for each row execute function public.set_updated_at();

drop trigger if exists trg_gym_custom_role_permissions_set_updated_at on public.gym_custom_role_permissions;
create trigger trg_gym_custom_role_permissions_set_updated_at
before update on public.gym_custom_role_permissions
for each row execute function public.set_updated_at();

drop trigger if exists trg_gym_custom_role_assignments_set_updated_at on public.gym_custom_role_assignments;
create trigger trg_gym_custom_role_assignments_set_updated_at
before update on public.gym_custom_role_assignments
for each row execute function public.set_updated_at();

alter table public.gym_custom_roles enable row level security;
alter table public.gym_custom_role_permissions enable row level security;
alter table public.gym_custom_role_assignments enable row level security;

drop policy if exists gym_custom_roles_select on public.gym_custom_roles;
create policy gym_custom_roles_select
on public.gym_custom_roles for select to authenticated
using (
  public.is_service_role()
  or public.can_manage_gym_config(gym_id, auth.uid())
);

drop policy if exists gym_custom_roles_manage on public.gym_custom_roles;
create policy gym_custom_roles_manage
on public.gym_custom_roles for all to authenticated
using (
  public.is_service_role()
  or public.can_manage_gym_config(gym_id, auth.uid())
)
with check (
  public.is_service_role()
  or public.can_manage_gym_config(gym_id, auth.uid())
);

drop policy if exists gym_custom_role_permissions_select on public.gym_custom_role_permissions;
create policy gym_custom_role_permissions_select
on public.gym_custom_role_permissions for select to authenticated
using (
  public.is_service_role()
  or exists (
    select 1
    from public.gym_custom_roles gcr
    where gcr.id = gym_custom_role_permissions.custom_role_id
      and public.can_manage_gym_config(gcr.gym_id, auth.uid())
  )
);

drop policy if exists gym_custom_role_permissions_manage on public.gym_custom_role_permissions;
create policy gym_custom_role_permissions_manage
on public.gym_custom_role_permissions for all to authenticated
using (
  public.is_service_role()
  or exists (
    select 1
    from public.gym_custom_roles gcr
    where gcr.id = gym_custom_role_permissions.custom_role_id
      and public.can_manage_gym_config(gcr.gym_id, auth.uid())
  )
)
with check (
  public.is_service_role()
  or exists (
    select 1
    from public.gym_custom_roles gcr
    where gcr.id = gym_custom_role_permissions.custom_role_id
      and public.can_manage_gym_config(gcr.gym_id, auth.uid())
  )
);

drop policy if exists gym_custom_role_assignments_select on public.gym_custom_role_assignments;
create policy gym_custom_role_assignments_select
on public.gym_custom_role_assignments for select to authenticated
using (
  public.is_service_role()
  or user_id = auth.uid()
  or public.can_manage_gym_config(gym_id, auth.uid())
);

drop policy if exists gym_custom_role_assignments_manage on public.gym_custom_role_assignments;
create policy gym_custom_role_assignments_manage
on public.gym_custom_role_assignments for all to authenticated
using (
  public.is_service_role()
  or public.can_manage_gym_config(gym_id, auth.uid())
)
with check (
  public.is_service_role()
  or public.can_manage_gym_config(gym_id, auth.uid())
);

grant select on public.gym_custom_roles to authenticated;
grant select on public.gym_custom_role_permissions to authenticated;
grant select on public.gym_custom_role_assignments to authenticated;
grant all on public.gym_custom_roles to service_role;
grant all on public.gym_custom_role_permissions to service_role;
grant all on public.gym_custom_role_assignments to service_role;

create or replace function public.create_gym_custom_role(
  p_gym_id uuid,
  p_label text,
  p_base_role public.gym_role default 'coach',
  p_role_key text default null,
  p_description text default null,
  p_reason text default null
)
returns public.gym_custom_roles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_base_key text;
  v_role_key text;
  v_counter integer := 1;
  v_role public.gym_custom_roles%rowtype;
begin
  if not public.is_service_role() and not public.user_has_gym_permission(p_gym_id, 'admin.roles.manage', v_actor) then
    raise exception 'not allowed to manage custom gym roles' using errcode = '42501';
  end if;

  if not public.gym_capability_enabled(p_gym_id, 'custom_staff_roles') then
    raise exception 'custom staff roles entitlement is disabled for this gym' using errcode = '42501';
  end if;

  if p_label is null or length(trim(p_label)) < 2 then
    raise exception 'role label must be at least 2 characters';
  end if;

  v_base_key := lower(regexp_replace(coalesce(nullif(trim(p_role_key), ''), trim(p_label)), '[^a-zA-Z0-9]+', '-', 'g'));
  v_base_key := trim(both '-' from v_base_key);

  if length(v_base_key) < 2 then
    v_base_key := 'custom-role';
  end if;

  v_base_key := trim(both '-' from substring(v_base_key from 1 for 56));
  if length(v_base_key) < 2 then
    v_base_key := 'custom-role';
  end if;
  v_role_key := v_base_key;

  while exists (
    select 1
    from public.gym_custom_roles gcr
    where gcr.gym_id = p_gym_id
      and gcr.role_key = v_role_key
  ) loop
    v_role_key := substring(v_base_key from 1 for 54) || '-' || v_counter::text;
    v_counter := v_counter + 1;
  end loop;

  insert into public.gym_custom_roles (
    gym_id,
    role_key,
    label,
    description,
    base_role,
    created_by,
    updated_by,
    metadata
  )
  values (
    p_gym_id,
    v_role_key,
    trim(p_label),
    nullif(trim(coalesce(p_description, '')), ''),
    p_base_role,
    v_actor,
    v_actor,
    jsonb_build_object('source', 'staff_permission_matrix')
  )
  returning * into v_role;

  insert into public.gym_custom_role_permissions (
    custom_role_id,
    permission_key,
    is_allowed,
    updated_by,
    metadata
  )
  select
    v_role.id,
    gpc.permission_key,
    coalesce(grp.is_allowed, false),
    v_actor,
    jsonb_build_object('source', 'cloned_from_builtin', 'baseRole', p_base_role)
  from public.gym_permission_catalog gpc
  left join public.gym_role_permissions grp
    on grp.gym_id = p_gym_id
   and grp.role = p_base_role
   and grp.permission_key = gpc.permission_key
  where gpc.is_active = true
  on conflict (custom_role_id, permission_key) do nothing;

  perform public.append_audit_log(
    'gym.custom_role.created',
    'gym_custom_roles',
    v_role.id,
    p_reason,
    jsonb_build_object(
      'gymId', p_gym_id,
      'roleKey', v_role.role_key,
      'label', v_role.label,
      'baseRole', p_base_role
    )
  );

  return v_role;
end;
$$;

create or replace function public.set_gym_custom_role_permission(
  p_gym_id uuid,
  p_custom_role_id uuid,
  p_permission_key text,
  p_is_allowed boolean,
  p_reason text default null
)
returns public.gym_custom_role_permissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.gym_custom_roles%rowtype;
  v_previous boolean;
  v_permission_key text := lower(trim(coalesce(p_permission_key, '')));
  v_row public.gym_custom_role_permissions%rowtype;
begin
  if not public.is_service_role() and not public.user_has_gym_permission(p_gym_id, 'admin.roles.manage', v_actor) then
    raise exception 'not allowed to mutate custom role permissions' using errcode = '42501';
  end if;

  if not public.gym_capability_enabled(p_gym_id, 'custom_staff_roles') then
    raise exception 'custom staff roles entitlement is disabled for this gym' using errcode = '42501';
  end if;

  select *
  into v_role
  from public.gym_custom_roles gcr
  where gcr.id = p_custom_role_id
    and gcr.gym_id = p_gym_id
    and gcr.is_active = true
  for update;

  if not found then
    raise exception 'custom role not found for gym';
  end if;

  if not exists (
    select 1
    from public.gym_permission_catalog gpc
    where gpc.permission_key = v_permission_key
      and gpc.is_active = true
  ) then
    raise exception 'permission key is not active or does not exist';
  end if;

  select gcrp.is_allowed
  into v_previous
  from public.gym_custom_role_permissions gcrp
  where gcrp.custom_role_id = p_custom_role_id
    and gcrp.permission_key = v_permission_key;

  insert into public.gym_custom_role_permissions (
    custom_role_id,
    permission_key,
    is_allowed,
    updated_by,
    metadata
  )
  values (
    p_custom_role_id,
    v_permission_key,
    p_is_allowed,
    v_actor,
    jsonb_build_object('source', 'staff_permission_matrix', 'lastReason', p_reason)
  )
  on conflict (custom_role_id, permission_key) do update
  set
    is_allowed = excluded.is_allowed,
    updated_by = excluded.updated_by,
    metadata = gym_custom_role_permissions.metadata || excluded.metadata
  returning * into v_row;

  if v_previous is distinct from p_is_allowed then
    perform public.append_audit_log(
      'gym.custom_role.permission.updated',
      'gym_custom_role_permissions',
      v_row.id,
      p_reason,
      jsonb_build_object(
        'gymId', p_gym_id,
        'customRoleId', p_custom_role_id,
        'roleKey', v_role.role_key,
        'permissionKey', v_permission_key,
        'previous', v_previous,
        'next', p_is_allowed
      )
    );
  end if;

  return v_row;
end;
$$;

create or replace function public.user_has_gym_custom_role_permission(
  _gym_id uuid,
  _permission_key text,
  _viewer uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_allowed boolean;
begin
  if public.is_service_role() then
    return true;
  end if;

  if _gym_id is null or _viewer is null then
    return false;
  end if;

  select gcrp.is_allowed
  into v_allowed
  from public.gym_custom_role_assignments gcra
  join public.gym_custom_roles gcr
    on gcr.id = gcra.custom_role_id
   and gcr.gym_id = gcra.gym_id
   and gcr.is_active = true
  join public.gym_custom_role_permissions gcrp
    on gcrp.custom_role_id = gcr.id
   and gcrp.permission_key = lower(_permission_key)
  where gcra.gym_id = _gym_id
    and gcra.user_id = _viewer
    and gcra.revoked_at is null
  order by gcra.created_at desc
  limit 1;

  return coalesce(v_allowed, false);
end;
$$;

create or replace function public.user_has_gym_permission(
  _gym_id uuid,
  _permission_key text,
  _viewer uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role public.gym_role;
  v_override boolean;
  v_custom_allowed boolean;
  v_role_allowed boolean;
begin
  if public.is_service_role() then
    return true;
  end if;

  if _viewer is null then
    return false;
  end if;

  if exists (
    select 1
    from public.gyms g
    where g.id = _gym_id
      and g.owner_user_id = _viewer
  ) then
    return true;
  end if;

  select gm.role
  into v_role
  from public.gym_memberships gm
  where gm.gym_id = _gym_id
    and gm.user_id = _viewer
    and gm.membership_status in ('trial', 'active')
  order by case gm.role
    when 'leader' then 1
    when 'officer' then 2
    when 'coach' then 3
    else 4
  end
  limit 1;

  if v_role is null then
    return false;
  end if;

  select guo.is_allowed
  into v_override
  from public.gym_user_permission_overrides guo
  where guo.gym_id = _gym_id
    and guo.user_id = _viewer
    and guo.permission_key = lower(_permission_key)
  limit 1;

  if v_override is not null then
    return v_override;
  end if;

  select gcrp.is_allowed
  into v_custom_allowed
  from public.gym_custom_role_assignments gcra
  join public.gym_custom_roles gcr
    on gcr.id = gcra.custom_role_id
   and gcr.gym_id = gcra.gym_id
   and gcr.is_active = true
  join public.gym_custom_role_permissions gcrp
    on gcrp.custom_role_id = gcr.id
   and gcrp.permission_key = lower(_permission_key)
  where gcra.gym_id = _gym_id
    and gcra.user_id = _viewer
    and gcra.revoked_at is null
  order by gcra.created_at desc
  limit 1;

  if v_custom_allowed is not null then
    return v_custom_allowed;
  end if;

  select grp.is_allowed
  into v_role_allowed
  from public.gym_role_permissions grp
  where grp.gym_id = _gym_id
    and grp.role = v_role
    and grp.permission_key = lower(_permission_key)
  limit 1;

  return coalesce(v_role_allowed, false);
end;
$$;

revoke all on function public.create_gym_custom_role(uuid, text, public.gym_role, text, text, text) from public;
revoke all on function public.set_gym_custom_role_permission(uuid, uuid, text, boolean, text) from public;
revoke all on function public.user_has_gym_custom_role_permission(uuid, text, uuid) from public;
revoke all on function public.user_has_gym_permission(uuid, text, uuid) from public;

grant execute on function public.create_gym_custom_role(uuid, text, public.gym_role, text, text, text) to authenticated;
grant execute on function public.create_gym_custom_role(uuid, text, public.gym_role, text, text, text) to service_role;
grant execute on function public.set_gym_custom_role_permission(uuid, uuid, text, boolean, text) to authenticated;
grant execute on function public.set_gym_custom_role_permission(uuid, uuid, text, boolean, text) to service_role;
grant execute on function public.user_has_gym_custom_role_permission(uuid, text, uuid) to authenticated;
grant execute on function public.user_has_gym_custom_role_permission(uuid, text, uuid) to service_role;
grant execute on function public.user_has_gym_permission(uuid, text, uuid) to authenticated;
grant execute on function public.user_has_gym_permission(uuid, text, uuid) to service_role;
