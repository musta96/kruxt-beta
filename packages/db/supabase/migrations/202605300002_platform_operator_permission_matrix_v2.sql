-- KRUXT platform operator permission matrix v2.
-- Stores the finalized control-plane capability set, role defaults, and an
-- audited RPC for per-operator custom overrides.

insert into public.platform_permission_catalog (permission_key, category, label, description, is_sensitive, metadata)
values
  ('platform.tenants.view', 'tenants', 'View tenants', 'View tenant list and tenant-level summary data.', false, '{"piiPolicy":{"support":"masked","dsar":"masked_until_verified"}}'::jsonb),
  ('platform.tenants.onboard', 'tenants', 'Onboard gym', 'Create a new tenant onboarding record and invite the gym owner.', true, '{"requiresMfa":true}'::jsonb),
  ('platform.tenants.edit_identity_plan', 'tenants', 'Edit tenant identity / plan', 'Edit tenant identity, country, currency, subscription plan, and related tenant configuration.', true, '{"requiresMfa":true}'::jsonb),
  ('platform.tenants.suspend', 'tenants', 'Suspend tenant', 'Suspend a tenant workspace.', true, '{"requiresMfa":true,"guard":"typed_confirm"}'::jsonb),
  ('platform.tenants.offboard', 'tenants', 'Offboard tenant', 'Export and delete tenant data during offboarding.', true, '{"requiresMfa":true,"danger":true,"guard":"two_step_typed_confirm"}'::jsonb),
  ('platform.tenants.impersonate', 'tenants', 'Impersonate / Open Admin', 'Open a tenant gym admin workspace through a logged support session.', true, '{"requiresMfa":true,"scope":{"support":"time_boxed_60m_logged"}}'::jsonb),
  ('platform.tenants.create_staff_invite', 'tenants', 'Create gym-owner/staff profile + invite', 'Create a gym owner or staff profile and send an invite link without setting a password.', true, '{"requiresMfa":true,"scope":{"support":"create_invite_only_no_password_no_operator_access"}}'::jsonb),

  ('platform.operators.view', 'operators', 'View operators', 'View KRUXT internal operator accounts and roles.', false, '{}'::jsonb),
  ('platform.operators.invite_edit', 'operators', 'Invite / edit operators', 'Invite new platform operators and edit operator account status.', true, '{"requiresMfa":true}'::jsonb),
  ('platform.operators.roles_matrix_edit', 'operators', 'Edit roles & permission matrix', 'Edit platform role defaults and permission overrides.', true, '{"requiresMfa":true,"danger":true}'::jsonb),
  ('platform.operators.revoke', 'operators', 'Revoke operator', 'Revoke a KRUXT operator account.', true, '{"requiresMfa":true,"danger":true}'::jsonb),

  ('platform.support.grants.approve', 'governance', 'Approve support-access grants', 'Approve or deny delegated support access grants.', true, '{"requiresMfa":true,"scope":{"support":"self_request_only_cannot_self_approve"}}'::jsonb),
  ('platform.data_releases.approve', 'governance', 'Approve data releases', 'Approve partner or data export releases.', true, '{"requiresMfa":true,"danger":true}'::jsonb),
  ('platform.audit.view', 'governance', 'View Audit Log', 'View governance and platform audit events.', false, '{}'::jsonb),
  ('platform.audit.verify_export', 'governance', 'Verify integrity / export Audit Log', 'Verify audit log chain integrity and export audit records.', true, '{"requiresMfa":true,"scope":{"support":"view_only_no_export"}}'::jsonb),
  ('platform.dsar.view', 'governance', 'Handle DSAR (view)', 'View data subject access request queues and request details.', true, '{"requiresMfa":true,"piiPolicy":{"default":"masked_until_verified","support":"masked_until_verified"}}'::jsonb),
  ('platform.dsar.fulfill', 'governance', 'DSAR fulfill', 'Fulfill DSAR export/erase actions.', true, '{"requiresMfa":true,"scope":{"support":"export_only_no_erase"},"danger":true}'::jsonb),
  ('platform.retention.manage', 'governance', 'Edit retention / anonymization', 'Edit retention and anonymization policy configuration.', true, '{"requiresMfa":true,"danger":true}'::jsonb),
  ('platform.pii.unmask', 'governance', 'Unmask member PII', 'Unmask member personally identifiable information after verification.', true, '{"requiresMfa":true,"piiPolicy":{"default":"logged_unmask","support":"logged_ticket_or_verification_required"}}'::jsonb),

  ('platform.flags.view', 'features', 'View flags', 'View feature flags and entitlement state.', false, '{}'::jsonb),
  ('platform.flags.tenant_override', 'features', 'Toggle per-tenant override/entitlement', 'Toggle tenant-scoped feature overrides and entitlements.', true, '{"requiresMfa":true}'::jsonb),
  ('platform.flags.global_toggle', 'features', 'Toggle global flag', 'Toggle global platform flags.', true, '{"requiresMfa":true,"guard":"typed_confirm_blast_radius","danger":true}'::jsonb),
  ('platform.flags.rollout', 'features', 'Staged rollout %', 'Adjust staged rollout percentages.', true, '{"requiresMfa":true}'::jsonb),
  ('platform.entitlements.templates.manage', 'features', 'Manage plan/entitlement templates', 'Manage global plan and entitlement templates.', true, '{"requiresMfa":true}'::jsonb),

  ('platform.revenue.view', 'revenue', 'View partner/platform revenue', 'View platform revenue and partner revenue summaries.', true, '{"requiresMfa":true,"money":true,"scope":{"support":"no_amounts_tier_plan_only"}}'::jsonb),
  ('platform.revenue.settle', 'revenue', 'Recognize / settle partner revenue', 'Recognize, settle, or adjust partner revenue events.', true, '{"requiresMfa":true,"money":true}'::jsonb),
  ('platform.tenant_billing.retry', 'revenue', 'Tenant billing: retry payment', 'Retry a failed tenant payment.', true, '{"requiresMfa":true,"money":true,"scope":{"support":"retry_only"}}'::jsonb),
  ('platform.tenant_billing.refund_credit', 'revenue', 'Tenant billing: refund / credit', 'Issue tenant refunds or credits.', true, '{"requiresMfa":true,"money":true,"danger":true}'::jsonb),

  ('platform.marketplace.apps.review', 'marketplace', 'Review / approve apps', 'Review and approve marketplace or add-on app submissions.', true, '{"requiresMfa":true}'::jsonb),
  ('platform.marketplace.pricing.manage', 'marketplace', 'Create add-on / set pricing', 'Create add-ons and manage pricing.', true, '{"requiresMfa":true,"money":true}'::jsonb),

  ('platform.webhooks.api_keys.manage', 'system', 'Webhooks / API keys', 'Manage webhooks and API keys.', true, '{"requiresMfa":true,"scope":{"admin":"view_rotate_no_create_delete"}}'::jsonb),
  ('platform.system_health.view', 'system', 'System health / incidents', 'View system health, queues, uptime, and incident history.', false, '{}'::jsonb),

  ('platform.settings.identity_security.edit', 'settings', 'Edit platform identity / security', 'Edit platform identity, authentication, and security settings.', true, '{"requiresMfa":true,"danger":true}'::jsonb),
  ('platform.settings.legal_registry.edit', 'settings', 'Edit Legal & Compliance registry', 'Edit DPA, sub-processor, consent, and legal registry data.', true, '{"requiresMfa":true,"danger":true}'::jsonb),
  ('platform.settings.danger_zone', 'settings', 'Danger Zone', 'Run maintenance or purge operations.', true, '{"requiresMfa":true,"danger":true,"guard":"typed_confirm"}'::jsonb)
