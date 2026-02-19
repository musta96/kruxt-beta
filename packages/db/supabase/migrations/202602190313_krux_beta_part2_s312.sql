create policy policy_versions_select
on public.policy_version_tracking for select to authenticated
using (true);
