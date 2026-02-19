create policy workout_sets_insert_owner
on public.workout_sets for insert to authenticated
with check (
  exists (
    select 1
    from public.workout_exercises we
    join public.workouts w on w.id = we.workout_id
    where we.id = workout_sets.workout_exercise_id
      and w.user_id = auth.uid()
  )
);
