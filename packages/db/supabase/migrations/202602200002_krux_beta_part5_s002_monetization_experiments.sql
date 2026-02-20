-- KRUXT beta part 5 (s002)
-- Monetization-ready foundations (activation controlled):
-- 1) B2C plan/price catalog and entitlement records
-- 2) Pricing experiments (A/B) for B2C and B2B scopes
-- 3) Discount campaigns + redemption tracking for B2C and B2B

-- =====================================================
-- ENUMS
-- =====================================================

do $$ begin
  create type public.billing_scope as enum ('b2c', 'b2b');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.pricing_experiment_status as enum ('draft', 'running', 'paused', 'completed', 'archived');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.pricing_assignment_status as enum ('assigned', 'exposed', 'converted', 'expired');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.discount_type as enum ('percent', 'amount', 'trial_days');
exception
  when duplicate_object then null;
end $$;

-- =====================================================
-- B2C PLAN / PRICE / ENTITLEMENTS
-- =====================================================

create table if not exists public.consumer_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.consumer_plan_prices (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.consumer_plans(id) on delete cascade,
  provider text not null default 'app_store',
  provider_product_id text,
  provider_price_id text,
  country_code char(2),
  currency char(3) not null default 'USD',
  amount_cents integer not null check (amount_cents >= 0),
  billing_period text not null default 'monthly'
    check (billing_period in ('weekly', 'monthly', 'quarterly', 'yearly', 'one_time')),
  billing_period_count integer not null default 1 check (billing_period_count >= 1),
  trial_days integer check (trial_days is null or trial_days >= 0),
  is_default boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, provider_price_id)
);

create table if not exists public.consumer_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid references public.consumer_plans(id) on delete set null,
  status public.subscription_status not null default 'incomplete',
  provider text not null default 'app_store',
  provider_customer_id text,
  provider_original_transaction_id text,
  provider_subscription_id text,
  started_at timestamptz,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  canceled_at timestamptz,
  last_verified_at timestamptz,
  raw_receipt jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, provider_original_transaction_id),
  unique(provider, provider_subscription_id)
);

-- =====================================================
-- PRICING EXPERIMENTS (A/B)
-- =====================================================

create table if not exists public.pricing_experiments (
  id uuid primary key default gen_random_uuid(),
  scope public.billing_scope not null,
  gym_id uuid references public.gyms(id) on delete cascade,
  name text not null,
  hypothesis text,
  status public.pricing_experiment_status not null default 'draft',
  target_filters jsonb not null default '{}'::jsonb,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (scope = 'b2c' and gym_id is null)
    or (scope = 'b2b' and gym_id is not null)
  )
);

create table if not exists public.pricing_experiment_variants (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references public.pricing_experiments(id) on delete cascade,
  variant_key text not null,
  allocation_percent numeric(5,2) not null check (allocation_percent > 0 and allocation_percent <= 100),
  target_type text not null check (target_type in ('consumer_plan_price', 'gym_membership_plan')),
  target_id uuid not null,
  is_control boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(experiment_id, variant_key)
);

create table if not exists public.pricing_experiment_assignments (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references public.pricing_experiments(id) on delete cascade,
  variant_id uuid not null references public.pricing_experiment_variants(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  gym_id uuid references public.gyms(id) on delete cascade,
  assignment_status public.pricing_assignment_status not null default 'assigned',
  assigned_at timestamptz not null default now(),
  first_exposed_at timestamptz,
  converted_at timestamptz,
  conversion_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (user_id is not null and gym_id is null)
    or (user_id is null and gym_id is not null)
  ),
  unique(experiment_id, user_id),
  unique(experiment_id, gym_id)
);

-- =====================================================
-- DISCOUNTS / PROMOS
-- =====================================================

create table if not exists public.discount_campaigns (
  id uuid primary key default gen_random_uuid(),
  scope public.billing_scope not null,
  gym_id uuid references public.gyms(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  discount_type public.discount_type not null,
  percent_off numeric(5,2) check (percent_off is null or (percent_off > 0 and percent_off <= 100)),
  amount_off_cents integer check (amount_off_cents is null or amount_off_cents >= 0),
  trial_days_off integer check (trial_days_off is null or trial_days_off >= 0),
  currency char(3),
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  max_redemptions_per_user integer check (max_redemptions_per_user is null or max_redemptions_per_user > 0),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  eligible_filters jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (scope = 'b2c' and gym_id is null)
    or (scope = 'b2b' and gym_id is not null)
  ),
  check (
    (discount_type = 'percent' and percent_off is not null)
    or (discount_type = 'amount' and amount_off_cents is not null)
    or (discount_type = 'trial_days' and trial_days_off is not null)
  )
);

