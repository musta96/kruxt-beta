create policy privacy_requests_update_service
on public.privacy_requests for update to authenticated
using (public.is_service_role())
with check (public.is_service_role());
