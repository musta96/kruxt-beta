create policy waivers_manage_staff
on public.waivers for all to authenticated
using (public.is_gym_staff(gym_id, auth.uid()))
with check (public.is_gym_staff(gym_id, auth.uid()));
