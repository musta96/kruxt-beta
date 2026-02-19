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
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.privacy_requests(user_id, request_type, reason)
  values (auth.uid(), p_request_type, p_reason)
  returning id into v_id;

  perform public.append_audit_log(
    'privacy.request_submitted',
    'privacy_requests',
    v_id,
    'User submitted privacy request',
    jsonb_build_object('request_type', p_request_type)
  );

  return v_id;
end;
$$;
