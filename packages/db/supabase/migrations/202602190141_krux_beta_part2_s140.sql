create policy exercises_update_owner
on public.exercises for update to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());
