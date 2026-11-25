-- Keep the BZone demo seed unavailable unless a project operator explicitly
-- enables it. This migration changes capability only; it does not seed or
-- purge any data.

insert into public.feature_flags(key, description, enabled, rollout_percentage)
values (
  'demo_seed_enabled',
  'Allow authorized gym owners or platform operators to create the BZone UAT/demo dataset',
  false,
  0
)
on conflict (key) do update
set description = excluded.description,
    enabled = false,
    rollout_percentage = 0,
    updated_at = now();

create or replace function public.demo_seed_is_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select ff.enabled and ff.rollout_percentage = 100
    from public.feature_flags ff
    where ff.key = 'demo_seed_enabled'
  ), false);
$$;

revoke all on function public.demo_seed_is_enabled() from public;
grant execute on function public.demo_seed_is_enabled() to authenticated;
grant execute on function public.demo_seed_is_enabled() to service_role;

do $$
begin
  if to_regprocedure('public.seed_bzone_demo_people_internal(uuid)') is null then
    alter function public.seed_bzone_demo_people(uuid)
      rename to seed_bzone_demo_people_internal;
  end if;
end;
$$;

revoke all on function public.seed_bzone_demo_people_internal(uuid) from public;
revoke all on function public.seed_bzone_demo_people_internal(uuid) from authenticated;

create or replace function public.seed_bzone_demo_people(p_gym_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id uuid;
  v_effective_user_id uuid;
  v_gym_owner_user_id uuid;
  v_is_service_role boolean := public.is_service_role();
  v_original_claims text;
  v_internal_claims jsonb;
  v_result jsonb;
begin
  if not public.demo_seed_is_enabled() then
    raise exception using
      errcode = '42501',
      message = 'BZone demo seeding is disabled for this project';
  end if;

  select g.owner_user_id
  into v_gym_owner_user_id
  from public.gyms g
  where g.id = p_gym_id;

  if not found then
    raise exception 'Gym not found';
  end if;

  if not v_is_service_role then
    v_actor_user_id := auth.uid();
    if v_actor_user_id is null then
      raise exception using
        errcode = '42501',
        message = 'Authentication required';
    end if;

    if not (
      public.user_has_gym_permission(
        p_gym_id,
        'danger.destructive',
        v_actor_user_id
      )
      or public.platform_operator_has_permission(
        'platform.gyms.manage',
        v_actor_user_id
      )
    ) then
      raise exception using
        errcode = '42501',
        message = 'Gym owner or platform operator access is required';
    end if;
  end if;

  -- The legacy internal function requires a non-null auth.uid() and predates
  -- the destructive permission contract. After enforcing that contract above,
  -- use transaction-local claims so both authorized callers and service-role
  -- automation can enter it without widening its public grants.
  v_effective_user_id := coalesce(v_actor_user_id, v_gym_owner_user_id);
  if v_effective_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Service-role demo seed requires a gym owner provenance user';
  end if;

  v_original_claims := current_setting('request.jwt.claims', true);
  v_internal_claims := coalesce(
    nullif(v_original_claims, '')::jsonb,
    '{}'::jsonb
  ) || jsonb_build_object(
    'role', 'service_role',
    'sub', v_effective_user_id::text
  );
  perform set_config('request.jwt.claims', v_internal_claims::text, true);

  begin
    v_result := public.seed_bzone_demo_people_internal(p_gym_id);
  exception when others then
    perform set_config(
      'request.jwt.claims',
      coalesce(nullif(v_original_claims, ''), '{}'),
      true
    );
    raise;
  end;

  perform set_config(
    'request.jwt.claims',
    coalesce(nullif(v_original_claims, ''), '{}'),
    true
  );
  return v_result;
end;
$$;

revoke all on function public.seed_bzone_demo_people(uuid) from public;
grant execute on function public.seed_bzone_demo_people(uuid) to authenticated;
grant execute on function public.seed_bzone_demo_people(uuid) to service_role;
