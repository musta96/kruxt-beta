create or replace function public.admin_get_privacy_ops_metrics(
  p_gym_id uuid,
  p_window_days integer default 30
)
returns table (
  gym_id uuid,
  open_requests integer,
  overdue_requests integer,
  avg_completion_hours numeric(10,2),
  fulfilled_requests_window integer,
  rejected_requests_window integer,
  measured_window_days integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_days integer := greatest(1, least(coalesce(p_window_days, 30), 365));
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_gym_staff(p_gym_id, auth.uid()) then
    raise exception 'Gym staff access is required';
  end if;

  return query
  with gym_requests as (
    select
      pr.status,
      pr.submitted_at,
      pr.resolved_at,
      pr.due_at,
      pr.sla_breached_at
    from public.privacy_requests pr
    where exists (
      select 1
      from public.gym_memberships gm
      where gm.gym_id = p_gym_id
        and gm.user_id = pr.user_id
    )
  ),
  open_queue as (
    select
      count(*)::integer as open_requests,
      count(*) filter (
        where (gr.due_at is not null and gr.due_at < now())
          or gr.sla_breached_at is not null
      )::integer as overdue_requests
    from gym_requests gr
    where public.is_privacy_request_open_status(gr.status)
  ),
  completion_window as (
    select
      count(*) filter (where gr.status = 'fulfilled')::integer as fulfilled_requests_window,
      count(*) filter (where gr.status = 'rejected')::integer as rejected_requests_window,
      avg(extract(epoch from (gr.resolved_at - gr.submitted_at)) / 3600.0)
        filter (
          where gr.status in ('fulfilled', 'rejected')
            and gr.resolved_at is not null
            and gr.resolved_at >= gr.submitted_at
        ) as avg_completion_hours
    from gym_requests gr
    where gr.status in ('fulfilled', 'rejected')
      and gr.submitted_at >= now() - make_interval(days => v_window_days)
  )
  select
    p_gym_id,
    coalesce(oq.open_requests, 0),
    coalesce(oq.overdue_requests, 0),
    round(coalesce(cw.avg_completion_hours, 0)::numeric, 2),
    coalesce(cw.fulfilled_requests_window, 0),
    coalesce(cw.rejected_requests_window, 0),
    v_window_days
  from open_queue oq
  cross join completion_window cw;
end;
$$;

revoke all on function public.admin_get_privacy_ops_metrics(uuid, integer) from public;
grant execute on function public.admin_get_privacy_ops_metrics(uuid, integer) to authenticated;
grant execute on function public.admin_get_privacy_ops_metrics(uuid, integer) to service_role;

insert into public.legal_copy_keys(copy_key, default_text, description)
values
  ('legal.flow.admin.phase8.load_queue_filters', 'Apply queue filters (status/type/SLA/user)', 'Phase 8 admin checklist item'),
  ('legal.flow.admin.phase8.show_sla_badges', 'Render SLA badges (breached/at risk/on track)', 'Phase 8 admin checklist item'),
  ('legal.flow.admin.phase8.load_privacy_metrics', 'Load privacy ops metrics (open, overdue, avg completion)', 'Phase 8 admin checklist item'),
  ('legal.flow.admin.phase8.open_runbook', 'Open compliance runbook mapped to queue actions', 'Phase 8 admin checklist item')
on conflict (copy_key)
do update set
  default_text = excluded.default_text,
  description = excluded.description,
  updated_at = now();

insert into public.legal_copy_translations(copy_key, locale, translated_text)
values
  ('legal.flow.admin.phase8.load_queue_filters', 'it-IT', 'Applica filtri coda (stato/tipo/SLA/utente)'),
  ('legal.flow.admin.phase8.show_sla_badges', 'it-IT', 'Mostra badge SLA (violata/a rischio/in linea)'),
  ('legal.flow.admin.phase8.load_privacy_metrics', 'it-IT', 'Carica metriche privacy ops (aperte/scadute/tempo medio)'),
  ('legal.flow.admin.phase8.open_runbook', 'it-IT', 'Apri runbook compliance collegato alle azioni coda')
on conflict (copy_key, locale)
do update set
  translated_text = excluded.translated_text,
  updated_at = now();
