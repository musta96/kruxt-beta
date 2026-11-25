-- Depends on 20261023075329_platform_operator_write_boundaries.sql.
begin;

create table public.platform_operator_role_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 80),
  description text not null default '' check (length(description) <= 500),
  permissions jsonb not null default '{}'::jsonb check (jsonb_typeof(permissions) = 'object'),
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now()
);
create unique index platform_operator_role_profiles_name on public.platform_operator_role_profiles(lower(btrim(name)));
create table public.platform_operator_role_profile_assignments (
  user_id uuid primary key references public.platform_operator_accounts(user_id) on delete cascade,
  profile_id uuid not null references public.platform_operator_role_profiles(id) on delete restrict
);
create index platform_operator_profile_assignment_profile on public.platform_operator_role_profile_assignments(profile_id);
alter table public.platform_operator_role_profiles enable row level security;
alter table public.platform_operator_role_profile_assignments enable row level security;
-- No direct Data API access; guarded RPCs are the only client interface.
revoke all on public.platform_operator_role_profiles, public.platform_operator_role_profile_assignments from public, anon, authenticated;

create function public.platform_operator_profile_keys() returns text[]
language sql immutable set search_path = '' as $$
  select array['platform.tenants.view','platform.flags.view','platform.audit.view','platform.system_health.view']::text[];
$$;
revoke all on function public.platform_operator_profile_keys() from public, anon, authenticated, service_role;

create or replace function public.platform_operator_has_permission(_permission_key text, _viewer uuid default auth.uid())
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_role public.platform_operator_role; v_allowed boolean;
begin
  if public.is_service_role() then return true; end if;
  if _viewer is null then return false; end if;
  if not exists (select 1 from public.platform_permission_catalog where permission_key = lower(_permission_key) and is_active) then return false; end if;
  select role into v_role from public.platform_operator_accounts where user_id = _viewer and is_active;
  if not found then return false; end if;
  select is_allowed into v_allowed from public.platform_operator_permission_overrides where user_id = _viewer and permission_key = lower(_permission_key);
  if found then return v_allowed; end if;
  -- Founder authority never derives from a custom profile. Recheck the allowlist
  -- during resolution too, so trusted maintenance cannot expand profile scope.
  if v_role <> 'founder' and lower(_permission_key) = any(public.platform_operator_profile_keys()) then
    select (p.permissions ->> lower(_permission_key))::boolean into v_allowed
    from public.platform_operator_role_profile_assignments a
    join public.platform_operator_role_profiles p on p.id = a.profile_id
    where a.user_id = _viewer and jsonb_typeof(p.permissions -> lower(_permission_key)) = 'boolean';
    if found then return v_allowed; end if;
  end if;
  select is_allowed into v_allowed from public.platform_role_permissions where role = v_role and permission_key = lower(_permission_key);
  return coalesce(v_allowed, false);
end;
$$;

