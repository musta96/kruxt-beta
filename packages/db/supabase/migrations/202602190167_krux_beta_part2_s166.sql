create policy workout_exercises_delete_owner
on public.workout_exercises for delete to authenticated
using (
  exists (
    select 1 from public.workouts w
    where w.id = workout_exercises.workout_id
      and w.user_id = auth.uid()
  )
);
