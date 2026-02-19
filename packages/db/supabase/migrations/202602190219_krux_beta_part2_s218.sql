create policy gym_memberships_update_self_or_staff
on public.gym_memberships for update to authenticated
using (user_id = auth.uid() or public.is_gym_staff(gym_id, auth.uid()))
with check (user_id = auth.uid() or public.is_gym_staff(gym_id, auth.uid()));