create function public.platform_operator_role_profiles_snapshot() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not (
    public.platform_operator_has_permission('platform.operators.view') or
    public.platform_operator_has_permission('platform.operators.roles_matrix_edit')
  ) then raise exception 'Operator view access required' using errcode = '42501'; end if;
  return jsonb_build_object(
    'profiles', coalesce((select jsonb_agg(to_jsonb(p) order by p.name) from public.platform_operator_role_profiles p), '[]'::jsonb),
    'assignments', coalesce((select jsonb_agg(to_jsonb(a)) from public.platform_operator_role_profile_assignments a), '[]'::jsonb),
    'operators', coalesce((select jsonb_agg(jsonb_build_object('user_id', a.user_id, 'role', a.role, 'is_active', a.is_active,
      'display_name', coalesce(p.display_name, p.username, 'Operator'))) from public.platform_operator_accounts a join public.profiles p on p.id = a.user_id), '[]'::jsonb),
    'catalog', coalesce((select jsonb_agg(jsonb_build_object('permission_key', permission_key, 'label', label))
      from public.platform_permission_catalog where is_active and permission_key = any(public.platform_operator_profile_keys())), '[]'::jsonb),
    'effective_permissions', coalesce((select jsonb_agg(jsonb_build_object(
      'user_id', a.user_id, 'permission_key', c.permission_key,
      'is_allowed', public.platform_operator_has_permission(c.permission_key, a.user_id),
      'source', case when not a.is_active then 'inactive_operator' when o.user_id is not null then 'user_override'
        when a.role <> 'founder' and c.permission_key = any(public.platform_operator_profile_keys())
          and jsonb_typeof(p.permissions -> c.permission_key) = 'boolean' then 'profile'
        when r.id is not null then 'enum_default' else 'default_deny' end,
      'profile_id', case when a.is_active and o.user_id is null and a.role <> 'founder'
        and c.permission_key = any(public.platform_operator_profile_keys())
        and jsonb_typeof(p.permissions -> c.permission_key) = 'boolean' then p.id else null end))
      from public.platform_operator_accounts a cross join public.platform_permission_catalog c
      left join public.platform_operator_permission_overrides o on o.user_id = a.user_id and o.permission_key = c.permission_key
      left join public.platform_role_permissions r on r.role = a.role and r.permission_key = c.permission_key
      left join public.platform_operator_role_profile_assignments x on x.user_id = a.user_id
      left join public.platform_operator_role_profiles p on p.id = x.profile_id
      where c.is_active), '[]'::jsonb),
    'can_write', exists(select 1 from public.platform_operator_accounts where user_id = auth.uid() and is_active and role = 'founder')
      and coalesce((auth.jwt()->>'aal') = 'aal2', false) and public.platform_operator_has_permission('platform.operators.roles_matrix_edit')
  );
end;
$$;

