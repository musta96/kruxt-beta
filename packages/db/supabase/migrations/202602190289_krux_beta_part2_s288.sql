create policy device_sync_jobs_insert_self_or_service
on public.device_sync_jobs for insert to authenticated
with check (user_id = auth.uid() or public.is_service_role());
