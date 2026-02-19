create policy exercises_select_public_or_owner
on public.exercises for select to authenticated
using (is_public or created_by = auth.uid());
