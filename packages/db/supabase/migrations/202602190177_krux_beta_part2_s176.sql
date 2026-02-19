create policy feed_events_select_visible
on public.feed_events for select to authenticated
using (
  exists (
    select 1
    from public.workouts w
    where w.id = feed_events.workout_id
      and public.can_view_workout(w.user_id, w.visibility, w.gym_id, auth.uid())
  )
);
