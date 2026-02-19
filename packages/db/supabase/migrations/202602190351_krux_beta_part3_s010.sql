create or replace function public.apply_workout_pr_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workout_id uuid;
  v_user_id uuid;
  v_exercise_id uuid;
  v_estimated_1rm numeric(14,3);
  v_previous_best numeric(14,3);
  v_workout_has_pr boolean;
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  select
    we.workout_id,
    w.user_id,
    we.exercise_id
  into
    v_workout_id,
    v_user_id,
    v_exercise_id
  from public.workout_exercises we
  join public.workouts w on w.id = we.workout_id
  where we.id = new.workout_exercise_id;

  if v_workout_id is null then
    return new;
  end if;

  if coalesce(new.reps, 0) > 0 and coalesce(new.weight_kg, 0) > 0 then
    v_estimated_1rm := (new.weight_kg * (1 + (new.reps::numeric / 30.0)))::numeric(14,3);

    select max((ws.weight_kg * (1 + (ws.reps::numeric / 30.0)))::numeric(14,3))
    into v_previous_best
    from public.workout_sets ws
    join public.workout_exercises we2 on we2.id = ws.workout_exercise_id
    join public.workouts w2 on w2.id = we2.workout_id
    where w2.user_id = v_user_id
      and we2.exercise_id = v_exercise_id
      and ws.id <> new.id
      and coalesce(ws.reps, 0) > 0
      and coalesce(ws.weight_kg, 0) > 0;

    if v_previous_best is null or v_estimated_1rm > v_previous_best then
      if new.is_pr is distinct from true then
        update public.workout_sets
        set is_pr = true
        where id = new.id;
      end if;
    end if;
  end if;

  update public.workouts w
  set is_pr = exists (
    select 1
    from public.workout_exercises we3
    join public.workout_sets ws3 on ws3.workout_exercise_id = we3.id
    where we3.workout_id = v_workout_id
      and ws3.is_pr = true
  )
  where w.id = v_workout_id;

  select w.is_pr into v_workout_has_pr
  from public.workouts w
  where w.id = v_workout_id;

  if v_workout_has_pr then
    if not exists (
      select 1
      from public.feed_events fe
      where fe.workout_id = v_workout_id
        and fe.event_type = 'pr_verified'
    ) then
      insert into public.feed_events(user_id, workout_id, event_type, caption, metadata)
      values (
        v_user_id,
        v_workout_id,
        'pr_verified',
        'PR forged. Post the proof.',
        jsonb_build_object('source', 'system_pr_detection')
      );
    end if;

    if not exists (
      select 1
      from public.event_outbox eo
      where eo.event_type = 'pr.verified'
        and eo.aggregate_type = 'workout'
        and eo.aggregate_id = v_workout_id
    ) then
      insert into public.event_outbox(event_type, aggregate_type, aggregate_id, payload)
      values (
        'pr.verified',
        'workout',
        v_workout_id,
        jsonb_build_object(
          'user_id', v_user_id,
          'workout_id', v_workout_id,
          'workout_set_id', new.id,
          'estimated_1rm', v_estimated_1rm
        )
      );
    end if;
  end if;

  return new;
end;
$$;
