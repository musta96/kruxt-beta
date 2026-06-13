-- Audited member access mutations for the gym Members console.
-- Sensitive role/status changes must pass through the RPC below.

create schema if not exists kruxt_private;
revoke all on schema kruxt_private from public;
grant usage on schema kruxt_private to authenticated, service_role;

create or replace function kruxt_private.membership_access_fields_unchanged(
  p_membership_id uuid,
  p_role public.gym_role,
  p_membership_status public.membership_status
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.gym_memberships gm
    where gm.id = p_membership_id
      and gm.role = p_role
      and gm.membership_status = p_membership_status
  );
$$;

drop trigger if exists trg_gym_memberships_audited_access_mutation on public.gym_memberships;
drop function if exists public.enforce_audited_membership_access_mutation();

revoke all on function kruxt_private.membership_access_fields_unchanged(
  uuid,
  public.gym_role,
  public.membership_status
) from public, anon;

grant execute on function kruxt_private.membership_access_fields_unchanged(
  uuid,
  public.gym_role,
  public.membership_status
) to authenticated, service_role;

drop policy if exists gym_memberships_update_self_or_staff on public.gym_memberships;
create policy gym_memberships_update_self_or_staff
on public.gym_memberships
for update
to authenticated
using (
  user_id = auth.uid()
  or public.is_gym_staff(gym_id, auth.uid())
)
with check (
  (
    user_id = auth.uid()
    or public.is_gym_staff(gym_id, auth.uid())
  )
  and kruxt_private.membership_access_fields_unchanged(
    id,
    role,
    membership_status
  )
);

