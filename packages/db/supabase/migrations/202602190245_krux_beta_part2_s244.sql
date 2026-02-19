create policy contracts_select_visible
on public.contracts for select to authenticated
using (public.can_view_gym(gym_id, auth.uid()));
