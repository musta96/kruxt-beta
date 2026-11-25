-- Privacy state is worker-owned; clients retain only the submission RPC and reads.
set lock_timeout = '5s';

revoke all on function public.transition_privacy_request_status(uuid, public.privacy_request_status, text)
  from public, anon, authenticated;
grant execute on function public.transition_privacy_request_status(uuid, public.privacy_request_status, text)
  to service_role;
revoke insert, update, delete, truncate, references, trigger on public.privacy_requests
  from public, anon, authenticated;

do $$
declare v_columns text;
begin
  select string_agg(quote_ident(attname), ', ' order by attnum) into v_columns
  from pg_attribute
  where attrelid = 'public.privacy_requests'::regclass and attnum > 0 and not attisdropped;
  execute format(
    'revoke insert (%s), update (%s) on public.privacy_requests from public, anon, authenticated',
    v_columns, v_columns);
end;
$$;

create or replace function public.guard_privacy_request_state()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_service_role() then return new; end if;
  if tg_op = 'UPDATE' then
    raise exception 'Privacy request processing is worker-only' using errcode = '42501';
  end if;
  if auth.uid() is null
    or new.user_id is distinct from auth.uid()
    or new.status is distinct from 'submitted'::public.privacy_request_status
    or new.resolved_at is not null
    or new.handled_by is not null
    or new.response_location is not null
    or new.response_expires_at is not null
    or new.response_content_type is not null
    or new.response_bytes is not null
    or new.triaged_at is not null
    or new.in_progress_at is not null
    or new.sla_breached_at is not null
    or new.notes is not null then
    raise exception 'Privacy requests must use authenticated intake with server-owned state'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_privacy_request_state() from public, anon, authenticated;
drop trigger if exists trg_guard_privacy_request_state on public.privacy_requests;
create trigger trg_guard_privacy_request_state
before insert or update on public.privacy_requests
for each row execute function public.guard_privacy_request_state();

