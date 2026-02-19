create or replace function public.record_waiver_acceptance(
  p_waiver_id uuid,
  p_membership_id uuid default null,
  p_signature_data jsonb default '{}'::jsonb
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

  if not exists (
    select 1
    from public.waivers w
    where w.id = p_waiver_id
      and w.is_active = true
  ) then
    raise exception 'Waiver is not active';
  end if;

  insert into public.waiver_acceptances(
    waiver_id,
    user_id,
    gym_membership_id,
    source,
    locale,
    signature_data
  )
  values (
    p_waiver_id,
    auth.uid(),
    p_membership_id,
    'mobile',
    coalesce((auth.jwt()->>'locale'), 'en'),
    p_signature_data
  )
  on conflict (waiver_id, user_id)
  do update
    set accepted_at = now(),
        signature_data = excluded.signature_data
  returning id into v_id;

  perform public.append_audit_log(
    'waiver.accepted',
    'waiver_acceptances',
    v_id,
    'User accepted waiver',
    jsonb_build_object('waiver_id', p_waiver_id)
  );

  return v_id;
end;
$$;
