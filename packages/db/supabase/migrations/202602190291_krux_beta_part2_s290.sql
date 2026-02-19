create policy device_sync_jobs_update_service_or_self
on public.device_sync_jobs for update to authenticated
using (public.is_service_role() or requested_by = auth.uid())
with check (public.is_service_role() or requested_by = auth.uid());
