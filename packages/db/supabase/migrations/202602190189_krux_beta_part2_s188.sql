create policy challenges_select_visible
on public.challenges for select to authenticated
using (
  visibility = 'public'
  or creator_user_id = auth.uid()
  or (
    visibility = 'gym'
    and gym_id is not null
    and public.can_view_gym(gym_id, auth.uid())
  )
);
