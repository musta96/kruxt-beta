-- Local forward hardening only. Deployment requires migration-lineage review.
begin;

-- ALL policies also supply SELECT: retain that part, remove every write policy
-- regardless of historical policy names or the roles to which it applies.
do $$
declare
  p record;
  v_roles text;
  v_table text;
begin
  for p in
    select pol.*, c.relname
    from pg_policy pol
    join pg_class c on c.oid = pol.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = any(array['platform_operator_accounts', 'platform_role_permissions',
        'platform_permission_catalog', 'platform_operator_permission_overrides'])
      and pol.polcmd <> 'r'
  loop
    if p.polcmd = '*' then
      select string_agg(case when r = 0 then 'public' else quote_ident(pg_get_userbyid(r)) end, ', ')
      into v_roles from unnest(p.polroles) r;
      execute format('drop policy %I on public.%I', p.polname, p.relname);
      execute format('create policy %I on public.%I as %s for select to %s using (%s)',
        p.polname, p.relname, case when p.polpermissive then 'permissive' else 'restrictive' end,
        v_roles, coalesce(pg_get_expr(p.polqual, p.polrelid), 'true'));
    else
      execute format('drop policy %I on public.%I', p.polname, p.relname);
    end if;
  end loop;

  foreach v_table in array array['platform_operator_accounts', 'platform_role_permissions',
    'platform_permission_catalog', 'platform_operator_permission_overrides']
  loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('revoke insert, update, delete, truncate, references, trigger on public.%I from public, anon, authenticated', v_table);
    -- Restrictive guards also cover inherited/column grants and future permissive
    -- policies. Owner/BYPASSRLS maintenance remains an explicit trust boundary.
    execute format('create policy operator_boundary_insert on public.%I as restrictive for insert to anon, authenticated with check (false)', v_table);
    execute format('create policy operator_boundary_update on public.%I as restrictive for update to anon, authenticated using (false) with check (false)', v_table);
    execute format('create policy operator_boundary_delete on public.%I as restrictive for delete to anon, authenticated using (false)', v_table);
    execute format('grant select, insert, update, delete on public.%I to service_role', v_table);
  end loop;
end;
$$;

create or replace function public.platform_operator_has_permission(
  _permission_key text, _viewer uuid default auth.uid()
)
returns boolean
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_role public.platform_operator_role;
  v_allowed boolean;
begin
  if public.is_service_role() then return true; end if;
  if _viewer is null then return false; end if;
  if not exists (
    select 1 from public.platform_permission_catalog
    where permission_key = lower(_permission_key) and is_active
  ) then return false; end if;
  select role into v_role from public.platform_operator_accounts
    where user_id = _viewer and is_active;
  if v_role is null then return false; end if;
  select is_allowed into v_allowed from public.platform_operator_permission_overrides
    where user_id = _viewer and permission_key = lower(_permission_key);
  if found then return v_allowed; end if;
  select is_allowed into v_allowed from public.platform_role_permissions
    where role = v_role and permission_key = lower(_permission_key);
  return coalesce(v_allowed, false);
end;
$$;

