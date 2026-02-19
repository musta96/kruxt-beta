create policy challenges_insert_self
on public.challenges for insert to authenticated
with check (
  creator_user_id = auth.uid()
  and (gym_id is null or public.is_gym_staff(gym_id, auth.uid()))
);
