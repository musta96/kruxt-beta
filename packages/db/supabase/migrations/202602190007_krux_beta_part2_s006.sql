create or replace function public.rebuild_leaderboard_scope(p_leaderboard_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lb public.leaderboards%rowtype;
  v_count integer := 0;
begin
  select *
  into v_lb
  from public.leaderboards
  where id = p_leaderboard_id;

  if v_lb.id is null then
    raise exception 'Leaderboard not found';
  end if;

  if not public.is_service_role()
    and (v_lb.scope_gym_id is not null and not public.is_gym_staff(v_lb.scope_gym_id, auth.uid()))
  then
    raise exception 'Not authorized to rebuild this leaderboard';
  end if;

  delete from public.leaderboard_entries
  where leaderboard_id = p_leaderboard_id;

  if v_lb.metric = 'xp' then
    insert into public.leaderboard_entries(leaderboard_id, user_id, rank, score, details)
    select
      p_leaderboard_id,
      p.id,
      row_number() over (order by p.xp_total desc, p.created_at asc),
      p.xp_total::numeric,
      jsonb_build_object('metric', 'xp')
    from public.profiles p
    where (v_lb.scope = 'global')
       or (v_lb.scope = 'gym' and p.home_gym_id = v_lb.scope_gym_id)
       or (v_lb.scope = 'exercise')
       or (v_lb.scope = 'challenge')
    limit 500;

  elsif v_lb.metric = 'consistency_days' then
    insert into public.leaderboard_entries(leaderboard_id, user_id, rank, score, details)
    select
      p_leaderboard_id,
      p.id,
      row_number() over (order by p.chain_days desc, p.created_at asc),
      p.chain_days::numeric,
      jsonb_build_object('metric', 'consistency_days')
    from public.profiles p
    where (v_lb.scope = 'global')
       or (v_lb.scope = 'gym' and p.home_gym_id = v_lb.scope_gym_id)
    limit 500;

  elsif v_lb.metric = 'volume_kg' then
    insert into public.leaderboard_entries(leaderboard_id, user_id, rank, score, details)
    select
      p_leaderboard_id,
      x.user_id,
      row_number() over (order by x.score desc, x.user_id),
      x.score,
      jsonb_build_object('metric', 'volume_kg', 'starts_at', v_lb.starts_at, 'ends_at', v_lb.ends_at)
    from (
      select
        w.user_id,
        coalesce(sum(w.total_volume_kg), 0)::numeric(14,3) as score
      from public.workouts w
      where w.started_at >= v_lb.starts_at
        and w.started_at < v_lb.ends_at
        and (
          v_lb.scope = 'global'
          or (v_lb.scope = 'gym' and w.gym_id = v_lb.scope_gym_id)
          or (v_lb.scope = 'exercise' and exists (
            select 1 from public.workout_exercises we
            where we.workout_id = w.id and we.exercise_id = v_lb.scope_exercise_id
          ))
        )
      group by w.user_id
    ) x
    limit 500;

  elsif v_lb.metric = 'estimated_1rm' then
    insert into public.leaderboard_entries(leaderboard_id, user_id, rank, score, details)
    select
      p_leaderboard_id,
      x.user_id,
      row_number() over (order by x.score desc, x.user_id),
      x.score,
      jsonb_build_object('metric', 'estimated_1rm')
    from (
      select
        w.user_id,
        max((coalesce(ws.weight_kg, 0) * (1 + coalesce(ws.reps, 0) / 30.0))::numeric(14,3)) as score
      from public.workout_sets ws
      join public.workout_exercises we on we.id = ws.workout_exercise_id
      join public.workouts w on w.id = we.workout_id
      where w.started_at >= v_lb.starts_at
        and w.started_at < v_lb.ends_at
        and (
          v_lb.scope <> 'exercise' or we.exercise_id = v_lb.scope_exercise_id
        )
      group by w.user_id
    ) x
    where x.score is not null
    limit 500;

  elsif v_lb.metric = 'challenge_score' then
    insert into public.leaderboard_entries(leaderboard_id, user_id, rank, score, details)
    select
      p_leaderboard_id,
      cp.user_id,
      row_number() over (order by cp.score desc, cp.user_id),
      cp.score::numeric(14,3),
      jsonb_build_object('metric', 'challenge_score', 'challenge_id', cp.challenge_id)
    from public.challenge_participants cp
    where (v_lb.scope = 'challenge' and cp.challenge_id = v_lb.scope_challenge_id)
       or (v_lb.scope = 'global')
    limit 500;
  end if;

  get diagnostics v_count = row_count;

  insert into public.event_outbox(event_type, aggregate_type, aggregate_id, payload)
  values (
    'rank.updated',
    'leaderboard',
    p_leaderboard_id,
    jsonb_build_object('leaderboard_id', p_leaderboard_id, 'rows', v_count)
  );

  return v_count;
end;
$$;
