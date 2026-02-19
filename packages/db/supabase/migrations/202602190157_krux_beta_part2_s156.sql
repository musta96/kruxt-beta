create policy workouts_update_own
on public.workouts for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