create table if not exists public.discount_redemptions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.discount_campaigns(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  gym_id uuid references public.gyms(id) on delete set null,
  member_subscription_id uuid references public.member_subscriptions(id) on delete set null,
  consumer_entitlement_id uuid references public.consumer_entitlements(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  amount_discount_cents integer not null default 0 check (amount_discount_cents >= 0),
  currency char(3),
  redeemed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(campaign_id, user_id, invoice_id)
);

create unique index if not exists uq_discount_campaigns_b2c_code
  on public.discount_campaigns(code)
  where scope = 'b2c';

create unique index if not exists uq_discount_campaigns_b2b_gym_code
  on public.discount_campaigns(gym_id, code)
  where scope = 'b2b';

-- =====================================================
-- INDEXES
-- =====================================================

create index if not exists idx_consumer_plan_prices_plan_active
  on public.consumer_plan_prices(plan_id, is_default, starts_at desc);
create index if not exists idx_consumer_entitlements_user_status
  on public.consumer_entitlements(user_id, status, current_period_end);
create index if not exists idx_pricing_experiments_scope_status
  on public.pricing_experiments(scope, status, starts_at);
create index if not exists idx_pricing_variants_experiment
  on public.pricing_experiment_variants(experiment_id, is_control);
create index if not exists idx_pricing_assignments_subject
  on public.pricing_experiment_assignments(experiment_id, assignment_status, assigned_at desc);
create index if not exists idx_discount_campaigns_scope_active
  on public.discount_campaigns(scope, is_active, starts_at);
create index if not exists idx_discount_redemptions_campaign_time
  on public.discount_redemptions(campaign_id, redeemed_at desc);

-- =====================================================
-- UPDATED_AT TRIGGERS
-- =====================================================

drop trigger if exists trg_consumer_plans_set_updated_at on public.consumer_plans;
create trigger trg_consumer_plans_set_updated_at
before update on public.consumer_plans
for each row execute function public.set_updated_at();

drop trigger if exists trg_consumer_plan_prices_set_updated_at on public.consumer_plan_prices;
create trigger trg_consumer_plan_prices_set_updated_at
before update on public.consumer_plan_prices
for each row execute function public.set_updated_at();

drop trigger if exists trg_consumer_entitlements_set_updated_at on public.consumer_entitlements;
create trigger trg_consumer_entitlements_set_updated_at
before update on public.consumer_entitlements
for each row execute function public.set_updated_at();

drop trigger if exists trg_pricing_experiments_set_updated_at on public.pricing_experiments;
create trigger trg_pricing_experiments_set_updated_at
before update on public.pricing_experiments
for each row execute function public.set_updated_at();

drop trigger if exists trg_pricing_experiment_variants_set_updated_at on public.pricing_experiment_variants;
create trigger trg_pricing_experiment_variants_set_updated_at
before update on public.pricing_experiment_variants
for each row execute function public.set_updated_at();

drop trigger if exists trg_pricing_experiment_assignments_set_updated_at on public.pricing_experiment_assignments;
create trigger trg_pricing_experiment_assignments_set_updated_at
before update on public.pricing_experiment_assignments
for each row execute function public.set_updated_at();

drop trigger if exists trg_discount_campaigns_set_updated_at on public.discount_campaigns;
create trigger trg_discount_campaigns_set_updated_at
before update on public.discount_campaigns
for each row execute function public.set_updated_at();

-- =====================================================
-- ACCESS HELPERS
-- =====================================================

create or replace function public.can_manage_pricing_experiment(
  _experiment_id uuid,
  _viewer uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.pricing_experiments pe
    where pe.id = _experiment_id
      and (
        public.is_service_role()
        or (pe.scope = 'b2b' and pe.gym_id is not null and public.can_manage_gym_config(pe.gym_id, _viewer))
      )
  );
$$;

create or replace function public.can_manage_discount_campaign(
  _campaign_id uuid,
  _viewer uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.discount_campaigns dc
    where dc.id = _campaign_id
      and (
        public.is_service_role()
        or (dc.scope = 'b2b' and dc.gym_id is not null and public.can_manage_gym_config(dc.gym_id, _viewer))
      )
  );
$$;

-- =====================================================
-- RLS
-- =====================================================

alter table public.consumer_plans enable row level security;
alter table public.consumer_plan_prices enable row level security;
alter table public.consumer_entitlements enable row level security;
alter table public.pricing_experiments enable row level security;
alter table public.pricing_experiment_variants enable row level security;
alter table public.pricing_experiment_assignments enable row level security;
alter table public.discount_campaigns enable row level security;
alter table public.discount_redemptions enable row level security;

-- consumer plans/prices: readable by authenticated users, mutable by service role only
drop policy if exists consumer_plans_select on public.consumer_plans;
create policy consumer_plans_select
on public.consumer_plans for select to authenticated
using (is_active or public.is_service_role());

drop policy if exists consumer_plans_manage on public.consumer_plans;
create policy consumer_plans_manage
on public.consumer_plans for all to authenticated
using (public.is_service_role())
with check (public.is_service_role());

drop policy if exists consumer_plan_prices_select on public.consumer_plan_prices;
create policy consumer_plan_prices_select
on public.consumer_plan_prices for select to authenticated
using (public.is_service_role() or true);

drop policy if exists consumer_plan_prices_manage on public.consumer_plan_prices;
create policy consumer_plan_prices_manage
on public.consumer_plan_prices for all to authenticated
using (public.is_service_role())
with check (public.is_service_role());

-- consumer entitlements: user can read own; service can manage
drop policy if exists consumer_entitlements_select on public.consumer_entitlements;
create policy consumer_entitlements_select
on public.consumer_entitlements for select to authenticated
using (public.is_service_role() or user_id = auth.uid());

drop policy if exists consumer_entitlements_manage on public.consumer_entitlements;
create policy consumer_entitlements_manage
on public.consumer_entitlements for all to authenticated
using (public.is_service_role())
with check (public.is_service_role());

-- pricing experiments
drop policy if exists pricing_experiments_select on public.pricing_experiments;
create policy pricing_experiments_select
on public.pricing_experiments for select to authenticated
using (
  public.is_service_role()
  or (scope = 'b2b' and gym_id is not null and public.can_manage_gym_config(gym_id, auth.uid()))
);

drop policy if exists pricing_experiments_manage on public.pricing_experiments;
create policy pricing_experiments_manage
on public.pricing_experiments for all to authenticated
using (
  public.is_service_role()
  or (scope = 'b2b' and gym_id is not null and public.can_manage_gym_config(gym_id, auth.uid()))
)
with check (
  public.is_service_role()
  or (scope = 'b2b' and gym_id is not null and public.can_manage_gym_config(gym_id, auth.uid()))
);

drop policy if exists pricing_variants_select on public.pricing_experiment_variants;
create policy pricing_variants_select
on public.pricing_experiment_variants for select to authenticated
using (
  public.is_service_role()
  or exists (
    select 1
    from public.pricing_experiments pe
    where pe.id = pricing_experiment_variants.experiment_id
      and pe.scope = 'b2b'
      and pe.gym_id is not null
      and public.can_manage_gym_config(pe.gym_id, auth.uid())
  )
);

drop policy if exists pricing_variants_manage on public.pricing_experiment_variants;
create policy pricing_variants_manage
on public.pricing_experiment_variants for all to authenticated
using (
  public.is_service_role()
  or public.can_manage_pricing_experiment(experiment_id, auth.uid())
)
with check (
  public.is_service_role()
  or public.can_manage_pricing_experiment(experiment_id, auth.uid())
);

drop policy if exists pricing_assignments_select on public.pricing_experiment_assignments;
create policy pricing_assignments_select
on public.pricing_experiment_assignments for select to authenticated
using (
  public.is_service_role()
  or (user_id is not null and user_id = auth.uid())
  or exists (
    select 1
    from public.pricing_experiments pe
    where pe.id = pricing_experiment_assignments.experiment_id
      and pe.scope = 'b2b'
      and pe.gym_id is not null
      and public.can_manage_gym_config(pe.gym_id, auth.uid())
  )
);

drop policy if exists pricing_assignments_manage on public.pricing_experiment_assignments;
create policy pricing_assignments_manage
on public.pricing_experiment_assignments for all to authenticated
using (
  public.is_service_role()
  or exists (
    select 1
    from public.pricing_experiments pe
    where pe.id = pricing_experiment_assignments.experiment_id
      and pe.scope = 'b2b'
      and pe.gym_id is not null
      and public.can_manage_gym_config(pe.gym_id, auth.uid())
  )
)
with check (
  public.is_service_role()
  or exists (
    select 1
    from public.pricing_experiments pe
    where pe.id = pricing_experiment_assignments.experiment_id
      and pe.scope = 'b2b'
      and pe.gym_id is not null
      and public.can_manage_gym_config(pe.gym_id, auth.uid())
  )
);

-- discount campaigns/redemptions
drop policy if exists discount_campaigns_select on public.discount_campaigns;
create policy discount_campaigns_select
on public.discount_campaigns for select to authenticated
using (
  public.is_service_role()
  or (scope = 'b2c' and is_active = true)
  or (scope = 'b2b' and gym_id is not null and public.can_view_gym(gym_id, auth.uid()))
);

drop policy if exists discount_campaigns_manage on public.discount_campaigns;
create policy discount_campaigns_manage
on public.discount_campaigns for all to authenticated
using (
  public.is_service_role()
  or (scope = 'b2b' and gym_id is not null and public.can_manage_gym_config(gym_id, auth.uid()))
)
with check (
  public.is_service_role()
  or (scope = 'b2b' and gym_id is not null and public.can_manage_gym_config(gym_id, auth.uid()))
);

drop policy if exists discount_redemptions_select on public.discount_redemptions;
create policy discount_redemptions_select
on public.discount_redemptions for select to authenticated
using (
  public.is_service_role()
  or (user_id is not null and user_id = auth.uid())
  or (gym_id is not null and public.can_manage_gym_config(gym_id, auth.uid()))
);

drop policy if exists discount_redemptions_manage on public.discount_redemptions;
create policy discount_redemptions_manage
on public.discount_redemptions for all to authenticated
using (
  public.is_service_role()
  or (gym_id is not null and public.can_manage_gym_config(gym_id, auth.uid()))
)
with check (
  public.is_service_role()
  or (gym_id is not null and public.can_manage_gym_config(gym_id, auth.uid()))
);
