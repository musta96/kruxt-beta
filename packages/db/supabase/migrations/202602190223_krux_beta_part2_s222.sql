create policy gym_classes_manage_staff
on public.gym_classes for all to authenticated
using (public.is_gym_staff(gym_id, auth.uid()))
with check (public.is_gym_staff(gym_id, auth.uid()));
