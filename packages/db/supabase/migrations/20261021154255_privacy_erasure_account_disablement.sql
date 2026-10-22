begin;

alter function public.apply_user_anonymization(uuid, uuid)
  rename to apply_user_anonymization_legacy;
revoke all on function public.apply_user_anonymization_legacy(uuid, uuid)
  from public, anon, authenticated, service_role;

create function public.apply_user_anonymization(
  p_user_id uuid,
  p_privacy_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_summary jsonb;
begin
  if not public.is_service_role() then
    raise exception using errcode = '42501', message = 'Service role required';
  end if;
  if public.has_active_legal_hold(p_user_id) then
    raise exception 'Cannot anonymize user with an active legal hold';
  end if;
  v_summary := public.apply_user_anonymization_legacy(p_user_id, p_privacy_request_id);
  update public.profiles
  set activation_status = 'disabled', activation_status_updated_at = now(), activated_at = null
  where id = p_user_id;
  return v_summary || jsonb_build_object('profile_disabled', true);
end;
$$;

revoke all on function public.apply_user_anonymization(uuid, uuid) from public, anon, authenticated;
grant execute on function public.apply_user_anonymization(uuid, uuid) to service_role;

commit;
