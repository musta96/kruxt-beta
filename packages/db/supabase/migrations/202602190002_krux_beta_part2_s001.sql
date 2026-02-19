-- =====================================================
-- RPC FUNCTIONS
-- =====================================================

create or replace function public.log_workout_atomic(
  p_workout jsonb,
  p_exercises jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workout_id uuid;
  v_workout_exercise_id uuid;
  v_exercise jsonb;
  v_set jsonb;
  v_order integer := 1;
  v_set_idx integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.workouts(
    user_id,
    gym_id,
    title,
    workout_type,
    notes,
    started_at,
    ended_at,
    rpe,
    visibility,
    source,
    external_activity_id
  )
  values (
    auth.uid(),
    nullif(p_workout->>'gym_id', '')::uuid,
    coalesce(p_workout->>'title', 'Workout Session'),
    coalesce((p_workout->>'workout_type')::public.workout_type, 'strength'),
    p_workout->>'notes',
    coalesce((p_workout->>'started_at')::timestamptz, now()),
    nullif(p_workout->>'ended_at', '')::timestamptz,
    nullif(p_workout->>'rpe', '')::numeric,
    coalesce((p_workout->>'visibility')::public.workout_visibility, 'public'),
    coalesce((p_workout->>'source')::public.integration_provider, 'manual'),
    p_workout->>'external_activity_id'
  )
  returning id into v_workout_id;

  if jsonb_typeof(p_exercises) = 'array' then
    for v_exercise in select value from jsonb_array_elements(p_exercises)
    loop
      insert into public.workout_exercises(
        workout_id,
        exercise_id,
        order_index,
        block_id,
        block_type,
        target_reps,
        target_weight_kg,
        notes
      )
      values (
        v_workout_id,
        (v_exercise->>'exercise_id')::uuid,
        coalesce((v_exercise->>'order_index')::integer, v_order),
        nullif(v_exercise->>'block_id', '')::uuid,
        coalesce((v_exercise->>'block_type')::public.workout_block_type, 'straight_set'),
        v_exercise->>'target_reps',
        nullif(v_exercise->>'target_weight_kg', '')::numeric,
        v_exercise->>'notes'
      )
      returning id into v_workout_exercise_id;

      v_order := v_order + 1;
      v_set_idx := 1;

      if jsonb_typeof(v_exercise->'sets') = 'array' then
        for v_set in select value from jsonb_array_elements(v_exercise->'sets')
        loop
          insert into public.workout_sets(
            workout_exercise_id,
            set_index,
            reps,
            weight_kg,
            duration_seconds,
            distance_m,
            rpe,
            is_pr
          )
          values (
            v_workout_exercise_id,
            coalesce((v_set->>'set_index')::integer, v_set_idx),
            nullif(v_set->>'reps', '')::integer,
            nullif(v_set->>'weight_kg', '')::numeric,
            nullif(v_set->>'duration_seconds', '')::integer,
            nullif(v_set->>'distance_m', '')::integer,
            nullif(v_set->>'rpe', '')::numeric,
            coalesce((v_set->>'is_pr')::boolean, false)
          );

          v_set_idx := v_set_idx + 1;
        end loop;
      end if;
    end loop;
  end if;

  perform public.refresh_workout_totals(v_workout_id);

  return v_workout_id;
end;
$$;
