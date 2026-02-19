create policy waiver_acceptances_insert_self
on public.waiver_acceptances for insert to authenticated
with check (user_id = auth.uid());
