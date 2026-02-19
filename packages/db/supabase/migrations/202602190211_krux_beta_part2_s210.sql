create policy gym_membership_plans_select_visible
on public.gym_membership_plans for select to authenticated
using (public.can_view_gym(gym_id, auth.uid()));
