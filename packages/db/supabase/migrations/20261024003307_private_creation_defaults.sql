-- Narrow forward-only privacy repair. Does not change any existing row.
begin;
set local lock_timeout='2s';
set local statement_timeout='10s';
do $$
begin
  if not exists(select 1 from pg_catalog.pg_attribute where attrelid='public.profiles'::regclass
      and attname='is_public' and atttypid='boolean'::regtype and not attisdropped)
    or not exists(select 1 from pg_catalog.pg_attribute where attrelid='public.workouts'::regclass
      and attname='visibility' and atttypid='public.workout_visibility'::regtype and not attisdropped) then
    raise exception 'Unexpected privacy column types; review the target schema';
  end if;
end $$;
alter table public.profiles alter column is_public set default false;
alter table public.workouts alter column visibility set default 'private'::public.workout_visibility;
commit;
