create policy exercises_insert_self
on public.exercises for insert to authenticated
with check (created_by = auth.uid());
