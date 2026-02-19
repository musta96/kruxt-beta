create policy waivers_select_visible
on public.waivers for select to authenticated
using (public.can_view_gym(gym_id, auth.uid()));
