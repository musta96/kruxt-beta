create policy policy_versions_manage_service
on public.policy_version_tracking for all to authenticated
using (public.is_service_role())
with check (public.is_service_role());
