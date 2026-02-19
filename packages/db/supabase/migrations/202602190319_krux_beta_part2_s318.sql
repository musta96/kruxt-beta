create policy consents_insert_self
on public.consents for insert to authenticated
with check (user_id = auth.uid() or public.is_service_role());
