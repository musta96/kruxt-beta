create policy gym_checkins_select_self_or_staff
on public.gym_checkins for select to authenticated
using (user_id = auth.uid() or public.is_gym_staff(gym_id, auth.uid()));
