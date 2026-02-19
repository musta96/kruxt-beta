create or replace function public.admin_record_contract_acceptance(
  p_contract_id uuid,
  p_user_id uuid,
  p_membership_id uuid default null,
  p_signature_data jsonb default '{}'::jsonb,
  p_source text default 'admin'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_gym_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select c.gym_id
  into v_gym_id
  from public.contracts c
  where c.id = p_contract_id
    and c.is_active = true;

  if v_gym_id is null then
    raise exception 'Contract is not active';
  end if;

  if not public.is_gym_staff(v_gym_id, auth.uid()) then
    raise exception 'Gym staff access is required';
  end if;

  if not exists (
    select 1
    from public.gym_memberships gm
    where gm.gym_id = v_gym_id
      and gm.user_id = p_user_id
  ) then
    raise exception 'Target user is not a member of this gym';
  end if;

  if p_membership_id is not null and not exists (
    select 1
    from public.gym_memberships gm
    where gm.id = p_membership_id
      and gm.gym_id = v_gym_id
      and gm.user_id = p_user_id
  ) then
    raise exception 'Membership id does not match target user and gym';
  end if;

  insert into public.contract_acceptances(
    contract_id,
    user_id,
    gym_membership_id,
    accepted_at,
    source,
    locale,
    signature_data
  )
  values (
    p_contract_id,
    p_user_id,
    p_membership_id,
    now(),
    coalesce(nullif(p_source, ''), 'admin'),
    coalesce((auth.jwt() ->> 'locale'), 'en'),
    coalesce(p_signature_data, '{}'::jsonb)
  )
  on conflict (contract_id, user_id)
  do update
    set accepted_at = now(),
        source = excluded.source,
        signature_data = excluded.signature_data
  returning id into v_id;

  perform public.append_audit_log(
    'contract.accepted_admin',
    'contract_acceptances',
    v_id,
    'Staff recorded contract acceptance',
    jsonb_build_object('contract_id', p_contract_id, 'user_id', p_user_id)
  );

  return v_id;
end;
$$;
