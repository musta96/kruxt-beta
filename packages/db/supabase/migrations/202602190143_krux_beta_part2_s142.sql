create policy exercises_delete_owner
on public.exercises for delete to authenticated
using (created_by = auth.uid());
