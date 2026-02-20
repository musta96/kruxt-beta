create extension if not exists pgcrypto with schema extensions;

alter table public.audit_logs
  add column if not exists integrity_seq bigint,
  add column if not exists prev_entry_hash text,
  add column if not exists entry_hash text,
  add column if not exists integrity_version smallint not null default 1;

create index if not exists idx_audit_logs_action_time
  on public.audit_logs(action, created_at desc);

create unique index if not exists idx_audit_logs_integrity_seq
  on public.audit_logs(integrity_seq)
  where integrity_seq is not null;

create index if not exists idx_audit_logs_security_event_outbox
  on public.audit_logs((metadata->>'event_outbox_id'))
  where action = 'security.event_outbox';

create or replace function public.audit_log_compute_hash(
  p_integrity_seq bigint,
  p_prev_entry_hash text,
  p_actor_user_id uuid,
  p_actor_role text,
  p_action text,
  p_target_table text,
  p_target_id uuid,
  p_reason text,
  p_ip_address text,
  p_user_agent text,
  p_metadata jsonb,
  p_created_at timestamptz
)
returns text
language sql
immutable
set search_path = public
as $$
  select encode(
    extensions.digest(
      concat_ws(
        '|',
        coalesce(p_integrity_seq::text, ''),
        coalesce(p_prev_entry_hash, ''),
        coalesce(p_actor_user_id::text, ''),
        coalesce(p_actor_role, ''),
        coalesce(p_action, ''),
        coalesce(p_target_table, ''),
        coalesce(p_target_id::text, ''),
        coalesce(p_reason, ''),
        coalesce(p_ip_address, ''),
        coalesce(p_user_agent, ''),
        coalesce(p_metadata::text, '{}'::text),
        coalesce(to_char(p_created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), '')
      ),
      'sha256'
    ),
    'hex'
  );
$$;

create or replace function public.assign_audit_log_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev record;
begin
  new.created_at := coalesce(new.created_at, now());
  new.metadata := coalesce(new.metadata, '{}'::jsonb);

  perform pg_advisory_xact_lock(884211, 16);

  select
    a.integrity_seq,
    a.entry_hash
  into v_prev
  from public.audit_logs a
  order by a.integrity_seq desc nulls last
  limit 1;

  new.integrity_seq := coalesce(v_prev.integrity_seq, 0) + 1;
  new.prev_entry_hash := v_prev.entry_hash;
  new.entry_hash := public.audit_log_compute_hash(
    new.integrity_seq,
    new.prev_entry_hash,
    new.actor_user_id,
    new.actor_role,
    new.action,
    new.target_table,
    new.target_id,
    new.reason,
    new.ip_address,
    new.user_agent,
    new.metadata,
    new.created_at
  );

  return new;
end;
$$;

create or replace function public.is_security_relevant_event_type(
  p_event_type text
)
returns boolean
language sql
immutable
as $$
  select
    p_event_type like 'privacy.%'
    or p_event_type like 'consent.%'
    or p_event_type like 'policy.%'
    or p_event_type in (
      'integration.sync_failed',
      'membership.status_changed'
    );
$$;

create or replace function public.audit_security_event_outbox_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload_checksum text;
begin
  if not public.is_security_relevant_event_type(new.event_type) then
    return new;
  end if;

  if exists (
    select 1
    from public.audit_logs a
    where a.action = 'security.event_outbox'
      and a.metadata->>'event_outbox_id' = new.id::text
  ) then
    return new;
  end if;

  v_payload_checksum := encode(extensions.digest(coalesce(new.payload::text, '{}'::text), 'sha256'), 'hex');

  perform public.append_audit_log(
    'security.event_outbox',
    'event_outbox',
    new.id,
    'Security-relevant domain event captured',
    jsonb_build_object(
      'event_outbox_id', new.id,
      'event_type', new.event_type,
      'aggregate_type', new.aggregate_type,
      'aggregate_id', new.aggregate_id,
      'payload_checksum', v_payload_checksum,
      'published', new.published,
      'created_at', new.created_at
    )
  );

  return new;
end;
$$;

