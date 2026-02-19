create policy workouts_select_visible
on public.workouts for select to authenticated
using (
  not exists (
    select 1
    from public.user_blocks ub
    where (ub.blocker_user_id = auth.uid() and ub.blocked_user_id = workouts.user_id)
       or (ub.blocker_user_id = workouts.user_id and ub.blocked_user_id = auth.uid())
  )
  and public.can_view_workout(user_id, visibility, gym_id, auth.uid())
);
