create policy gym_classes_select_visible
on public.gym_classes for select to authenticated
using (public.can_view_gym(gym_id, auth.uid()));