on conflict (permission_key) do update
set
  category = excluded.category,
  label = excluded.label,
  description = excluded.description,
  is_sensitive = excluded.is_sensitive,
  metadata = excluded.metadata,
  is_active = true,
  updated_at = now();

insert into public.platform_role_permissions (role, permission_key, is_allowed, metadata)
select v.role, v.permission_key, v.is_allowed, v.metadata
from (
  values
    ('founder'::public.platform_operator_role, 'platform.tenants.view', true, '{}'::jsonb),
    ('founder', 'platform.tenants.onboard', true, '{}'::jsonb),
    ('founder', 'platform.tenants.edit_identity_plan', true, '{}'::jsonb),
    ('founder', 'platform.tenants.suspend', true, '{}'::jsonb),
    ('founder', 'platform.tenants.offboard', true, '{}'::jsonb),
    ('founder', 'platform.tenants.impersonate', true, '{}'::jsonb),
    ('founder', 'platform.tenants.create_staff_invite', true, '{}'::jsonb),
    ('founder', 'platform.operators.view', true, '{}'::jsonb),
    ('founder', 'platform.operators.invite_edit', true, '{}'::jsonb),
    ('founder', 'platform.operators.roles_matrix_edit', true, '{}'::jsonb),
    ('founder', 'platform.operators.revoke', true, '{}'::jsonb),
    ('founder', 'platform.support.grants.approve', true, '{}'::jsonb),
    ('founder', 'platform.data_releases.approve', true, '{}'::jsonb),
    ('founder', 'platform.audit.view', true, '{}'::jsonb),
    ('founder', 'platform.audit.verify_export', true, '{}'::jsonb),
    ('founder', 'platform.dsar.view', true, '{}'::jsonb),
    ('founder', 'platform.dsar.fulfill', true, '{}'::jsonb),
    ('founder', 'platform.retention.manage', true, '{}'::jsonb),
    ('founder', 'platform.pii.unmask', true, '{}'::jsonb),
    ('founder', 'platform.flags.view', true, '{}'::jsonb),
    ('founder', 'platform.flags.tenant_override', true, '{}'::jsonb),
    ('founder', 'platform.flags.global_toggle', true, '{}'::jsonb),
    ('founder', 'platform.flags.rollout', true, '{}'::jsonb),
    ('founder', 'platform.entitlements.templates.manage', true, '{}'::jsonb),
    ('founder', 'platform.revenue.view', true, '{}'::jsonb),
    ('founder', 'platform.revenue.settle', true, '{}'::jsonb),
    ('founder', 'platform.tenant_billing.retry', true, '{}'::jsonb),
    ('founder', 'platform.tenant_billing.refund_credit', true, '{}'::jsonb),
    ('founder', 'platform.marketplace.apps.review', true, '{}'::jsonb),
    ('founder', 'platform.marketplace.pricing.manage', true, '{}'::jsonb),
    ('founder', 'platform.webhooks.api_keys.manage', true, '{}'::jsonb),
    ('founder', 'platform.system_health.view', true, '{}'::jsonb),
    ('founder', 'platform.settings.identity_security.edit', true, '{}'::jsonb),
    ('founder', 'platform.settings.legal_registry.edit', true, '{}'::jsonb),
    ('founder', 'platform.settings.danger_zone', true, '{}'::jsonb),

    ('ops_admin', 'platform.tenants.view', true, '{}'::jsonb),
    ('ops_admin', 'platform.tenants.onboard', true, '{}'::jsonb),
    ('ops_admin', 'platform.tenants.edit_identity_plan', true, '{}'::jsonb),
    ('ops_admin', 'platform.tenants.suspend', true, '{}'::jsonb),
    ('ops_admin', 'platform.tenants.offboard', true, '{"scope":"solo_2_step_typed_confirm_guard"}'::jsonb),
    ('ops_admin', 'platform.tenants.impersonate', true, '{}'::jsonb),
    ('ops_admin', 'platform.tenants.create_staff_invite', true, '{}'::jsonb),
    ('ops_admin', 'platform.operators.view', true, '{}'::jsonb),
    ('ops_admin', 'platform.operators.invite_edit', true, '{}'::jsonb),
    ('ops_admin', 'platform.operators.roles_matrix_edit', false, '{}'::jsonb),
    ('ops_admin', 'platform.operators.revoke', true, '{}'::jsonb),
    ('ops_admin', 'platform.support.grants.approve', true, '{}'::jsonb),
    ('ops_admin', 'platform.data_releases.approve', true, '{}'::jsonb),
    ('ops_admin', 'platform.audit.view', true, '{}'::jsonb),
    ('ops_admin', 'platform.audit.verify_export', true, '{}'::jsonb),
    ('ops_admin', 'platform.dsar.view', true, '{}'::jsonb),
    ('ops_admin', 'platform.dsar.fulfill', true, '{"scope":"export_erase"}'::jsonb),
    ('ops_admin', 'platform.retention.manage', false, '{}'::jsonb),
    ('ops_admin', 'platform.pii.unmask', true, '{"scope":"logged"}'::jsonb),
    ('ops_admin', 'platform.flags.view', true, '{}'::jsonb),
    ('ops_admin', 'platform.flags.tenant_override', true, '{}'::jsonb),
    ('ops_admin', 'platform.flags.global_toggle', true, '{"scope":"typed_confirm_blast_radius_warning"}'::jsonb),
    ('ops_admin', 'platform.flags.rollout', true, '{}'::jsonb),
    ('ops_admin', 'platform.entitlements.templates.manage', true, '{}'::jsonb),
    ('ops_admin', 'platform.revenue.view', true, '{}'::jsonb),
    ('ops_admin', 'platform.revenue.settle', true, '{}'::jsonb),
    ('ops_admin', 'platform.tenant_billing.retry', true, '{}'::jsonb),
    ('ops_admin', 'platform.tenant_billing.refund_credit', true, '{}'::jsonb),
    ('ops_admin', 'platform.marketplace.apps.review', true, '{}'::jsonb),
    ('ops_admin', 'platform.marketplace.pricing.manage', true, '{}'::jsonb),
    ('ops_admin', 'platform.webhooks.api_keys.manage', true, '{"scope":"view_rotate_no_create_delete"}'::jsonb),
    ('ops_admin', 'platform.system_health.view', true, '{}'::jsonb),
    ('ops_admin', 'platform.settings.identity_security.edit', false, '{}'::jsonb),
    ('ops_admin', 'platform.settings.legal_registry.edit', false, '{}'::jsonb),
    ('ops_admin', 'platform.settings.danger_zone', false, '{}'::jsonb),

    ('support_admin', 'platform.tenants.view', true, '{"scope":"pii_masked"}'::jsonb),
    ('support_admin', 'platform.tenants.onboard', false, '{}'::jsonb),
    ('support_admin', 'platform.tenants.edit_identity_plan', false, '{}'::jsonb),
    ('support_admin', 'platform.tenants.suspend', false, '{}'::jsonb),
    ('support_admin', 'platform.tenants.offboard', false, '{}'::jsonb),
    ('support_admin', 'platform.tenants.impersonate', true, '{"scope":"time_boxed_60m_logged"}'::jsonb),
    ('support_admin', 'platform.tenants.create_staff_invite', true, '{"scope":"create_invite_only_no_password_no_operator_access"}'::jsonb),
    ('support_admin', 'platform.operators.view', true, '{}'::jsonb),
    ('support_admin', 'platform.operators.invite_edit', false, '{}'::jsonb),
    ('support_admin', 'platform.operators.roles_matrix_edit', false, '{}'::jsonb),
    ('support_admin', 'platform.operators.revoke', false, '{}'::jsonb),
    ('support_admin', 'platform.support.grants.approve', true, '{"scope":"self_request_only_cannot_self_approve"}'::jsonb),
    ('support_admin', 'platform.data_releases.approve', false, '{}'::jsonb),
    ('support_admin', 'platform.audit.view', true, '{"scope":"view"}'::jsonb),
    ('support_admin', 'platform.audit.verify_export', true, '{"scope":"view_only_no_export"}'::jsonb),
    ('support_admin', 'platform.dsar.view', true, '{"scope":"pii_masked_until_verified"}'::jsonb),
    ('support_admin', 'platform.dsar.fulfill', true, '{"scope":"export_only_no_erase"}'::jsonb),
    ('support_admin', 'platform.retention.manage', false, '{}'::jsonb),
    ('support_admin', 'platform.pii.unmask', true, '{"scope":"logged_ticket_or_verification_required"}'::jsonb),
    ('support_admin', 'platform.flags.view', true, '{}'::jsonb),
    ('support_admin', 'platform.flags.tenant_override', false, '{}'::jsonb),
    ('support_admin', 'platform.flags.global_toggle', false, '{}'::jsonb),
    ('support_admin', 'platform.flags.rollout', false, '{}'::jsonb),
    ('support_admin', 'platform.entitlements.templates.manage', false, '{}'::jsonb),
    ('support_admin', 'platform.revenue.view', true, '{"scope":"no_amounts_tier_plan_only"}'::jsonb),
    ('support_admin', 'platform.revenue.settle', false, '{}'::jsonb),
    ('support_admin', 'platform.tenant_billing.retry', true, '{"scope":"retry_only"}'::jsonb),
    ('support_admin', 'platform.tenant_billing.refund_credit', false, '{}'::jsonb),
    ('support_admin', 'platform.marketplace.apps.review', false, '{}'::jsonb),
    ('support_admin', 'platform.marketplace.pricing.manage', false, '{}'::jsonb),
    ('support_admin', 'platform.webhooks.api_keys.manage', false, '{}'::jsonb),
    ('support_admin', 'platform.system_health.view', true, '{}'::jsonb),
    ('support_admin', 'platform.settings.identity_security.edit', false, '{}'::jsonb),
    ('support_admin', 'platform.settings.legal_registry.edit', false, '{}'::jsonb),
    ('support_admin', 'platform.settings.danger_zone', false, '{}'::jsonb),

    ('read_only', 'platform.tenants.view', true, '{}'::jsonb),
    ('read_only', 'platform.tenants.onboard', false, '{}'::jsonb),
    ('read_only', 'platform.tenants.edit_identity_plan', false, '{}'::jsonb),
    ('read_only', 'platform.tenants.suspend', false, '{}'::jsonb),
    ('read_only', 'platform.tenants.offboard', false, '{}'::jsonb),
    ('read_only', 'platform.tenants.impersonate', false, '{}'::jsonb),
    ('read_only', 'platform.tenants.create_staff_invite', false, '{}'::jsonb),
    ('read_only', 'platform.operators.view', true, '{}'::jsonb),
    ('read_only', 'platform.operators.invite_edit', false, '{}'::jsonb),
    ('read_only', 'platform.operators.roles_matrix_edit', false, '{}'::jsonb),
    ('read_only', 'platform.operators.revoke', false, '{}'::jsonb),
    ('read_only', 'platform.support.grants.approve', false, '{}'::jsonb),
    ('read_only', 'platform.data_releases.approve', false, '{}'::jsonb),
    ('read_only', 'platform.audit.view', true, '{}'::jsonb),
    ('read_only', 'platform.audit.verify_export', false, '{}'::jsonb),
    ('read_only', 'platform.dsar.view', true, '{}'::jsonb),
    ('read_only', 'platform.dsar.fulfill', false, '{}'::jsonb),
    ('read_only', 'platform.retention.manage', false, '{}'::jsonb),
    ('read_only', 'platform.pii.unmask', false, '{}'::jsonb),
    ('read_only', 'platform.flags.view', true, '{}'::jsonb),
    ('read_only', 'platform.flags.tenant_override', false, '{}'::jsonb),
    ('read_only', 'platform.flags.global_toggle', false, '{}'::jsonb),
    ('read_only', 'platform.flags.rollout', false, '{}'::jsonb),
    ('read_only', 'platform.entitlements.templates.manage', false, '{}'::jsonb),
    ('read_only', 'platform.revenue.view', false, '{}'::jsonb),
    ('read_only', 'platform.revenue.settle', false, '{}'::jsonb),
    ('read_only', 'platform.tenant_billing.retry', false, '{}'::jsonb),
    ('read_only', 'platform.tenant_billing.refund_credit', false, '{}'::jsonb),
    ('read_only', 'platform.marketplace.apps.review', false, '{}'::jsonb),
    ('read_only', 'platform.marketplace.pricing.manage', false, '{}'::jsonb),
    ('read_only', 'platform.webhooks.api_keys.manage', false, '{}'::jsonb),
    ('read_only', 'platform.system_health.view', true, '{"scope":"view"}'::jsonb),
    ('read_only', 'platform.settings.identity_security.edit', false, '{}'::jsonb),
    ('read_only', 'platform.settings.legal_registry.edit', false, '{}'::jsonb),
    ('read_only', 'platform.settings.danger_zone', false, '{}'::jsonb)
) as v(role, permission_key, is_allowed, metadata)
on conflict (role, permission_key) do update
set
  is_allowed = excluded.is_allowed,
  metadata = excluded.metadata,
  updated_at = now();

