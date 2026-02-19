create policy workouts_delete_own
on public.workouts for delete to authenticated
using (user_id = auth.uid());