create or replace function public.audit_log_integrity_drift(
  p_limit integer default 200
)
returns table (
  integrity_seq bigint,
  audit_log_id uuid,
  issue text,
  expected text,
  actual text
)
language sql
security definer
set search_path = public
as $$
  with ordered as (
    select
      a.id,
      a.integrity_seq,
      a.prev_entry_hash,
      a.entry_hash,
      lag(a.entry_hash) over (order by a.integrity_seq asc) as expected_prev_entry_hash,
      lag(a.integrity_seq) over (order by a.integrity_seq asc) as previous_integrity_seq,
      public.audit_log_compute_hash(
        a.integrity_seq,
        a.prev_entry_hash,
        a.actor_user_id,
        a.actor_role,
        a.action,
        a.target_table,
        a.target_id,
        a.reason,
        a.ip_address,
        a.user_agent,
        a.metadata,
        a.created_at
      ) as expected_entry_hash
    from public.audit_logs a
    where a.integrity_seq is not null
      and a.entry_hash is not null
  ),
  expanded as (
    select
      o.integrity_seq,
      o.id as audit_log_id,
      case
        when o.previous_integrity_seq is not null and o.integrity_seq <> o.previous_integrity_seq + 1
          then 'sequence_gap'
        when o.expected_prev_entry_hash is distinct from o.prev_entry_hash
          then 'previous_hash_mismatch'
        when o.expected_entry_hash is distinct from o.entry_hash
          then 'entry_hash_mismatch'
        else null
      end as issue,
      case
        when o.previous_integrity_seq is not null and o.integrity_seq <> o.previous_integrity_seq + 1
          then (o.previous_integrity_seq + 1)::text
        when o.expected_prev_entry_hash is distinct from o.prev_entry_hash
          then coalesce(o.expected_prev_entry_hash, '<null>')
        when o.expected_entry_hash is distinct from o.entry_hash
          then coalesce(o.expected_entry_hash, '<null>')
        else null
      end as expected,
      case
        when o.previous_integrity_seq is not null and o.integrity_seq <> o.previous_integrity_seq + 1
          then o.integrity_seq::text
        when o.expected_prev_entry_hash is distinct from o.prev_entry_hash
          then coalesce(o.prev_entry_hash, '<null>')
        when o.expected_entry_hash is distinct from o.entry_hash
          then coalesce(o.entry_hash, '<null>')
        else null
      end as actual
    from ordered o
  )
  select
    e.integrity_seq,
    e.audit_log_id,
    e.issue,
    e.expected,
    e.actual
  from expanded e
  where e.issue is not null
  order by e.integrity_seq asc
  limit greatest(1, least(coalesce(p_limit, 200), 5000));
$$;

create or replace function public.audit_log_integrity_summary(
  p_limit integer default 200
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 200), 5000));
  v_drift_count integer := 0;
  v_first_drift jsonb := null;
begin
  select count(*)
  into v_drift_count
  from public.audit_log_integrity_drift(v_limit);

  select to_jsonb(d)
  into v_first_drift
  from public.audit_log_integrity_drift(v_limit) d
  order by d.integrity_seq asc
  limit 1;

  return jsonb_build_object(
    'checked_rows', v_limit,
    'drift_count', v_drift_count,
    'healthy', v_drift_count = 0,
    'first_drift', v_first_drift
  );
end;
$$;

drop trigger if exists trg_audit_logs_assign_integrity on public.audit_logs;
drop trigger if exists trg_audit_logs_no_update on public.audit_logs;
drop trigger if exists trg_audit_logs_immutable on public.audit_logs;

-- Backfill integrity chain for existing rows.
do $$
declare
  v_prev_hash text := null;
  v_seq bigint := 0;
  v_row record;
begin
  perform pg_advisory_xact_lock(884211, 16);

  for v_row in
    select
      a.id,
      a.actor_user_id,
      a.actor_role,
      a.action,
      a.target_table,
      a.target_id,
      a.reason,
      a.ip_address,
      a.user_agent,
      a.metadata,
      a.created_at
    from public.audit_logs a
    order by a.created_at asc, a.id asc
  loop
    v_seq := v_seq + 1;

    update public.audit_logs a
    set
      integrity_seq = v_seq,
      prev_entry_hash = v_prev_hash,
      entry_hash = public.audit_log_compute_hash(
        v_seq,
        v_prev_hash,
        v_row.actor_user_id,
        v_row.actor_role,
        v_row.action,
        v_row.target_table,
        v_row.target_id,
        v_row.reason,
        v_row.ip_address,
        v_row.user_agent,
        coalesce(v_row.metadata, '{}'::jsonb),
        v_row.created_at
      ),
      integrity_version = 1
    where a.id = v_row.id;

    select a.entry_hash
    into v_prev_hash
    from public.audit_logs a
    where a.id = v_row.id;
  end loop;
end;
$$;

alter table public.audit_logs
  alter column integrity_seq set not null,
  alter column entry_hash set not null;

create trigger trg_audit_logs_assign_integrity
before insert on public.audit_logs
for each row execute function public.assign_audit_log_integrity();

create trigger trg_audit_logs_immutable
before update or delete on public.audit_logs
for each row execute function public.reject_mutation_immutable_table();

drop trigger if exists trg_event_outbox_audit_security_event on public.event_outbox;
create trigger trg_event_outbox_audit_security_event
after insert on public.event_outbox
for each row execute function public.audit_security_event_outbox_insert();

drop policy if exists audit_logs_insert_service_or_staff on public.audit_logs;
create policy audit_logs_insert_service_only
on public.audit_logs for insert to authenticated
with check (public.is_service_role());

revoke all on function public.audit_log_compute_hash(
  bigint,
  text,
  uuid,
  text,
  text,
  text,
  uuid,
  text,
  text,
  text,
  jsonb,
  timestamptz
) from public;
grant execute on function public.audit_log_compute_hash(
  bigint,
  text,
  uuid,
  text,
  text,
  text,
  uuid,
  text,
  text,
  text,
  jsonb,
  timestamptz
) to service_role;

revoke all on function public.is_security_relevant_event_type(text) from public;
grant execute on function public.is_security_relevant_event_type(text) to authenticated;
grant execute on function public.is_security_relevant_event_type(text) to service_role;

revoke all on function public.audit_log_integrity_drift(integer) from public;
grant execute on function public.audit_log_integrity_drift(integer) to authenticated;
grant execute on function public.audit_log_integrity_drift(integer) to service_role;

revoke all on function public.audit_log_integrity_summary(integer) from public;
grant execute on function public.audit_log_integrity_summary(integer) to authenticated;
grant execute on function public.audit_log_integrity_summary(integer) to service_role;
