create policy social_interactions_insert_self
on public.social_interactions for insert to authenticated
with check (
  actor_user_id = auth.uid()
  and exists (
    select 1
    from public.workouts w
    where w.id = social_interactions.workout_id
      and public.can_view_workout(w.user_id, w.visibility, w.gym_id, auth.uid())
  )
);
