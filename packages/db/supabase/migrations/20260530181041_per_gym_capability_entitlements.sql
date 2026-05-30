-- Per-gym capability entitlements.
-- Resolution order: tenant override > plan/template > global default.

create table if not exists public.platform_capability_catalog (
  capability_key text primary key check (capability_key ~ '^[a-z0-9_]+$'),
  category text not null check (category in ('billing', 'operations', 'growth', 'compliance', 'limits')),
  sort_order integer not null default 0,
  label text not null,
  description text not null,
  value_type text not null check (value_type in ('boolean', 'limit')),
  global_bool_default boolean,
  global_limit_default integer check (global_limit_default is null or global_limit_default >= 0),
  is_billing_sensitive boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (value_type = 'boolean' and global_bool_default is not null and global_limit_default is null)
    or (value_type = 'limit' and global_bool_default is null and global_limit_default is not null)
  )
);

create table if not exists public.platform_entitlement_templates (
  template_key text primary key check (template_key ~ '^[a-z0-9_]+$'),
  name text not null,
  description text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_entitlement_template_capabilities (
  template_key text not null references public.platform_entitlement_templates(template_key) on delete cascade,
  capability_key text not null references public.platform_capability_catalog(capability_key) on delete cascade,
  bool_value boolean,
  limit_value integer check (limit_value is null or limit_value >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (template_key, capability_key),
  check (
    (bool_value is not null and limit_value is null)
    or (bool_value is null and limit_value is not null)
  )
);

create table if not exists public.gym_entitlement_template_assignments (
  gym_id uuid primary key references public.gyms(id) on delete cascade,
  template_key text not null references public.platform_entitlement_templates(template_key) on delete restrict,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gym_capability_overrides (
  gym_id uuid not null references public.gyms(id) on delete cascade,
  capability_key text not null references public.platform_capability_catalog(capability_key) on delete cascade,
  bool_value boolean,
  limit_value integer check (limit_value is null or limit_value >= 0),
  reason text,
  updated_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (gym_id, capability_key),
  check (
    (bool_value is not null and limit_value is null)
    or (bool_value is null and limit_value is not null)
  )
);

alter table public.platform_plans
  add column if not exists entitlement_template_key text;

do $$
begin
  alter table public.platform_plans
    add constraint platform_plans_entitlement_template_key_fkey
    foreign key (entitlement_template_key)
    references public.platform_entitlement_templates(template_key)
    on delete set null;
exception
  when duplicate_object then null;
end $$;

create index if not exists idx_platform_capability_catalog_category
  on public.platform_capability_catalog(category, sort_order);

create index if not exists idx_platform_entitlement_template_capabilities_capability
  on public.platform_entitlement_template_capabilities(capability_key);

create index if not exists idx_gym_capability_overrides_capability
  on public.gym_capability_overrides(capability_key);

drop trigger if exists trg_platform_capability_catalog_set_updated_at on public.platform_capability_catalog;
create trigger trg_platform_capability_catalog_set_updated_at
before update on public.platform_capability_catalog
for each row execute function public.set_updated_at();

drop trigger if exists trg_platform_entitlement_templates_set_updated_at on public.platform_entitlement_templates;
create trigger trg_platform_entitlement_templates_set_updated_at
before update on public.platform_entitlement_templates
for each row execute function public.set_updated_at();

drop trigger if exists trg_platform_entitlement_template_capabilities_set_updated_at on public.platform_entitlement_template_capabilities;
create trigger trg_platform_entitlement_template_capabilities_set_updated_at
before update on public.platform_entitlement_template_capabilities
for each row execute function public.set_updated_at();

drop trigger if exists trg_gym_entitlement_template_assignments_set_updated_at on public.gym_entitlement_template_assignments;
create trigger trg_gym_entitlement_template_assignments_set_updated_at
before update on public.gym_entitlement_template_assignments
for each row execute function public.set_updated_at();

drop trigger if exists trg_gym_capability_overrides_set_updated_at on public.gym_capability_overrides;
create trigger trg_gym_capability_overrides_set_updated_at
before update on public.gym_capability_overrides
for each row execute function public.set_updated_at();

insert into public.platform_capability_catalog (
  capability_key,
  category,
  sort_order,
  label,
  description,
  value_type,
  global_bool_default,
  global_limit_default,
  is_billing_sensitive,
  metadata
)
values
  ('member_payments', 'billing', 10, 'Gym -> member payments', 'Collect membership fees from members through KRUXT.', 'boolean', false, null, true, '{"warning":"Disabling blocks active member payment collection."}'::jsonb),
  ('kruxt_subscription_billing', 'billing', 20, 'Gym -> KRUXT subscription billing', 'Controls the gym subscription KRUXT bills to this tenant.', 'boolean', true, null, true, '{"planDriven":true}'::jsonb),
  ('payment_provider_connection', 'billing', 30, 'Payment provider connection', 'Allow the gym to connect a payment provider such as Stripe.', 'boolean', false, null, true, '{"provider":"stripe"}'::jsonb),
  ('manual_payment_recording', 'billing', 40, 'Manual payment recording / invoices', 'Allow staff to create invoices and record manual payments.', 'boolean', true, null, true, '{}'::jsonb),
  ('refunds_credits', 'billing', 50, 'Refunds & credits', 'Allow refund and credit workflows for member payments.', 'boolean', false, null, true, '{}'::jsonb),
  ('dunning_retry', 'billing', 60, 'Dunning / failed-payment retry', 'Enable automated failed-payment retry and dunning workflows.', 'boolean', false, null, true, '{}'::jsonb),
  ('classes_scheduling', 'operations', 110, 'Classes & scheduling', 'Create and manage classes, capacity, and schedule visibility.', 'boolean', true, null, false, '{}'::jsonb),
  ('check_ins', 'operations', 120, 'Check-ins', 'Enable member check-ins and access event tracking.', 'boolean', true, null, false, '{}'::jsonb),
  ('waivers_esign', 'operations', 130, 'Waivers / e-sign', 'Enable waiver templates, signatures, and compliance acknowledgements.', 'boolean', true, null, false, '{}'::jsonb),
  ('wearable_integrations', 'operations', 140, 'Integrations / wearables', 'Enable wearable device connections and synced activities.', 'boolean', false, null, false, '{}'::jsonb),
  ('staff_scheduling', 'operations', 150, 'Staff scheduling', 'Enable staff shifts, coverage planning, and worked-hours tracking.', 'boolean', true, null, false, '{}'::jsonb),
  ('pt_assignment', 'operations', 160, 'PT assignment', 'Assign personal trainers to members.', 'boolean', true, null, false, '{}'::jsonb),
  ('workout_plans', 'operations', 170, 'Workout plans', 'Allow staff and PTs to log member workout plans.', 'boolean', true, null, false, '{}'::jsonb),
  ('public_page_publish', 'growth', 210, 'Public page publish', 'Allow draft, preview, and publish workflows for the public gym page.', 'boolean', true, null, false, '{}'::jsonb),
  ('invite_links_qr', 'growth', 220, 'Invite links / QR', 'Allow staff to create invite links and QR codes.', 'boolean', true, null, false, '{}'::jsonb),
  ('self_serve_join_approval', 'growth', 230, 'Self-serve join + approval', 'Allow new people to request or activate gym access from public flows.', 'boolean', true, null, false, '{}'::jsonb),
  ('dsar_handling', 'compliance', 310, 'DSAR handling', 'Enable data subject request intake and fulfillment workflow.', 'boolean', true, null, false, '{}'::jsonb),
  ('data_export', 'compliance', 320, 'Data export', 'Allow staff and platform operators to export scoped gym/member data.', 'boolean', true, null, true, '{}'::jsonb),
  ('retention_override', 'compliance', 330, 'Retention override', 'Allow this tenant to use a custom retention period instead of the default.', 'boolean', false, null, true, '{}'::jsonb),
  ('audit_activity_view', 'compliance', 340, 'Audit / activity view', 'Enable gym-scoped activity and audit visibility.', 'boolean', true, null, false, '{}'::jsonb),
  ('member_cap', 'limits', 410, 'Member cap', 'Maximum active/trial members allowed for this gym.', 'limit', null, 150, true, '{"unit":"members"}'::jsonb),
  ('staff_seats', 'limits', 420, 'Staff seats', 'Maximum active staff seats allowed for this gym.', 'limit', null, 5, true, '{"unit":"seats"}'::jsonb),
  ('storage_gb', 'limits', 430, 'Storage', 'Storage limit for files and generated assets.', 'limit', null, 5, true, '{"unit":"GB"}'::jsonb),
  ('api_rate_per_minute', 'limits', 440, 'API rate', 'API requests allowed per minute for tenant integrations.', 'limit', null, 60, true, '{"unit":"req/min"}'::jsonb)
on conflict (capability_key) do update
set
  category = excluded.category,
  sort_order = excluded.sort_order,
  label = excluded.label,
  description = excluded.description,
  value_type = excluded.value_type,
  global_bool_default = excluded.global_bool_default,
  global_limit_default = excluded.global_limit_default,
  is_billing_sensitive = excluded.is_billing_sensitive,
  metadata = public.platform_capability_catalog.metadata || excluded.metadata,
  updated_at = now();

insert into public.platform_entitlement_templates (
  template_key,
  name,
  description,
  sort_order,
  metadata
)
values
  ('starter', 'Starter', 'Core gym operations for early customers and small gyms.', 10, '{"tier":"starter"}'::jsonb),
  ('pro', 'Pro', 'BZone-ready operating tier with payments, staff workflows, and growth tools.', 20, '{"tier":"pro"}'::jsonb),
  ('enterprise', 'Enterprise', 'Full white-label operating tier with expanded limits and advanced controls.', 30, '{"tier":"enterprise"}'::jsonb)
on conflict (template_key) do update
set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true,
  metadata = public.platform_entitlement_templates.metadata || excluded.metadata,
  updated_at = now();

insert into public.platform_entitlement_template_capabilities (template_key, capability_key, bool_value, limit_value)
values
  ('starter', 'member_payments', false, null),
  ('starter', 'kruxt_subscription_billing', true, null),
  ('starter', 'payment_provider_connection', false, null),
  ('starter', 'manual_payment_recording', true, null),
  ('starter', 'refunds_credits', false, null),
  ('starter', 'dunning_retry', false, null),
  ('starter', 'classes_scheduling', true, null),
  ('starter', 'check_ins', true, null),
  ('starter', 'waivers_esign', true, null),
  ('starter', 'wearable_integrations', false, null),
  ('starter', 'staff_scheduling', true, null),
  ('starter', 'pt_assignment', true, null),
  ('starter', 'workout_plans', true, null),
  ('starter', 'public_page_publish', true, null),
  ('starter', 'invite_links_qr', true, null),
  ('starter', 'self_serve_join_approval', true, null),
  ('starter', 'dsar_handling', true, null),
  ('starter', 'data_export', false, null),
  ('starter', 'retention_override', false, null),
  ('starter', 'audit_activity_view', true, null),
  ('starter', 'member_cap', null, 150),
  ('starter', 'staff_seats', null, 5),
  ('starter', 'storage_gb', null, 5),
  ('starter', 'api_rate_per_minute', null, 60),
  ('pro', 'member_payments', true, null),
  ('pro', 'kruxt_subscription_billing', true, null),
  ('pro', 'payment_provider_connection', true, null),
  ('pro', 'manual_payment_recording', true, null),
  ('pro', 'refunds_credits', true, null),
  ('pro', 'dunning_retry', true, null),
  ('pro', 'classes_scheduling', true, null),
  ('pro', 'check_ins', true, null),
  ('pro', 'waivers_esign', true, null),
  ('pro', 'wearable_integrations', true, null),
  ('pro', 'staff_scheduling', true, null),
  ('pro', 'pt_assignment', true, null),
  ('pro', 'workout_plans', true, null),
  ('pro', 'public_page_publish', true, null),
  ('pro', 'invite_links_qr', true, null),
  ('pro', 'self_serve_join_approval', true, null),
  ('pro', 'dsar_handling', true, null),
  ('pro', 'data_export', true, null),
  ('pro', 'retention_override', false, null),
  ('pro', 'audit_activity_view', true, null),
  ('pro', 'member_cap', null, 1000),
  ('pro', 'staff_seats', null, 25),
  ('pro', 'storage_gb', null, 50),
  ('pro', 'api_rate_per_minute', null, 300),
  ('enterprise', 'member_payments', true, null),
  ('enterprise', 'kruxt_subscription_billing', true, null),
  ('enterprise', 'payment_provider_connection', true, null),
  ('enterprise', 'manual_payment_recording', true, null),
  ('enterprise', 'refunds_credits', true, null),
  ('enterprise', 'dunning_retry', true, null),
  ('enterprise', 'classes_scheduling', true, null),
  ('enterprise', 'check_ins', true, null),
  ('enterprise', 'waivers_esign', true, null),
  ('enterprise', 'wearable_integrations', true, null),
  ('enterprise', 'staff_scheduling', true, null),
  ('enterprise', 'pt_assignment', true, null),
  ('enterprise', 'workout_plans', true, null),
  ('enterprise', 'public_page_publish', true, null),
  ('enterprise', 'invite_links_qr', true, null),
  ('enterprise', 'self_serve_join_approval', true, null),
  ('enterprise', 'dsar_handling', true, null),
  ('enterprise', 'data_export', true, null),
  ('enterprise', 'retention_override', true, null),
  ('enterprise', 'audit_activity_view', true, null),
  ('enterprise', 'member_cap', null, 10000),
  ('enterprise', 'staff_seats', null, 250),
  ('enterprise', 'storage_gb', null, 500),
  ('enterprise', 'api_rate_per_minute', null, 2000)
on conflict (template_key, capability_key) do update
set
  bool_value = excluded.bool_value,
  limit_value = excluded.limit_value,
  updated_at = now();

insert into public.platform_plans (
  code,
  name,
  description,
  is_active,
  amount_cents,
  currency,
  billing_period,
  trial_days,
  modules,
  entitlement_template_key,
  metadata
)
values
  ('starter', 'Starter', 'Core gym operations with Starter entitlement defaults.', true, 2900, 'EUR', 'monthly', 14, array['core', 'operations'], 'starter', '{"source":"per_gym_capability_entitlements"}'::jsonb),
  ('pro', 'Pro', 'Full operating tier for BZone-style gyms.', true, 7900, 'EUR', 'monthly', 14, array['core', 'operations', 'growth', 'payments'], 'pro', '{"source":"per_gym_capability_entitlements"}'::jsonb),
  ('enterprise', 'Enterprise', 'Enterprise tenant operating tier with expanded limits.', true, 19900, 'EUR', 'monthly', 30, array['core', 'operations', 'growth', 'payments', 'compliance'], 'enterprise', '{"source":"per_gym_capability_entitlements"}'::jsonb)
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  is_active = true,
  modules = excluded.modules,
  entitlement_template_key = excluded.entitlement_template_key,
  metadata = public.platform_plans.metadata || excluded.metadata,
  updated_at = now();

insert into public.gym_entitlement_template_assignments (
  gym_id,
  template_key,
  assigned_reason,
  metadata
)
select
  g.id,
  'pro',
  'BZone beta UAT default template',
  '{"source":"per_gym_capability_entitlements","tenant":"BZone"}'::jsonb
from public.gyms g
where g.id = '61036acd-2f86-4745-866e-cd2f5539371f'::uuid
   or lower(g.slug) in ('bzone', 'bzone-fitness', 'bzonefitness')
on conflict (gym_id) do update
set
  template_key = excluded.template_key,
  assigned_reason = excluded.assigned_reason,
  metadata = public.gym_entitlement_template_assignments.metadata || excluded.metadata,
  updated_at = now();

create or replace function public.platform_get_capability_impact_count(
  p_gym_id uuid,
  p_capability_key text
)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_key text := lower(trim(coalesce(p_capability_key, '')));
  v_count integer := 0;
begin
  if p_gym_id is null then
    return 0;
  end if;

  if v_key = 'member_payments' then
    select count(*)::integer into v_count
    from public.member_subscriptions ms
    where ms.gym_id = p_gym_id
      and ms.status in ('trialing', 'active', 'past_due', 'unpaid');
  elsif v_key = 'kruxt_subscription_billing' then
    select count(*)::integer into v_count
    from public.gym_platform_subscriptions gps
    where gps.gym_id = p_gym_id
      and gps.status in ('trialing', 'active', 'past_due', 'unpaid');
  elsif v_key = 'payment_provider_connection' then
    select (
      (select count(*) from public.member_subscriptions ms where ms.gym_id = p_gym_id and ms.provider = 'stripe' and ms.status in ('trialing', 'active', 'past_due', 'unpaid'))
      + (select count(*) from public.invoice_provider_connections ipc where ipc.gym_id = p_gym_id and ipc.connection_status in ('pending', 'active'))
    )::integer into v_count;
  elsif v_key = 'manual_payment_recording' then
    select count(*)::integer into v_count
    from public.invoices i
    where i.gym_id = p_gym_id
      and i.status in ('draft', 'open');
  elsif v_key = 'refunds_credits' then
    select count(*)::integer into v_count
    from public.refunds r
    join public.payment_transactions pt on pt.id = r.payment_transaction_id
    where pt.gym_id = p_gym_id
      and r.status in ('pending', 'succeeded');
  elsif v_key = 'dunning_retry' then
    select count(*)::integer into v_count
    from public.dunning_events de
    join public.member_subscriptions ms on ms.id = de.subscription_id
    where ms.gym_id = p_gym_id
      and de.stage <> 'cancelled';
  elsif v_key = 'classes_scheduling' then
    select count(*)::integer into v_count
    from public.gym_classes gc
    where gc.gym_id = p_gym_id
      and gc.status = 'scheduled'
      and gc.ends_at >= now();
  elsif v_key = 'check_ins' then
    select count(*)::integer into v_count
    from public.gym_checkins gi
    where gi.gym_id = p_gym_id
      and gi.checked_in_at >= now() - interval '30 days';
  elsif v_key = 'waivers_esign' then
    select count(*)::integer into v_count
    from public.waivers w
    where w.gym_id = p_gym_id
      and w.is_active = true;
  elsif v_key = 'wearable_integrations' then
    select count(*)::integer into v_count
    from public.device_connections dc
    join public.gym_memberships gm on gm.user_id = dc.user_id
    where gm.gym_id = p_gym_id
      and gm.membership_status in ('trial', 'active')
      and dc.status = 'active';
  elsif v_key = 'staff_scheduling' then
    select count(*)::integer into v_count
    from public.staff_shifts ss
    where ss.gym_id = p_gym_id
      and ss.status in ('scheduled', 'confirmed', 'in_progress')
      and ss.ends_at >= now();
  elsif v_key = 'pt_assignment' then
    select count(*)::integer into v_count
    from public.gym_memberships gm
    where gm.gym_id = p_gym_id
      and gm.coach_user_id is not null
      and gm.membership_status in ('trial', 'active', 'paused');
  elsif v_key = 'workout_plans' then
    select count(*)::integer into v_count
    from public.gym_member_workout_plans gwp
    where gwp.gym_id = p_gym_id
      and gwp.status in ('draft', 'active', 'paused');
  elsif v_key = 'public_page_publish' then
    select count(*)::integer into v_count
    from public.gym_public_page_drafts gppd
    where gppd.gym_id = p_gym_id
      and gppd.status in ('ready', 'published');
  elsif v_key = 'invite_links_qr' then
    select count(*)::integer into v_count
    from public.gym_invite_codes gic
    where gic.gym_id = p_gym_id
      and gic.is_active = true
      and (gic.expires_at is null or gic.expires_at > now());
  elsif v_key = 'self_serve_join_approval' then
    select count(*)::integer into v_count
    from public.gym_join_requests gjr
    where gjr.gym_id = p_gym_id
      and gjr.status = 'pending';
  elsif v_key = 'dsar_handling' then
    select count(distinct pr.id)::integer into v_count
    from public.privacy_requests pr
    join public.gym_memberships gm on gm.user_id = pr.user_id
    where gm.gym_id = p_gym_id
      and public.is_privacy_request_open_status(pr.status);
  elsif v_key = 'data_export' then
    select count(distinct pej.id)::integer into v_count
    from public.privacy_export_jobs pej
    join public.gym_memberships gm on gm.user_id = pej.user_id
    where gm.gym_id = p_gym_id
      and pej.status in ('queued', 'running', 'retry_scheduled');
  elsif v_key = 'member_cap' then
    select count(*)::integer into v_count
    from public.gym_memberships gm
    where gm.gym_id = p_gym_id
      and gm.membership_status in ('trial', 'active');
  elsif v_key = 'staff_seats' then
    select count(*)::integer into v_count
    from public.gym_memberships gm
    where gm.gym_id = p_gym_id
      and gm.membership_status in ('trial', 'active')
      and gm.role in ('leader', 'officer', 'coach');
  else
    v_count := 0;
  end if;

  return coalesce(v_count, 0);
end;
$$;

create or replace function public.platform_get_gym_capabilities(
  p_gym_id uuid
)
returns table (
  capability_key text,
  category text,
  sort_order integer,
  label text,
  description text,
  value_type text,
  effective_bool boolean,
  effective_limit integer,
  source text,
  global_bool_default boolean,
  global_limit_default integer,
  template_key text,
  template_name text,
  template_bool_value boolean,
  template_limit_value integer,
  override_bool_value boolean,
  override_limit_value integer,
  override_reason text,
  override_updated_at timestamptz,
  is_billing_sensitive boolean,
  metadata jsonb,
  impact_count integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_template_key text;
  v_template_name text;
begin
  if p_gym_id is null or not exists (select 1 from public.gyms g where g.id = p_gym_id) then
    raise exception 'Gym not found';
  end if;

  if not (
    public.platform_operator_has_permission('platform.flags.view', v_actor)
    or public.platform_operator_has_permission('platform.flags.tenant_override', v_actor)
    or public.platform_operator_has_permission('platform.entitlements.templates.manage', v_actor)
    or public.is_gym_staff(p_gym_id, v_actor)
  ) then
    raise exception 'Capability view access is required';
  end if;

  select gta.template_key, pet.name
  into v_template_key, v_template_name
  from public.gym_entitlement_template_assignments gta
  join public.platform_entitlement_templates pet on pet.template_key = gta.template_key
  where gta.gym_id = p_gym_id
  limit 1;

  if v_template_key is null then
    select pp.entitlement_template_key, pet.name
    into v_template_key, v_template_name
    from public.gym_platform_subscriptions gps
    join public.platform_plans pp on pp.id = gps.platform_plan_id
    left join public.platform_entitlement_templates pet on pet.template_key = pp.entitlement_template_key
    where gps.gym_id = p_gym_id
      and gps.status in ('trialing', 'active', 'past_due', 'unpaid')
      and pp.entitlement_template_key is not null
    order by gps.created_at desc
    limit 1;
  end if;

  return query
  select
    c.capability_key,
    c.category,
    c.sort_order,
    c.label,
    c.description,
    c.value_type,
    case
      when c.value_type = 'boolean' then coalesce(go.bool_value, ptc.bool_value, c.global_bool_default)
      else null
    end as effective_bool,
    case
      when c.value_type = 'limit' then coalesce(go.limit_value, ptc.limit_value, c.global_limit_default)
      else null
    end as effective_limit,
    case
      when go.capability_key is not null then 'override'
      when ptc.capability_key is not null then 'plan'
      else 'global'
    end as source,
    c.global_bool_default,
    c.global_limit_default,
    v_template_key,
    v_template_name,
    ptc.bool_value,
    ptc.limit_value,
    go.bool_value,
    go.limit_value,
    go.reason,
    go.updated_at,
    c.is_billing_sensitive,
    c.metadata,
    public.platform_get_capability_impact_count(p_gym_id, c.capability_key) as impact_count
  from public.platform_capability_catalog c
  left join public.platform_entitlement_template_capabilities ptc
    on ptc.template_key = v_template_key
   and ptc.capability_key = c.capability_key
  left join public.gym_capability_overrides go
    on go.gym_id = p_gym_id
   and go.capability_key = c.capability_key
  order by c.category, c.sort_order, c.capability_key;
end;
$$;

create or replace function public.platform_assign_gym_entitlement_template(
  p_gym_id uuid,
  p_template_key text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_template_key text := lower(trim(coalesce(p_template_key, '')));
  v_previous_template_key text;
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  if not (
    public.platform_operator_has_permission('platform.flags.tenant_override', v_actor)
    or public.platform_operator_has_permission('platform.entitlements.templates.manage', v_actor)
  ) then
    raise exception 'Tenant entitlement access is required';
  end if;

  if p_gym_id is null or not exists (select 1 from public.gyms g where g.id = p_gym_id) then
    raise exception 'Gym not found';
  end if;

  if not exists (
    select 1
    from public.platform_entitlement_templates pet
    where pet.template_key = v_template_key
      and pet.is_active = true
  ) then
    raise exception 'Entitlement template not found';
  end if;

  select gta.template_key
  into v_previous_template_key
  from public.gym_entitlement_template_assignments gta
  where gta.gym_id = p_gym_id;

  insert into public.gym_entitlement_template_assignments (
    gym_id,
    template_key,
    assigned_by,
    assigned_reason,
    metadata
  )
  values (
    p_gym_id,
    v_template_key,
    v_actor,
    nullif(trim(coalesce(p_reason, '')), ''),
    jsonb_build_object('source', 'tenant_features_tab')
  )
  on conflict (gym_id) do update
    set template_key = excluded.template_key,
        assigned_by = excluded.assigned_by,
        assigned_reason = excluded.assigned_reason,
        metadata = public.gym_entitlement_template_assignments.metadata || excluded.metadata,
        updated_at = now();

  perform public.append_audit_log(
    'platform.gym_entitlement_template.assigned',
    'gym_entitlement_template_assignments',
    p_gym_id,
    nullif(trim(coalesce(p_reason, '')), ''),
    jsonb_build_object(
      'gymId', p_gym_id,
      'previousTemplateKey', v_previous_template_key,
      'nextTemplateKey', v_template_key,
      'source', 'tenant_features_tab'
    )
  );

  return jsonb_build_object(
    'gymId', p_gym_id,
    'templateKey', v_template_key,
    'previousTemplateKey', v_previous_template_key
  );
end;
$$;

create or replace function public.platform_set_gym_capability_override(
  p_gym_id uuid,
  p_capability_key text,
  p_bool_value boolean default null,
  p_limit_value integer default null,
  p_reason text default null,
  p_acknowledged_impact boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_key text := lower(trim(coalesce(p_capability_key, '')));
  v_catalog public.platform_capability_catalog%rowtype;
  v_previous public.gym_capability_overrides%rowtype;
  v_impact_count integer := 0;
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  if not public.platform_operator_has_permission('platform.flags.tenant_override', v_actor) then
    raise exception 'Tenant feature override access is required';
  end if;

  if p_gym_id is null or not exists (select 1 from public.gyms g where g.id = p_gym_id) then
    raise exception 'Gym not found';
  end if;

  select *
  into v_catalog
  from public.platform_capability_catalog c
  where c.capability_key = v_key;

  if v_catalog.capability_key is null then
    raise exception 'Capability not found';
  end if;

  if v_catalog.value_type = 'boolean' then
    if p_bool_value is null or p_limit_value is not null then
      raise exception 'Boolean capability overrides require bool_value only';
    end if;

    v_impact_count := public.platform_get_capability_impact_count(p_gym_id, v_key);

    if p_bool_value = false and v_impact_count > 0 and not p_acknowledged_impact then
      raise exception 'Capability is in use; acknowledge impact before disabling';
    end if;
  else
    if p_limit_value is null or p_bool_value is not null or p_limit_value < 0 then
      raise exception 'Limit capability overrides require non-negative limit_value only';
    end if;
  end if;

  select *
  into v_previous
  from public.gym_capability_overrides go
  where go.gym_id = p_gym_id
    and go.capability_key = v_key;

  insert into public.gym_capability_overrides (
    gym_id,
    capability_key,
    bool_value,
    limit_value,
    reason,
    updated_by,
    metadata
  )
  values (
    p_gym_id,
    v_key,
    case when v_catalog.value_type = 'boolean' then p_bool_value else null end,
    case when v_catalog.value_type = 'limit' then p_limit_value else null end,
    nullif(trim(coalesce(p_reason, '')), ''),
    v_actor,
    jsonb_build_object('source', 'tenant_features_tab')
  )
  on conflict (gym_id, capability_key) do update
    set bool_value = excluded.bool_value,
        limit_value = excluded.limit_value,
        reason = excluded.reason,
        updated_by = excluded.updated_by,
        metadata = public.gym_capability_overrides.metadata || excluded.metadata,
        updated_at = now();

  perform public.append_audit_log(
    'platform.gym_capability_override.changed',
    'gym_capability_overrides',
    p_gym_id,
    nullif(trim(coalesce(p_reason, '')), ''),
    jsonb_build_object(
      'gymId', p_gym_id,
      'capabilityKey', v_key,
      'valueType', v_catalog.value_type,
      'previousBoolValue', v_previous.bool_value,
      'previousLimitValue', v_previous.limit_value,
      'nextBoolValue', p_bool_value,
      'nextLimitValue', p_limit_value,
      'impactCount', v_impact_count,
      'impactAcknowledged', p_acknowledged_impact,
      'source', 'tenant_features_tab'
    )
  );

  return jsonb_build_object(
    'gymId', p_gym_id,
    'capabilityKey', v_key,
    'valueType', v_catalog.value_type,
    'boolValue', p_bool_value,
    'limitValue', p_limit_value,
    'impactCount', v_impact_count
  );
end;
$$;

create or replace function public.platform_clear_gym_capability_override(
  p_gym_id uuid,
  p_capability_key text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_key text := lower(trim(coalesce(p_capability_key, '')));
  v_previous public.gym_capability_overrides%rowtype;
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  if not public.platform_operator_has_permission('platform.flags.tenant_override', v_actor) then
    raise exception 'Tenant feature override access is required';
  end if;

  if p_gym_id is null or not exists (select 1 from public.gyms g where g.id = p_gym_id) then
    raise exception 'Gym not found';
  end if;

  select *
  into v_previous
  from public.gym_capability_overrides go
  where go.gym_id = p_gym_id
    and go.capability_key = v_key;

  delete from public.gym_capability_overrides
  where gym_id = p_gym_id
    and capability_key = v_key;

  perform public.append_audit_log(
    'platform.gym_capability_override.cleared',
    'gym_capability_overrides',
    p_gym_id,
    nullif(trim(coalesce(p_reason, '')), ''),
    jsonb_build_object(
      'gymId', p_gym_id,
      'capabilityKey', v_key,
      'previousBoolValue', v_previous.bool_value,
      'previousLimitValue', v_previous.limit_value,
      'source', 'tenant_features_tab'
    )
  );

  return jsonb_build_object(
    'gymId', p_gym_id,
    'capabilityKey', v_key,
    'cleared', true
  );
end;
$$;

grant select on public.platform_capability_catalog to authenticated;
grant select on public.platform_entitlement_templates to authenticated;
grant select on public.platform_entitlement_template_capabilities to authenticated;
grant select on public.gym_entitlement_template_assignments to authenticated;
grant select on public.gym_capability_overrides to authenticated;
grant insert, update, delete on public.gym_entitlement_template_assignments to authenticated;
grant insert, update, delete on public.gym_capability_overrides to authenticated;

grant select, insert, update, delete on public.platform_capability_catalog to service_role;
grant select, insert, update, delete on public.platform_entitlement_templates to service_role;
grant select, insert, update, delete on public.platform_entitlement_template_capabilities to service_role;
grant select, insert, update, delete on public.gym_entitlement_template_assignments to service_role;
grant select, insert, update, delete on public.gym_capability_overrides to service_role;

alter table public.platform_capability_catalog enable row level security;
alter table public.platform_entitlement_templates enable row level security;
alter table public.platform_entitlement_template_capabilities enable row level security;
alter table public.gym_entitlement_template_assignments enable row level security;
alter table public.gym_capability_overrides enable row level security;

drop policy if exists platform_capability_catalog_select on public.platform_capability_catalog;
create policy platform_capability_catalog_select
on public.platform_capability_catalog for select to authenticated
using (
  public.is_service_role()
  or public.is_platform_operator(auth.uid())
);

drop policy if exists platform_entitlement_templates_select on public.platform_entitlement_templates;
create policy platform_entitlement_templates_select
on public.platform_entitlement_templates for select to authenticated
using (
  public.is_service_role()
  or public.is_platform_operator(auth.uid())
);

drop policy if exists platform_entitlement_template_capabilities_select on public.platform_entitlement_template_capabilities;
create policy platform_entitlement_template_capabilities_select
on public.platform_entitlement_template_capabilities for select to authenticated
using (
  public.is_service_role()
  or public.is_platform_operator(auth.uid())
);

drop policy if exists gym_entitlement_template_assignments_select on public.gym_entitlement_template_assignments;
create policy gym_entitlement_template_assignments_select
on public.gym_entitlement_template_assignments for select to authenticated
using (
  public.is_service_role()
  or public.is_platform_operator(auth.uid())
  or public.is_gym_staff(gym_id, auth.uid())
);

drop policy if exists gym_entitlement_template_assignments_manage on public.gym_entitlement_template_assignments;
create policy gym_entitlement_template_assignments_manage
on public.gym_entitlement_template_assignments for all to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.flags.tenant_override', auth.uid())
  or public.platform_operator_has_permission('platform.entitlements.templates.manage', auth.uid())
)
with check (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.flags.tenant_override', auth.uid())
  or public.platform_operator_has_permission('platform.entitlements.templates.manage', auth.uid())
);

drop policy if exists gym_capability_overrides_select on public.gym_capability_overrides;
create policy gym_capability_overrides_select
on public.gym_capability_overrides for select to authenticated
using (
  public.is_service_role()
  or public.is_platform_operator(auth.uid())
  or public.is_gym_staff(gym_id, auth.uid())
);

drop policy if exists gym_capability_overrides_manage on public.gym_capability_overrides;
create policy gym_capability_overrides_manage
on public.gym_capability_overrides for all to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.flags.tenant_override', auth.uid())
)
with check (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.flags.tenant_override', auth.uid())
);

revoke all on function public.platform_get_capability_impact_count(uuid, text) from public;
grant execute on function public.platform_get_capability_impact_count(uuid, text) to authenticated;
grant execute on function public.platform_get_capability_impact_count(uuid, text) to service_role;

revoke all on function public.platform_get_gym_capabilities(uuid) from public;
grant execute on function public.platform_get_gym_capabilities(uuid) to authenticated;
grant execute on function public.platform_get_gym_capabilities(uuid) to service_role;

revoke all on function public.platform_assign_gym_entitlement_template(uuid, text, text) from public;
grant execute on function public.platform_assign_gym_entitlement_template(uuid, text, text) to authenticated;
grant execute on function public.platform_assign_gym_entitlement_template(uuid, text, text) to service_role;

revoke all on function public.platform_set_gym_capability_override(uuid, text, boolean, integer, text, boolean) from public;
grant execute on function public.platform_set_gym_capability_override(uuid, text, boolean, integer, text, boolean) to authenticated;
grant execute on function public.platform_set_gym_capability_override(uuid, text, boolean, integer, text, boolean) to service_role;

revoke all on function public.platform_clear_gym_capability_override(uuid, text, text) from public;
grant execute on function public.platform_clear_gym_capability_override(uuid, text, text) to authenticated;
grant execute on function public.platform_clear_gym_capability_override(uuid, text, text) to service_role;
