create policy device_connections_select_self
on public.device_connections for select to authenticated
using (user_id = auth.uid());
