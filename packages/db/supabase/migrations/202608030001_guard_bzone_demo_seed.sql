-- Keep the BZone demo seed unavailable unless a project operator explicitly
-- enables it. This migration changes capability only; it does not seed or
-- purge any data.

insert into public.feature_flags(key, description, enabled, rollout_percentage)
values (
  'demo_seed_enabled',
  'Allow authorized staff to create the BZone UAT/demo dataset',
  false,
  0
)
on conflict (key) do nothing;

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
begin
  if not public.demo_seed_is_enabled() then
    raise exception using
      errcode = '42501',
      message = 'BZone demo seeding is disabled for this project';
  end if;

  return public.seed_bzone_demo_people_internal(p_gym_id);
end;
$$;

revoke all on function public.seed_bzone_demo_people(uuid) from public;
grant execute on function public.seed_bzone_demo_people(uuid) to authenticated;
grant execute on function public.seed_bzone_demo_people(uuid) to service_role;
