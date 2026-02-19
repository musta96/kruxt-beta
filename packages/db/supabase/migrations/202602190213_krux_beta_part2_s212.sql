create policy gym_membership_plans_manage_staff
on public.gym_membership_plans for all to authenticated
using (public.is_gym_staff(gym_id, auth.uid()))
with check (public.is_gym_staff(gym_id, auth.uid()));
