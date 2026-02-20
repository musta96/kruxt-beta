-- KRUXT beta part 5 (s003)
-- Platform SaaS billing foundations (gyms paying KRUXT), activation controlled.

-- =====================================================
-- TABLES
-- =====================================================

create table if not exists public.platform_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  is_active boolean not null default true,
  amount_cents integer not null check (amount_cents >= 0),
  currency char(3) not null default 'EUR',
  billing_period text not null default 'monthly'
    check (billing_period in ('monthly', 'quarterly', 'yearly')),
  trial_days integer check (trial_days is null or trial_days >= 0),
  provider text not null default 'stripe',
  provider_product_id text,
  provider_price_id text,
  modules text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, provider_price_id)
);

create table if not exists public.gym_platform_subscriptions (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  platform_plan_id uuid references public.platform_plans(id) on delete set null,
  status public.subscription_status not null default 'incomplete',
  provider text not null default 'stripe',
  provider_customer_id text,
  provider_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  cancel_at timestamptz,
  canceled_at timestamptz,
  billing_contact_email text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(gym_id, provider),
  unique(provider, provider_subscription_id)
);

create table if not exists public.gym_platform_invoices (
  id uuid primary key default gen_random_uuid(),
  gym_platform_subscription_id uuid references public.gym_platform_subscriptions(id) on delete set null,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  provider text not null default 'stripe',
  provider_invoice_id text,
  status public.payment_status not null default 'open',
  currency char(3) not null default 'EUR',
  subtotal_cents integer not null default 0 check (subtotal_cents >= 0),
  tax_cents integer not null default 0 check (tax_cents >= 0),
  total_cents integer not null default 0 check (total_cents >= 0),
  amount_paid_cents integer not null default 0 check (amount_paid_cents >= 0),
  amount_due_cents integer not null default 0 check (amount_due_cents >= 0),
  due_at timestamptz,
  paid_at timestamptz,
  invoice_pdf_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, provider_invoice_id)
);

create table if not exists public.gym_platform_payment_transactions (
  id uuid primary key default gen_random_uuid(),
  gym_platform_invoice_id uuid references public.gym_platform_invoices(id) on delete set null,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  provider text not null default 'stripe',
  provider_payment_intent_id text,
  provider_charge_id text,
  status public.payment_status not null default 'open',
  payment_method_type text,
  amount_cents integer not null check (amount_cents >= 0),
  fee_cents integer not null default 0 check (fee_cents >= 0),
  tax_cents integer not null default 0 check (tax_cents >= 0),
  net_cents integer not null default 0,
  currency char(3) not null default 'EUR',
  failure_code text,
  failure_message text,
  captured_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, provider_payment_intent_id),
  unique(provider, provider_charge_id)
);

create table if not exists public.gym_platform_refunds (
  id uuid primary key default gen_random_uuid(),
  gym_platform_payment_transaction_id uuid not null references public.gym_platform_payment_transactions(id) on delete cascade,
  provider_refund_id text,
  status public.refund_status not null default 'pending',
  amount_cents integer not null check (amount_cents >= 0),
  currency char(3) not null default 'EUR',
  reason text,
  processed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider_refund_id)
);

alter table public.discount_redemptions
  add column if not exists gym_platform_invoice_id uuid references public.gym_platform_invoices(id) on delete set null;

-- =====================================================
-- INDEXES
-- =====================================================

create index if not exists idx_platform_plans_active
  on public.platform_plans(is_active, billing_period);
create index if not exists idx_gym_platform_subscriptions_gym_status
  on public.gym_platform_subscriptions(gym_id, status, current_period_end);
create index if not exists idx_gym_platform_invoices_gym_status_due
  on public.gym_platform_invoices(gym_id, status, due_at);
create index if not exists idx_gym_platform_txn_gym_status_captured
  on public.gym_platform_payment_transactions(gym_id, status, captured_at);
create index if not exists idx_gym_platform_refunds_txn_status
  on public.gym_platform_refunds(gym_platform_payment_transaction_id, status);

-- =====================================================
-- UPDATED_AT TRIGGERS
-- =====================================================