create or replace function public.platform_list_operator_accounts()
returns table (
  user_id uuid,
  email text,
  display_name text,
  username text,
  role public.platform_operator_role,
  is_active boolean,
  mfa_required boolean,
  last_login_at timestamptz,
  created_at timestamptz,
  override_count integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not (
    public.platform_operator_has_permission('platform.operators.view', auth.uid())
    or public.platform_operator_has_permission('platform.operators.manage', auth.uid())
  ) then
    raise exception 'Platform operator view access is required';
  end if;

  return query
  select
    poa.user_id,
    au.email::text,
    p.display_name,
    p.username,
    poa.role,
    poa.is_active,
    poa.mfa_required,
    poa.last_login_at,
    poa.created_at,
    coalesce(count(ppo.id), 0)::integer as override_count
  from public.platform_operator_accounts poa
  join public.profiles p on p.id = poa.user_id
  left join auth.users au on au.id = poa.user_id
  left join public.platform_operator_permission_overrides ppo on ppo.user_id = poa.user_id
  group by poa.user_id, au.email, p.display_name, p.username, poa.role, poa.is_active, poa.mfa_required, poa.last_login_at, poa.created_at
  order by
    case poa.role
      when 'founder' then 0
      when 'ops_admin' then 1
      when 'support_admin' then 2
      when 'compliance_admin' then 3
      when 'analyst' then 4
      else 5
    end,
    p.display_name;
end;
$$;

create or replace function public.platform_set_operator_permission_override(
  p_user_id uuid,
  p_permission_key text,
  p_is_allowed boolean,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_target_role public.platform_operator_role;
  v_target_is_active boolean;
  v_permission_key text := lower(trim(coalesce(p_permission_key, '')));
  v_previous_override boolean;
  v_role_default boolean;
begin
  if v_actor_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.platform_operator_has_permission('platform.operators.roles_matrix_edit', v_actor_user_id) then
    raise exception 'Permission matrix edit access is required';
  end if;

  select poa.role, poa.is_active
  into v_target_role, v_target_is_active
  from public.platform_operator_accounts poa
  where poa.user_id = p_user_id;

  if v_target_role is null then
    raise exception 'Operator account not found';
  end if;

  if v_target_role = 'founder' then
    raise exception 'Founder permissions are non-editable';
  end if;

  if not exists (
    select 1 from public.platform_permission_catalog ppc
    where ppc.permission_key = v_permission_key
      and ppc.is_active = true
  ) then
    raise exception 'Permission key not found';
  end if;

  select ppo.is_allowed
  into v_previous_override
  from public.platform_operator_permission_overrides ppo
  where ppo.user_id = p_user_id
    and ppo.permission_key = v_permission_key;

  select prp.is_allowed
  into v_role_default
  from public.platform_role_permissions prp
  where prp.role = v_target_role
    and prp.permission_key = v_permission_key;

  insert into public.platform_operator_permission_overrides (
    user_id,
    permission_key,
    is_allowed,
    reason,
    updated_by,
    metadata
  )
  values (
    p_user_id,
    v_permission_key,
    p_is_allowed,
    nullif(trim(coalesce(p_reason, '')), ''),
    v_actor_user_id,
    jsonb_build_object('source', 'operators_permission_matrix_v2')
  )
  on conflict (user_id, permission_key) do update
    set is_allowed = excluded.is_allowed,
        reason = excluded.reason,
        updated_by = excluded.updated_by,
        metadata = public.platform_operator_permission_overrides.metadata || excluded.metadata,
        updated_at = now();

  perform public.append_audit_log(
    'platform.operator.permission_override.changed',
    'platform_operator_permission_overrides',
    p_user_id,
    nullif(trim(coalesce(p_reason, '')), ''),
    jsonb_build_object(
      'permissionKey', v_permission_key,
      'targetUserId', p_user_id,
      'targetRole', v_target_role,
      'targetWasActive', v_target_is_active,
      'roleDefault', coalesce(v_role_default, false),
      'previousOverride', v_previous_override,
      'nextOverride', p_is_allowed,
      'source', 'operators_permission_matrix_v2'
    )
  );

  return jsonb_build_object(
    'userId', p_user_id,
    'permissionKey', v_permission_key,
    'isAllowed', p_is_allowed
  );
end;
$$;

create or replace function public.platform_clear_operator_permission_override(
  p_user_id uuid,
  p_permission_key text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_target_role public.platform_operator_role;
  v_permission_key text := lower(trim(coalesce(p_permission_key, '')));
  v_previous_override boolean;
begin
  if v_actor_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.platform_operator_has_permission('platform.operators.roles_matrix_edit', v_actor_user_id) then
    raise exception 'Permission matrix edit access is required';
  end if;

  select poa.role
  into v_target_role
  from public.platform_operator_accounts poa
  where poa.user_id = p_user_id;

  if v_target_role is null then
    raise exception 'Operator account not found';
  end if;

  if v_target_role = 'founder' then
    raise exception 'Founder permissions are non-editable';
  end if;

  select ppo.is_allowed
  into v_previous_override
  from public.platform_operator_permission_overrides ppo
  where ppo.user_id = p_user_id
    and ppo.permission_key = v_permission_key;

  delete from public.platform_operator_permission_overrides
  where user_id = p_user_id
    and permission_key = v_permission_key;

  perform public.append_audit_log(
    'platform.operator.permission_override.cleared',
    'platform_operator_permission_overrides',
    p_user_id,
    nullif(trim(coalesce(p_reason, '')), ''),
    jsonb_build_object(
      'permissionKey', v_permission_key,
      'targetUserId', p_user_id,
      'targetRole', v_target_role,
      'previousOverride', v_previous_override,
      'source', 'operators_permission_matrix_v2'
    )
  );

  return jsonb_build_object(
    'userId', p_user_id,
    'permissionKey', v_permission_key,
    'cleared', true
  );
end;
$$;

revoke all on function public.platform_list_operator_accounts() from public;
grant execute on function public.platform_list_operator_accounts() to authenticated;

revoke all on function public.platform_set_operator_permission_override(uuid, text, boolean, text) from public;
grant execute on function public.platform_set_operator_permission_override(uuid, text, boolean, text) to authenticated;

revoke all on function public.platform_clear_operator_permission_override(uuid, text, text) from public;
grant execute on function public.platform_clear_operator_permission_override(uuid, text, text) to authenticated;
