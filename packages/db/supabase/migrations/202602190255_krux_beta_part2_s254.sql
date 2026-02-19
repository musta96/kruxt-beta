create policy gym_checkins_insert_self_or_staff
on public.gym_checkins for insert to authenticated
with check (user_id = auth.uid() or public.is_gym_staff(gym_id, auth.uid()));
