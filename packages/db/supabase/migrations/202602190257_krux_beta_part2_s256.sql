create policy access_logs_select_staff_or_self
on public.access_logs for select to authenticated
using ((user_id is not null and user_id = auth.uid()) or public.is_gym_staff(gym_id, auth.uid()));
