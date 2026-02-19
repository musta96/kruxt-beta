create policy contract_acceptances_insert_self
on public.contract_acceptances for insert to authenticated
with check (user_id = auth.uid());
