create policy device_connections_insert_self
on public.device_connections for insert to authenticated
with check (user_id = auth.uid());