-- Owner-only implementation, SECURITY INVOKER. Only the two guarded definer
-- entrypoints below may call it on behalf of authenticated clients.
create function public.platform_mutate_operator_override_internal(
  p_user_id uuid, p_permission_key text, p_is_allowed boolean,
  p_reason text, p_clear boolean
)
returns jsonb
language plpgsql security invoker
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_key text := lower(trim(coalesce(p_permission_key, '')));
  v_reason text := nullif(regexp_replace(coalesce(p_reason, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g'), '');
  v_role public.platform_operator_role;
  v_active boolean;
  v_previous boolean;
  v_default boolean;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  -- Lock authority and target state through audit completion; concurrent trusted
  -- maintenance cannot demote the actor or promote the target mid-mutation.
  perform 1 from public.platform_operator_accounts
    where user_id = v_actor and role = 'founder' and is_active for share;
  if not found then raise exception 'Active founder required' using errcode = '42501'; end if;
  if (auth.jwt() ->> 'aal') is distinct from 'aal2' then
    raise exception 'MFA AAL2 required' using errcode = '42501';
  end if;
  if not public.platform_operator_has_permission('platform.operators.roles_matrix_edit', v_actor) then
    raise exception 'Permission matrix edit access is required' using errcode = '42501';
  end if;
  if v_reason is null then raise exception 'A nonempty reason is required' using errcode = '22023'; end if;
  if not p_clear and p_is_allowed is null then
    raise exception 'An explicit allow or deny is required' using errcode = '22023';
  end if;
  select role, is_active into v_role, v_active from public.platform_operator_accounts
    where user_id = p_user_id for update;
  if not found then raise exception 'Operator account not found'; end if;
  if v_role = 'founder' then raise exception 'Founder permissions are non-editable' using errcode = '42501'; end if;
  perform 1 from public.platform_permission_catalog
    where permission_key = v_key and is_active for share;
  if not found then raise exception 'Active permission key required' using errcode = '22023'; end if;
  select is_allowed into v_previous from public.platform_operator_permission_overrides
    where user_id = p_user_id and permission_key = v_key;
  select is_allowed into v_default from public.platform_role_permissions
    where role = v_role and permission_key = v_key;

  if p_clear then
    delete from public.platform_operator_permission_overrides
      where user_id = p_user_id and permission_key = v_key;
  else
    insert into public.platform_operator_permission_overrides
      (user_id, permission_key, is_allowed, reason, updated_by, metadata)
    values (p_user_id, v_key, p_is_allowed, v_reason, v_actor,
      jsonb_build_object('source', 'operators_permission_matrix_v2'))
    on conflict (user_id, permission_key) do update set
      is_allowed = excluded.is_allowed, reason = excluded.reason,
      updated_by = excluded.updated_by,
      metadata = public.platform_operator_permission_overrides.metadata || excluded.metadata,
      updated_at = now();
  end if;
  perform public.append_audit_log(
    case when p_clear then 'platform.operator.permission_override.cleared'
      else 'platform.operator.permission_override.changed' end,
    'platform_operator_permission_overrides', p_user_id, v_reason,
    jsonb_build_object('permissionKey', v_key, 'targetUserId', p_user_id,
      'targetRole', v_role, 'targetWasActive', v_active,
      'roleDefault', coalesce(v_default, false), 'previousOverride', v_previous,
      'nextOverride', case when p_clear then null else p_is_allowed end,
      'source', 'operators_permission_matrix_v2'));
  if p_clear then
    return jsonb_build_object('userId', p_user_id, 'permissionKey', v_key, 'cleared', true);
  end if;
  return jsonb_build_object('userId', p_user_id, 'permissionKey', v_key, 'isAllowed', p_is_allowed);
end;
$$;

create or replace function public.platform_set_operator_permission_override(
  p_user_id uuid, p_permission_key text, p_is_allowed boolean, p_reason text default null
)
returns jsonb language sql security definer set search_path = public
as $$
  select public.platform_mutate_operator_override_internal(p_user_id, p_permission_key, p_is_allowed, p_reason, false);
$$;

create or replace function public.platform_clear_operator_permission_override(
  p_user_id uuid, p_permission_key text, p_reason text default null
)
returns jsonb language sql security definer set search_path = public
as $$
  select public.platform_mutate_operator_override_internal(p_user_id, p_permission_key, null, p_reason, true);
$$;

revoke all on function public.platform_mutate_operator_override_internal(uuid, text, boolean, text, boolean) from public, anon, authenticated, service_role;
-- Preserve the existing resolver EXECUTE ACL: anonymous public RLS consumers
-- may depend on it. Mutation entrypoints and the internal helper are separate.
revoke all on function public.platform_set_operator_permission_override(uuid, text, boolean, text) from public, anon, service_role;
revoke all on function public.platform_clear_operator_permission_override(uuid, text, text) from public, anon, service_role;
grant execute on function public.platform_set_operator_permission_override(uuid, text, boolean, text) to authenticated;
grant execute on function public.platform_clear_operator_permission_override(uuid, text, text) to authenticated;
commit;
