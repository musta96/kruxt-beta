create policy device_connections_update_self_or_service
on public.device_connections for update to authenticated
using (user_id = auth.uid() or public.is_service_role())
with check (user_id = auth.uid() or public.is_service_role());
