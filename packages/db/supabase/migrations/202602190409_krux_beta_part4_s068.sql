alter table public.privacy_export_jobs enable row level security;

drop policy if exists privacy_export_jobs_select_self_or_service on public.privacy_export_jobs;
create policy privacy_export_jobs_select_self_or_service
on public.privacy_export_jobs for select to authenticated
using (user_id = auth.uid() or public.is_service_role());

drop policy if exists privacy_export_jobs_manage_service on public.privacy_export_jobs;
create policy privacy_export_jobs_manage_service
on public.privacy_export_jobs for all to authenticated
using (public.is_service_role())
with check (public.is_service_role());

revoke all on function public.build_privacy_export_payload(uuid) from public;
grant execute on function public.build_privacy_export_payload(uuid) to authenticated;
grant execute on function public.build_privacy_export_payload(uuid) to service_role;

revoke all on function public.queue_privacy_export_jobs(integer) from public;
grant execute on function public.queue_privacy_export_jobs(integer) to service_role;

revoke all on function public.claim_privacy_export_jobs(integer) from public;
grant execute on function public.claim_privacy_export_jobs(integer) to service_role;

revoke all on function public.complete_privacy_export_job(
  uuid,
  text,
  text,
  text,
  timestamptz,
  bigint,
  integer,
  text
) from public;
grant execute on function public.complete_privacy_export_job(
  uuid,
  text,
  text,
  text,
  timestamptz,
  bigint,
  integer,
  text
) to service_role;

revoke all on function public.fail_privacy_export_job(
  uuid,
  text,
  integer,
  integer
) from public;
grant execute on function public.fail_privacy_export_job(
  uuid,
  text,
  integer,
  integer
) to service_role;