create or replace function public.bulk_update_gym_memberships(
  p_gym_id uuid,
  p_membership_ids uuid[],
  p_membership_status public.membership_status default null,
  p_role public.gym_role default null,
  p_reason text default null
)
returns table (
  operation_id uuid,
  membership_id uuid,
  user_id uuid,
  success boolean,
  result text,
  error_code text,
  error_message text,
  previous_role public.gym_role,
  new_role public.gym_role,
  previous_status public.membership_status,
  new_status public.membership_status,
  audit_log_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_operation_id uuid := gen_random_uuid();
  v_target_id uuid;
  v_membership public.gym_memberships%rowtype;
  v_gym_owner_user_id uuid;
  v_next_role public.gym_role;
  v_next_status public.membership_status;
  v_can_manage_members boolean;
  v_can_manage_roles boolean;
  v_changed boolean;
  v_error_code text;
  v_error_message text;
  v_audit_id uuid;
begin
  if p_gym_id is null then
    raise exception 'gym id is required';
  end if;

  if coalesce(array_length(p_membership_ids, 1), 0) = 0 then
    raise exception 'at least one membership id is required';
  end if;

  if array_length(p_membership_ids, 1) > 100 then
    raise exception 'bulk member mutations are limited to 100 memberships';
  end if;

  if p_membership_status is null and p_role is null then
    raise exception 'membership status or role is required';
  end if;

  if length(trim(coalesce(p_reason, ''))) < 8 then
    raise exception 'an audit reason of at least 8 characters is required';
  end if;

  select g.owner_user_id
  into v_gym_owner_user_id
  from public.gyms g
  where g.id = p_gym_id;

  if not found then
    raise exception 'gym not found';
  end if;

  v_can_manage_members :=
    public.is_service_role()
    or public.user_has_gym_permission(p_gym_id, 'admin.members.manage', v_actor)
    or public.platform_operator_has_permission('platform.gyms.manage', v_actor);

  v_can_manage_roles :=
    public.is_service_role()
    or public.gym_is_owner(p_gym_id, v_actor)
    or public.platform_operator_has_permission('platform.gyms.manage', v_actor);

  if p_membership_status is not null and not v_can_manage_members then
    raise exception 'not allowed to update member access'
      using errcode = '42501';
  end if;

  if p_role is not null and not v_can_manage_roles then
    raise exception 'only a gym owner or authorized platform operator may change roles'
      using errcode = '42501';
  end if;

  for v_target_id in
    select distinct requested_id
    from unnest(p_membership_ids) as requested(requested_id)
    order by requested_id
  loop
    operation_id := v_operation_id;
    membership_id := v_target_id;
    user_id := null;
    success := false;
    result := 'failed';
    error_code := null;
    error_message := null;
    previous_role := null;
    new_role := null;
    previous_status := null;
    new_status := null;
    audit_log_id := null;
    v_membership := null;
    v_error_code := null;
    v_error_message := null;
    v_audit_id := null;

    begin
      if v_target_id is null then
        v_error_code := 'INVALID_MEMBERSHIP_ID';
        raise exception 'membership id cannot be null';
      end if;

      select gm.*
      into v_membership
      from public.gym_memberships gm
      where gm.id = v_target_id
        and gm.gym_id = p_gym_id
      for update;

      if not found then
        v_error_code := 'MEMBERSHIP_NOT_FOUND';
        raise exception 'membership not found for this gym';
      end if;

      user_id := v_membership.user_id;
      previous_role := v_membership.role;
      previous_status := v_membership.membership_status;
      v_next_role := coalesce(p_role, v_membership.role);
      v_next_status := coalesce(p_membership_status, v_membership.membership_status);
      new_role := v_next_role;
      new_status := v_next_status;

      if v_membership.role = 'leader'
        and not v_can_manage_roles
        and v_next_status is distinct from v_membership.membership_status
      then
        v_error_code := 'OWNER_ACCESS_PROTECTED';
        raise exception 'officers cannot change an owner membership';
      end if;

      if v_membership.user_id = v_gym_owner_user_id
        and (
          v_next_role <> 'leader'
          or v_next_status not in ('trial', 'active')
        )
      then
        v_error_code := 'GYM_OWNER_PROTECTED';
        raise exception 'the gym owner must retain an active owner membership';
      end if;

      if v_membership.role = 'leader'
        and v_membership.membership_status in ('trial', 'active')
        and (
          v_next_role <> 'leader'
          or v_next_status not in ('trial', 'active')
        )
        and not exists (
          select 1
          from public.gym_memberships other
          where other.gym_id = p_gym_id
            and other.id <> v_membership.id
            and other.role = 'leader'
            and other.membership_status in ('trial', 'active')
        )
      then
        v_error_code := 'LAST_ACTIVE_OWNER';
        raise exception 'the gym must retain at least one active owner';
      end if;

      v_changed :=
        v_next_role is distinct from v_membership.role
        or v_next_status is distinct from v_membership.membership_status;

      update public.gym_memberships gm
      set
        role = v_next_role,
        membership_status = v_next_status,
        updated_at = case when v_changed then now() else gm.updated_at end
      where gm.id = v_membership.id;

      result := case when v_changed then 'updated' else 'noop' end;
      success := true;

      v_audit_id := public.append_audit_log(
        'gym.member.access.updated',
        'gym_memberships',
        v_membership.id,
        trim(p_reason),
        jsonb_build_object(
          'gymId', p_gym_id,
          'memberUserId', v_membership.user_id,
          'operationId', v_operation_id,
          'result', result,
          'before', jsonb_build_object(
            'role', v_membership.role,
            'membershipStatus', v_membership.membership_status
          ),
          'after', jsonb_build_object(
            'role', v_next_role,
            'membershipStatus', v_next_status
          )
        )
      );

      audit_log_id := v_audit_id;
      return next;
    exception
      when others then
        get stacked diagnostics v_error_message = message_text;
        error_code := coalesce(v_error_code, sqlstate);
        error_message := v_error_message;
        success := false;
        result := 'failed';

        if v_membership.id is not null then
          user_id := v_membership.user_id;
          previous_role := v_membership.role;
          previous_status := v_membership.membership_status;
          new_role := coalesce(p_role, v_membership.role);
          new_status := coalesce(p_membership_status, v_membership.membership_status);

          v_audit_id := public.append_audit_log(
            'gym.member.access.update_failed',
            'gym_memberships',
            v_membership.id,
            trim(p_reason),
            jsonb_build_object(
              'gymId', p_gym_id,
              'memberUserId', v_membership.user_id,
              'operationId', v_operation_id,
              'result', 'failed',
              'errorCode', error_code,
              'errorMessage', error_message,
              'before', jsonb_build_object(
                'role', v_membership.role,
                'membershipStatus', v_membership.membership_status
              ),
              'requested', jsonb_build_object(
                'role', p_role,
                'membershipStatus', p_membership_status
              )
            )
          );

          audit_log_id := v_audit_id;
        end if;

        return next;
    end;
  end loop;
end;
$$;

revoke all on function public.bulk_update_gym_memberships(
  uuid,
  uuid[],
  public.membership_status,
  public.gym_role,
  text
) from public, anon;

grant execute on function public.bulk_update_gym_memberships(
  uuid,
  uuid[],
  public.membership_status,
  public.gym_role,
  text
) to authenticated;

grant execute on function public.bulk_update_gym_memberships(
  uuid,
  uuid[],
  public.membership_status,
  public.gym_role,
  text
) to service_role;