-- Single transaction per action. Version checks protect profile drafts; expected
-- assignments protect reassignment drafts. A common lock orders all new writes.
create function public.platform_mutate_operator_role_profile(
  p_action text, p_profile_id uuid, p_expected_version integer,
  p_name text, p_description text, p_permissions jsonb,
  p_user_id uuid, p_expected_profile_id uuid, p_reason text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid(); v_profile public.platform_operator_role_profiles;
  v_before jsonb; v_after jsonb; v_current uuid; v_target_role public.platform_operator_role;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  perform pg_catalog.pg_advisory_xact_lock(821046, 1);
  perform 1 from public.platform_operator_accounts where user_id = v_actor and role = 'founder' and is_active for share;
  if not found or (auth.jwt()->>'aal') is distinct from 'aal2' then
    raise exception 'Active founder and MFA AAL2 required' using errcode = '42501';
  end if;
  perform 1 from public.platform_role_permissions where role = 'founder' and permission_key = 'platform.operators.roles_matrix_edit' for share;
  perform 1 from public.platform_operator_permission_overrides where user_id = v_actor and permission_key = 'platform.operators.roles_matrix_edit' for share;
  perform 1 from public.platform_permission_catalog where permission_key = 'platform.operators.roles_matrix_edit' for share;
  if not public.platform_operator_has_permission('platform.operators.roles_matrix_edit', v_actor) then
    raise exception 'Canonical permission matrix edit required' using errcode = '42501';
  end if;
  if length(v_reason) not between 1 and 2000 then raise exception 'Audit reason required (1-2000 characters)' using errcode = '22023'; end if;
  if p_action is null or p_action not in ('create','update','delete','assign') then raise exception 'Invalid action' using errcode = '22023'; end if;
  if p_profile_id is not null then
    select * into v_profile from public.platform_operator_role_profiles where id = p_profile_id for update;
    if not found then raise exception 'Profile no longer exists' using errcode = '40001'; end if;
    if p_expected_version is distinct from v_profile.version then raise exception 'Profile changed; reload' using errcode = '40001'; end if;
  elsif p_action in ('update','delete') then
    raise exception 'Profile required' using errcode = '22023';
  end if;
  if p_action in ('create','update') then
    if p_action = 'create' and p_profile_id is not null then raise exception 'New profile must not have an ID' using errcode = '22023'; end if;
    if p_name is null or length(btrim(p_name)) not between 1 and 80 or p_description is null or length(p_description) > 500
      or p_permissions is null or jsonb_typeof(p_permissions) <> 'object' then raise exception 'Invalid profile fields' using errcode = '22023'; end if;
    -- Exact canonical names, never aliases, wildcards or metadata-based scope.
    if exists(select 1 from jsonb_each(p_permissions) e where not (e.key = any(public.platform_operator_profile_keys()))
      or jsonb_typeof(e.value) <> 'boolean') then raise exception 'Unsupported profile permission' using errcode = '22023'; end if;
    perform 1 from public.platform_permission_catalog where permission_key in (select jsonb_object_keys(p_permissions)) and is_active for share;
    if exists(select 1 from jsonb_object_keys(p_permissions) k where not exists(select 1 from public.platform_permission_catalog c where c.permission_key = k and c.is_active)) then
      raise exception 'Active canonical key required' using errcode = '22023'; end if;
    v_before := case when p_action = 'update' then to_jsonb(v_profile) else null end;
    if p_action = 'create' then
      insert into public.platform_operator_role_profiles(name, description, permissions) values(btrim(p_name), p_description, p_permissions) returning * into v_profile;
    else
      update public.platform_operator_role_profiles set name = btrim(p_name), description = p_description, permissions = p_permissions,
        version = version + 1, updated_at = now() where id = p_profile_id returning * into v_profile;
    end if;
    v_after := to_jsonb(v_profile);
  elsif p_action = 'delete' then
    if exists(select 1 from public.platform_operator_role_profile_assignments where profile_id = p_profile_id) then
      raise exception 'Unassign operators before deleting profile' using errcode = '22023'; end if;
    v_before := to_jsonb(v_profile);
    delete from public.platform_operator_role_profiles where id = p_profile_id;
  else
    select role into v_target_role from public.platform_operator_accounts where user_id = p_user_id for update;
    if not found or v_target_role = 'founder' then raise exception 'Non-founder operator required' using errcode = '42501'; end if;
    select profile_id into v_current from public.platform_operator_role_profile_assignments where user_id = p_user_id;
    if v_current is distinct from p_expected_profile_id then raise exception 'Assignment changed; reload' using errcode = '40001'; end if;
    v_before := jsonb_build_object('user_id', p_user_id, 'profile_id', v_current);
    if p_profile_id is null then delete from public.platform_operator_role_profile_assignments where user_id = p_user_id;
    else
      insert into public.platform_operator_role_profile_assignments(user_id, profile_id) values(p_user_id, p_profile_id)
      on conflict(user_id) do update set profile_id = excluded.profile_id;
    end if;
    v_after := jsonb_build_object('user_id', p_user_id, 'profile_id', p_profile_id);
  end if;
  perform public.append_audit_log('platform.operator.role_profile.' || p_action, 'platform_operator_role_profiles',
    coalesce(p_user_id, v_profile.id), v_reason, jsonb_build_object('before', v_before, 'after', v_after, 'source', 'custom_operator_role_profiles'));
  return jsonb_build_object('action', p_action, 'profile_id', v_profile.id, 'user_id', p_user_id, 'profile', v_after, 'committed', true);
end;
$$;
revoke all on function public.platform_operator_role_profiles_snapshot() from public, anon, service_role;
revoke all on function public.platform_mutate_operator_role_profile(text, uuid, integer, text, text, jsonb, uuid, uuid, text) from public, anon, service_role;
grant execute on function public.platform_operator_role_profiles_snapshot() to authenticated;
grant execute on function public.platform_mutate_operator_role_profile(text, uuid, integer, text, text, jsonb, uuid, uuid, text) to authenticated;
commit;
