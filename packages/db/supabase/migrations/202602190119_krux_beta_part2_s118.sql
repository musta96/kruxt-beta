create policy feature_flags_manage_service
on public.feature_flags for all to authenticated
using (public.is_service_role())
with check (public.is_service_role());
