create policy integration_webhook_events_service_only
on public.integration_webhook_events for all to authenticated
using (public.is_service_role())
with check (public.is_service_role());
