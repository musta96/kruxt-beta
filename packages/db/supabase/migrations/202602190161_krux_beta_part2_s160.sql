create policy workout_exercises_select_visible
on public.workout_exercises for select to authenticated
using (
  exists (
    select 1
    from public.workouts w
    where w.id = workout_exercises.workout_id
      and public.can_view_workout(w.user_id, w.visibility, w.gym_id, auth.uid())
  )
);
