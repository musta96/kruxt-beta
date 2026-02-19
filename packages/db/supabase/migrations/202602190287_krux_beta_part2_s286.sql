create policy device_sync_jobs_select_self
on public.device_sync_jobs for select to authenticated
using (user_id = auth.uid());