drop trigger if exists trg_platform_plans_set_updated_at on public.platform_plans;
create trigger trg_platform_plans_set_updated_at
before update on public.platform_plans
for each row execute function public.set_updated_at();

drop trigger if exists trg_gym_platform_subscriptions_set_updated_at on public.gym_platform_subscriptions;
create trigger trg_gym_platform_subscriptions_set_updated_at
before update on public.gym_platform_subscriptions
for each row execute function public.set_updated_at();

drop trigger if exists trg_gym_platform_invoices_set_updated_at on public.gym_platform_invoices;
create trigger trg_gym_platform_invoices_set_updated_at
before update on public.gym_platform_invoices
for each row execute function public.set_updated_at();

drop trigger if exists trg_gym_platform_payment_transactions_set_updated_at on public.gym_platform_payment_transactions;
create trigger trg_gym_platform_payment_transactions_set_updated_at
before update on public.gym_platform_payment_transactions
for each row execute function public.set_updated_at();

drop trigger if exists trg_gym_platform_refunds_set_updated_at on public.gym_platform_refunds;
create trigger trg_gym_platform_refunds_set_updated_at
before update on public.gym_platform_refunds
for each row execute function public.set_updated_at();

-- =====================================================
-- RLS
-- =====================================================

alter table public.platform_plans enable row level security;
alter table public.gym_platform_subscriptions enable row level security;
alter table public.gym_platform_invoices enable row level security;
alter table public.gym_platform_payment_transactions enable row level security;
alter table public.gym_platform_refunds enable row level security;

drop policy if exists platform_plans_select on public.platform_plans;
create policy platform_plans_select
on public.platform_plans for select to authenticated
using (
  public.is_service_role()
  or is_active = true
);

drop policy if exists platform_plans_manage on public.platform_plans;
create policy platform_plans_manage
on public.platform_plans for all to authenticated
using (public.is_service_role())
with check (public.is_service_role());

drop policy if exists gym_platform_subscriptions_select on public.gym_platform_subscriptions;
create policy gym_platform_subscriptions_select
on public.gym_platform_subscriptions for select to authenticated
using (
  public.is_service_role()
  or public.can_manage_gym_config(gym_id, auth.uid())
);

drop policy if exists gym_platform_subscriptions_manage on public.gym_platform_subscriptions;
create policy gym_platform_subscriptions_manage
on public.gym_platform_subscriptions for all to authenticated
using (public.is_service_role())
with check (public.is_service_role());

drop policy if exists gym_platform_invoices_select on public.gym_platform_invoices;
create policy gym_platform_invoices_select
on public.gym_platform_invoices for select to authenticated
using (
  public.is_service_role()
  or public.can_manage_gym_config(gym_id, auth.uid())
);

drop policy if exists gym_platform_invoices_manage on public.gym_platform_invoices;
create policy gym_platform_invoices_manage
on public.gym_platform_invoices for all to authenticated
using (public.is_service_role())
with check (public.is_service_role());

drop policy if exists gym_platform_transactions_select on public.gym_platform_payment_transactions;
create policy gym_platform_transactions_select
on public.gym_platform_payment_transactions for select to authenticated
using (
  public.is_service_role()
  or public.can_manage_gym_config(gym_id, auth.uid())
);

drop policy if exists gym_platform_transactions_manage on public.gym_platform_payment_transactions;
create policy gym_platform_transactions_manage
on public.gym_platform_payment_transactions for all to authenticated
using (public.is_service_role())
with check (public.is_service_role());

drop policy if exists gym_platform_refunds_select on public.gym_platform_refunds;
create policy gym_platform_refunds_select
on public.gym_platform_refunds for select to authenticated
using (
  public.is_service_role()
  or exists (
    select 1
    from public.gym_platform_payment_transactions gpt
    where gpt.id = gym_platform_refunds.gym_platform_payment_transaction_id
      and public.can_manage_gym_config(gpt.gym_id, auth.uid())
  )
);

drop policy if exists gym_platform_refunds_manage on public.gym_platform_refunds;
create policy gym_platform_refunds_manage
on public.gym_platform_refunds for all to authenticated
using (public.is_service_role())
with check (public.is_service_role());
