create policy workouts_insert_own
on public.workouts for insert to authenticated
with check (user_id = auth.uid());
