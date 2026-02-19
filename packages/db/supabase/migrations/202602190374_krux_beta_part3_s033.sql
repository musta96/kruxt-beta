create policy device_sync_cursors_select_self
on public.device_sync_cursors for select to authenticated
using (user_id = auth.uid());
