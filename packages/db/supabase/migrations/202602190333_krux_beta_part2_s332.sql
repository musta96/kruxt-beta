create policy event_outbox_service_only
on public.event_outbox for all to authenticated
using (public.is_service_role())
with check (public.is_service_role());
