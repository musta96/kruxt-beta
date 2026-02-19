create policy workout_sets_select_visible
on public.workout_sets for select to authenticated
using (
  exists (
    select 1
    from public.workout_exercises we
    join public.workouts w on w.id = we.workout_id
    where we.id = workout_sets.workout_exercise_id
      and public.can_view_workout(w.user_id, w.visibility, w.gym_id, auth.uid())
  )
);
