create policy social_interactions_select_visible
on public.social_interactions for select to authenticated
using (
  exists (
    select 1
    from public.workouts w
    where w.id = social_interactions.workout_id
      and public.can_view_workout(w.user_id, w.visibility, w.gym_id, auth.uid())
  )
);
