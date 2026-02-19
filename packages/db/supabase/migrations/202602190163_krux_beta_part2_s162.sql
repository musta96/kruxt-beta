create policy workout_exercises_insert_owner
on public.workout_exercises for insert to authenticated
with check (
  exists (
    select 1 from public.workouts w
    where w.id = workout_exercises.workout_id
      and w.user_id = auth.uid()
  )
);
