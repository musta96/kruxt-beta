create policy device_sync_cursors_manage_service
on public.device_sync_cursors for all to authenticated
using (public.is_service_role())
with check (public.is_service_role());
