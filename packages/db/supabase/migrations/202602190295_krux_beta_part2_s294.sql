create policy external_activity_imports_manage_service
on public.external_activity_imports for all to authenticated
using (public.is_service_role())
with check (public.is_service_role());
