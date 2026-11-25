set lock_timeout = '5s';

create table public.workout_create_receipts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  idempotency_key uuid not null,
  payload_hash bytea not null check (octet_length(payload_hash) = 32),
  workout_id uuid references public.workouts(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, idempotency_key)
);
alter table public.workout_create_receipts enable row level security;
revoke all on public.workout_create_receipts from public, anon, authenticated;

create or replace function public.log_workout_atomic(p_workout jsonb, p_exercises jsonb)
returns uuid language plpgsql security definer set search_path = public
set lock_timeout = '5s' as $$
declare
  v_user uuid := auth.uid();
  v_key uuid;
  v_hash bytea;
  v_receipt public.workout_create_receipts%rowtype;
  v_id uuid;
  v_claimed boolean;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_workout->>'visibility' is null then
    p_workout := coalesce(p_workout, '{}'::jsonb) || '{"visibility":"private"}'::jsonb;
  end if;
  if not (p_workout ? 'idempotency_key') then
    return public.log_workout_atomic_legacy(p_workout, p_exercises);
  end if;
  if jsonb_typeof(p_workout->'idempotency_key') <> 'string'
     or length(p_workout->>'idempotency_key') <> 36 then
    raise exception 'idempotency_key must be a UUID' using errcode = '22023';
  end if;
  begin
    v_key := (p_workout->>'idempotency_key')::uuid;
  exception when invalid_text_representation then
    raise exception 'idempotency_key must be a UUID' using errcode = '22023';
  end;
  if octet_length(p_workout::text) + octet_length(coalesce(p_exercises::text, 'null')) > 262144
     or jsonb_typeof(p_exercises) is distinct from 'array' then
    raise exception 'Keyed workout payload must be an array and at most 256 KiB' using errcode = '22023';
  end if;
  if jsonb_array_length(p_exercises) not between 1 and 200 then
    raise exception 'Keyed workouts require 1 to 200 exercise blocks' using errcode = '22023';
  end if;
  v_hash := sha256(convert_to(jsonb_build_array(p_workout - 'idempotency_key', p_exercises)::text, 'UTF8'));
  insert into public.workout_create_receipts(user_id, idempotency_key, payload_hash)
    values (v_user, v_key, v_hash) on conflict do nothing;
  v_claimed := found;
  select * into strict v_receipt from public.workout_create_receipts
    where user_id = v_user and idempotency_key = v_key for update;
  if not v_claimed then
    if v_receipt.payload_hash <> v_hash then
      raise exception 'Idempotency key already used with a different workout payload' using errcode = '22023';
    end if;
    if v_receipt.workout_id is null then
      raise exception 'Original workout no longer exists' using errcode = 'P0002';
    end if;
    return v_receipt.workout_id;
  end if;
  v_id := public.log_workout_atomic_legacy(p_workout - 'idempotency_key', p_exercises);
  update public.workout_create_receipts set workout_id = v_id
    where user_id = v_user and idempotency_key = v_key;
  return v_id;
end;
$$;
revoke all on function public.log_workout_atomic(jsonb, jsonb) from public, anon;
grant execute on function public.log_workout_atomic(jsonb, jsonb) to authenticated, service_role;

-- Definer lookup avoids depending on the caller's visibility of block rows.
-- It can only answer questions involving the signed-in caller.
create function public.social_pair_unblocked(_first uuid, _second uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and auth.uid() in (_first, _second)
    and not exists (select 1 from public.user_blocks b
      where (b.blocker_user_id = _first and b.blocked_user_id = _second)
         or (b.blocker_user_id = _second and b.blocked_user_id = _first));
$$;
revoke all on function public.social_pair_unblocked(uuid, uuid) from public, anon;
grant execute on function public.social_pair_unblocked(uuid, uuid) to authenticated, service_role;

create or replace function public.can_view_workout(
  _owner uuid, _visibility public.workout_visibility, _gym_id uuid, _viewer uuid default auth.uid()
)
returns boolean language sql stable security definer set search_path = public as $$
  select _viewer = auth.uid() and (
    _viewer = _owner or (
      public.social_pair_unblocked(_owner, _viewer) and (
        _visibility = 'public'
        or (_visibility = 'followers' and exists (
          select 1 from public.social_connections sc where sc.follower_user_id = _viewer
            and sc.followed_user_id = _owner and sc.status = 'accepted'))
        or (_visibility = 'gym' and _gym_id is not null and public.is_gym_member(_gym_id, _viewer))
      )
    )
  );
$$;
revoke all on function public.can_view_workout(uuid, public.workout_visibility, uuid, uuid) from public, anon;
grant execute on function public.can_view_workout(uuid, public.workout_visibility, uuid, uuid) to authenticated, service_role;

create policy social_connections_block_select on public.social_connections as restrictive
for select to authenticated using (public.social_pair_unblocked(follower_user_id, followed_user_id)
  or (auth.uid() not in (follower_user_id, followed_user_id)
    and public.social_pair_unblocked(auth.uid(), follower_user_id)
    and public.social_pair_unblocked(auth.uid(), followed_user_id)));
create policy social_connections_block_insert on public.social_connections as restrictive
for insert to authenticated with check (public.social_pair_unblocked(follower_user_id, followed_user_id));
create policy social_connections_block_update on public.social_connections as restrictive
for update to authenticated using (public.social_pair_unblocked(follower_user_id, followed_user_id))
with check (public.social_pair_unblocked(follower_user_id, followed_user_id));

-- An actor must not move an existing interaction onto a hidden/blocked workout.
create policy social_interactions_safe_update on public.social_interactions as restrictive
for update to authenticated using (
  public.social_pair_unblocked(auth.uid(), actor_user_id)
  and exists (select 1 from public.workouts w where w.id = workout_id)
) with check (
  actor_user_id = auth.uid()
  and exists (select 1 from public.workouts w where w.id = workout_id)
);
create policy social_interactions_block_select on public.social_interactions as restrictive
for select to authenticated using (public.social_pair_unblocked(auth.uid(), actor_user_id));

-- This private attachment table is deployed by the separate root history.
-- Do not silently create it or rewrite that history on packaged deployments.
do $$ begin
  if to_regclass('public.workout_proof_media') is not null then
    execute $policy$create policy workout_proof_media_safe_update
      on public.workout_proof_media as restrictive for update to authenticated
      using (uploader_user_id = auth.uid() and exists (
        select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid()))
      with check (uploader_user_id = auth.uid() and exists (
        select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid()))$policy$;
  end if;
end $$;
