create or replace function public.is_privacy_request_open_status(
  _status public.privacy_request_status
)
returns boolean
language sql
immutable
as $$
  select _status in ('submitted', 'triaged', 'in_progress', 'in_review');
$$;

update public.privacy_requests
set status = 'fulfilled'
where status = 'completed';

update public.privacy_requests
set status = 'triaged',
    triaged_at = coalesce(triaged_at, updated_at, submitted_at, now())
where status = 'in_review';

update public.privacy_requests
set resolved_at = coalesce(resolved_at, updated_at, now())
where status in ('fulfilled', 'rejected')
  and resolved_at is null;

create or replace function public.submit_privacy_request(
  p_request_type public.privacy_request_type,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_due_at timestamptz := now() + interval '30 days';
  v_reason text := nullif(btrim(p_reason), '');
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if exists (
    select 1
    from public.privacy_requests pr
    where pr.user_id = auth.uid()
      and pr.request_type = p_request_type
      and public.is_privacy_request_open_status(pr.status)
  ) then
    raise exception 'An open % request already exists', p_request_type;
  end if;

  insert into public.privacy_requests(user_id, request_type, reason, due_at)
  values (auth.uid(), p_request_type, v_reason, v_due_at)
  returning id into v_id;

  insert into public.event_outbox(event_type, aggregate_type, aggregate_id, payload)
  values (
    'privacy.request_submitted',
    'privacy_request',
    v_id,
    jsonb_build_object(
      'request_id', v_id,
      'user_id', auth.uid(),
      'request_type', p_request_type,
      'due_at', v_due_at
    )
  );

  perform public.append_audit_log(
    'privacy.request_submitted',
    'privacy_requests',
    v_id,
    'User submitted privacy request',
    jsonb_build_object(
      'request_type', p_request_type,
      'due_at', v_due_at
    )
  );

  return v_id;
end;
$$;
