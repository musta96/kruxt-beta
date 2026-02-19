create policy challenges_update_creator_or_staff
on public.challenges for update to authenticated
using (
  creator_user_id = auth.uid()
  or (gym_id is not null and public.is_gym_staff(gym_id, auth.uid()))
)
with check (
  creator_user_id = auth.uid()
  or (gym_id is not null and public.is_gym_staff(gym_id, auth.uid()))
);
