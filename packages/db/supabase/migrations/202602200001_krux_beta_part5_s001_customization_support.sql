-- KRUXT beta part 5 (s001)
-- Adds missing future-proof foundations requested by product strategy:
-- 1) Gym-level customization (branding + per-gym feature enablement)
-- 2) Billing/invoicing adapter layer (including Italy SDI/FatturaPA readiness)
-- 3) 24/7 support + agent-assist ticketing pipeline with approval controls

-- =====================================================
-- ENUMS
-- =====================================================

do $$ begin
  create type public.support_ticket_channel as enum ('in_app', 'email', 'web', 'phone', 'api');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.support_ticket_priority as enum ('low', 'normal', 'high', 'urgent');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.support_ticket_status as enum (
    'open',
    'triaged',
    'waiting_user',
    'in_progress',
    'waiting_approval',
    'resolved',
    'closed',
    'spam'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.support_actor_type as enum ('user', 'staff', 'agent', 'system');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.support_run_status as enum (
    'queued',
    'running',
    'awaiting_approval',
    'approved',
    'rejected',
    'executed',
    'failed',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.invoice_connection_status as enum ('disconnected', 'pending', 'active', 'error', 'revoked');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.invoice_delivery_status as enum (
    'queued',
    'processing',
    'submitted',
    'accepted',
    'rejected',
    'failed',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

-- =====================================================
-- GYM CUSTOMIZATION TABLES
-- =====================================================

create table if not exists public.gym_brand_settings (
  gym_id uuid primary key references public.gyms(id) on delete cascade,
  app_display_name text,
  logo_url text,
  icon_url text,
  banner_url text,
  primary_color text check (primary_color is null or primary_color ~ '^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$'),
  accent_color text check (accent_color is null or accent_color ~ '^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$'),
  background_color text check (background_color is null or background_color ~ '^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$'),
  surface_color text check (surface_color is null or surface_color ~ '^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$'),
  text_color text check (text_color is null or text_color ~ '^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$'),
  headline_font text,
  body_font text,
  stats_font text,
  launch_screen_message text,
  terms_url text,
  privacy_url text,
  support_email text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gym_feature_settings (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  feature_key text not null,
  enabled boolean not null default true,
  rollout_percentage integer not null default 100 check (rollout_percentage between 0 and 100),
  config jsonb not null default '{}'::jsonb,
  note text,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(gym_id, feature_key)
);

-- =====================================================
-- BILLING/INVOICE ADAPTER TABLES
-- =====================================================

create table if not exists public.invoice_provider_connections (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  provider_slug text not null,
  display_name text,
  connection_status public.invoice_connection_status not null default 'pending',
  environment text not null default 'test' check (environment in ('test', 'live')),
  account_identifier text,
  credentials_reference text,
  webhook_secret_reference text,
  is_default boolean not null default false,
  supported_countries text[] not null default '{}'::text[],
  metadata jsonb not null default '{}'::jsonb,
  connected_at timestamptz,
  disconnected_at timestamptz,
  last_verified_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(gym_id, provider_slug)
);

create table if not exists public.invoice_compliance_profiles (
  gym_id uuid primary key references public.gyms(id) on delete cascade,
  legal_entity_name text not null,
  vat_number text,
  tax_code text,
  registration_number text,
  tax_regime text,
  country_code char(2) not null,
  default_currency char(3) not null default 'EUR',
  invoice_scheme text not null default 'eu_vat'
    check (invoice_scheme in ('eu_vat', 'it_fatturapa', 'uk_vat', 'us_sales_tax', 'custom')),
  pec_email text,
  sdi_destination_code text,
  locale text not null default 'en-US',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoice_delivery_jobs (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  provider_connection_id uuid references public.invoice_provider_connections(id) on delete set null,
  target_country_code char(2) not null,
  delivery_channel text not null default 'provider_api'
    check (delivery_channel in ('provider_api', 'sdi', 'email', 'manual_export')),
  payload_format text not null default 'json'
    check (payload_format in ('json', 'xml_fatturapa', 'pdf', 'csv')),
  status public.invoice_delivery_status not null default 'queued',
  idempotency_key text not null unique,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_retry_at timestamptz,
  submitted_at timestamptz,
  completed_at timestamptz,
  provider_document_id text,
  provider_response jsonb not null default '{}'::jsonb,
  error_message text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================
-- SUPPORT + AGENT OPS TABLES
-- =====================================================

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number bigint generated always as identity unique,
  gym_id uuid references public.gyms(id) on delete set null,
  reporter_user_id uuid references public.profiles(id) on delete set null,
  reporter_email text,
  channel public.support_ticket_channel not null default 'in_app',
  category text not null default 'general',
  priority public.support_ticket_priority not null default 'normal',
  status public.support_ticket_status not null default 'open',
  subject text not null,
  description text not null,
  affected_surface text,
  impacted_users_count integer not null default 1 check (impacted_users_count >= 1),
  requires_human_approval boolean not null default true,
  owner_user_id uuid references public.profiles(id) on delete set null,
  ai_summary text,
  ai_triage_labels text[] not null default '{}'::text[],
  ai_recommended_actions jsonb not null default '[]'::jsonb,
  ai_confidence numeric(4,3) check (ai_confidence is null or (ai_confidence >= 0 and ai_confidence <= 1)),
  last_customer_reply_at timestamptz,
  first_response_due_at timestamptz,
  resolution_due_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  actor_type public.support_actor_type not null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor_label text,
  is_internal boolean not null default false,
  body text not null,
  attachments jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.support_automation_runs (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  agent_name text not null,
  trigger_source text not null default 'ticket_created',
  run_status public.support_run_status not null default 'queued',
  requires_approval boolean not null default true,
  approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected', 'not_required')),
  plan_json jsonb not null default '{}'::jsonb,
  proposed_changes jsonb not null default '[]'::jsonb,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  executed_at timestamptz,
  notification_sent_at timestamptz,
  result_summary text,
  result_payload jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================
-- INDEXES
-- =====================================================

create index if not exists idx_gym_feature_settings_gym_enabled
  on public.gym_feature_settings(gym_id, enabled);
create index if not exists idx_invoice_provider_connections_gym_status
  on public.invoice_provider_connections(gym_id, connection_status);
create index if not exists idx_invoice_delivery_jobs_gym_status
  on public.invoice_delivery_jobs(gym_id, status, created_at desc);
create index if not exists idx_invoice_delivery_jobs_invoice
  on public.invoice_delivery_jobs(invoice_id, created_at desc);
create index if not exists idx_support_tickets_gym_status
  on public.support_tickets(gym_id, status, priority, created_at desc);
create index if not exists idx_support_tickets_reporter
  on public.support_tickets(reporter_user_id, created_at desc);
create index if not exists idx_support_ticket_messages_ticket_time
  on public.support_ticket_messages(ticket_id, created_at desc);
create index if not exists idx_support_runs_ticket_status
  on public.support_automation_runs(ticket_id, run_status, created_at desc);

-- =====================================================
-- UPDATED_AT TRIGGERS
-- =====================================================

drop trigger if exists trg_gym_brand_settings_set_updated_at on public.gym_brand_settings;
create trigger trg_gym_brand_settings_set_updated_at
before update on public.gym_brand_settings
for each row execute function public.set_updated_at();

drop trigger if exists trg_gym_feature_settings_set_updated_at on public.gym_feature_settings;
create trigger trg_gym_feature_settings_set_updated_at
before update on public.gym_feature_settings
for each row execute function public.set_updated_at();

drop trigger if exists trg_invoice_provider_connections_set_updated_at on public.invoice_provider_connections;
create trigger trg_invoice_provider_connections_set_updated_at
before update on public.invoice_provider_connections
for each row execute function public.set_updated_at();

drop trigger if exists trg_invoice_compliance_profiles_set_updated_at on public.invoice_compliance_profiles;
create trigger trg_invoice_compliance_profiles_set_updated_at
before update on public.invoice_compliance_profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_invoice_delivery_jobs_set_updated_at on public.invoice_delivery_jobs;
create trigger trg_invoice_delivery_jobs_set_updated_at
before update on public.invoice_delivery_jobs
for each row execute function public.set_updated_at();

drop trigger if exists trg_support_tickets_set_updated_at on public.support_tickets;
create trigger trg_support_tickets_set_updated_at
before update on public.support_tickets
for each row execute function public.set_updated_at();

drop trigger if exists trg_support_automation_runs_set_updated_at on public.support_automation_runs;
create trigger trg_support_automation_runs_set_updated_at
before update on public.support_automation_runs
for each row execute function public.set_updated_at();

-- =====================================================
-- ACCESS HELPERS
-- =====================================================

create or replace function public.can_manage_gym_config(
  _gym_id uuid,
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
    from public.gyms g
    where g.id = _gym_id
      and (g.owner_user_id = _viewer or public.is_gym_staff(_gym_id, _viewer))
  );
$$;

create or replace function public.can_view_support_ticket(
  _ticket_id uuid,
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
    from public.support_tickets st
    where st.id = _ticket_id
      and (
        st.reporter_user_id = _viewer
        or st.owner_user_id = _viewer
        or (st.gym_id is not null and public.can_manage_gym_config(st.gym_id, _viewer))
      )
  );
$$;

create or replace function public.can_manage_support_ticket(
  _ticket_id uuid,
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
    from public.support_tickets st
    where st.id = _ticket_id
      and (
        st.owner_user_id = _viewer
        or (st.gym_id is not null and public.can_manage_gym_config(st.gym_id, _viewer))
      )
  );
$$;

create or replace function public.submit_support_ticket(
  p_subject text,
  p_description text,
  p_gym_id uuid default null,
  p_category text default 'general',
  p_priority public.support_ticket_priority default 'normal',
  p_channel public.support_ticket_channel default 'in_app',
  p_reporter_email text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.support_tickets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket public.support_tickets;
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  if p_gym_id is not null and not (
    public.is_gym_member(p_gym_id, v_actor)
    or public.can_manage_gym_config(p_gym_id, v_actor)
  ) then
    raise exception 'You do not have access to this gym';
  end if;

  insert into public.support_tickets (
    gym_id,
    reporter_user_id,
    reporter_email,
    channel,
    category,
    priority,
    subject,
    description,
    metadata
  )
  values (
    p_gym_id,
    v_actor,
    p_reporter_email,
    p_channel,
    coalesce(nullif(trim(p_category), ''), 'general'),
    p_priority,
    trim(p_subject),
    trim(p_description),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into v_ticket;

  perform public.append_audit_log(
    'support.ticket_created',
    'support_tickets',
    v_ticket.id,
    null,
    jsonb_build_object('ticket_number', v_ticket.ticket_number, 'gym_id', p_gym_id)
  );

  return v_ticket;
end;
$$;

create or replace function public.approve_support_automation_run(
  p_run_id uuid,
  p_approve boolean,
  p_note text default null
)
returns public.support_automation_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_run public.support_automation_runs;
  v_ticket_id uuid;
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  select sar.ticket_id into v_ticket_id
  from public.support_automation_runs sar
  where sar.id = p_run_id;

  if v_ticket_id is null then
    raise exception 'Automation run not found';
  end if;

  if not public.can_manage_support_ticket(v_ticket_id, v_actor) then
    raise exception 'Not authorized to approve this automation run';
  end if;

  update public.support_automation_runs sar
  set
    approval_status = case when p_approve then 'approved' else 'rejected' end,
    run_status = case when p_approve then 'approved' else 'rejected' end,
    approved_by = v_actor,
    approved_at = now(),
    result_summary = case
      when p_note is null then sar.result_summary
      else coalesce(sar.result_summary, '') || case when sar.result_summary is null then '' else E'\n' end || p_note
    end
  where sar.id = p_run_id
  returning sar.* into v_run;

  perform public.append_audit_log(
    case when p_approve then 'support.automation_run_approved' else 'support.automation_run_rejected' end,
    'support_automation_runs',
    v_run.id,
    p_note,
    jsonb_build_object('ticket_id', v_ticket_id)
  );

  return v_run;
end;
$$;

grant execute on function public.submit_support_ticket(
  text,
  text,
  uuid,
  text,
  public.support_ticket_priority,
  public.support_ticket_channel,
  text,
  jsonb
) to authenticated;

grant execute on function public.submit_support_ticket(
  text,
  text,
  uuid,
  text,
  public.support_ticket_priority,
  public.support_ticket_channel,
  text,
  jsonb
) to service_role;

grant execute on function public.approve_support_automation_run(uuid, boolean, text) to authenticated;
grant execute on function public.approve_support_automation_run(uuid, boolean, text) to service_role;

-- =====================================================
-- RLS
-- =====================================================

alter table public.gym_brand_settings enable row level security;
alter table public.gym_feature_settings enable row level security;
alter table public.invoice_provider_connections enable row level security;
alter table public.invoice_compliance_profiles enable row level security;
alter table public.invoice_delivery_jobs enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_ticket_messages enable row level security;
alter table public.support_automation_runs enable row level security;

-- gym_brand_settings
drop policy if exists gym_brand_settings_select on public.gym_brand_settings;
create policy gym_brand_settings_select
on public.gym_brand_settings for select to authenticated
using (public.can_view_gym(gym_id, auth.uid()));

drop policy if exists gym_brand_settings_manage on public.gym_brand_settings;
create policy gym_brand_settings_manage
on public.gym_brand_settings for all to authenticated
using (public.is_service_role() or public.can_manage_gym_config(gym_id, auth.uid()))
with check (public.is_service_role() or public.can_manage_gym_config(gym_id, auth.uid()));

-- gym_feature_settings
drop policy if exists gym_feature_settings_select on public.gym_feature_settings;
create policy gym_feature_settings_select
on public.gym_feature_settings for select to authenticated
using (public.can_view_gym(gym_id, auth.uid()));

drop policy if exists gym_feature_settings_manage on public.gym_feature_settings;
create policy gym_feature_settings_manage
on public.gym_feature_settings for all to authenticated
using (public.is_service_role() or public.can_manage_gym_config(gym_id, auth.uid()))
with check (public.is_service_role() or public.can_manage_gym_config(gym_id, auth.uid()));

-- invoice_provider_connections
drop policy if exists invoice_provider_connections_select on public.invoice_provider_connections;
create policy invoice_provider_connections_select
on public.invoice_provider_connections for select to authenticated
using (public.is_service_role() or public.can_manage_gym_config(gym_id, auth.uid()));

drop policy if exists invoice_provider_connections_manage on public.invoice_provider_connections;
create policy invoice_provider_connections_manage
on public.invoice_provider_connections for all to authenticated
using (public.is_service_role() or public.can_manage_gym_config(gym_id, auth.uid()))
with check (public.is_service_role() or public.can_manage_gym_config(gym_id, auth.uid()));

-- invoice_compliance_profiles
drop policy if exists invoice_compliance_profiles_select on public.invoice_compliance_profiles;
create policy invoice_compliance_profiles_select
on public.invoice_compliance_profiles for select to authenticated
using (public.is_service_role() or public.can_manage_gym_config(gym_id, auth.uid()));

drop policy if exists invoice_compliance_profiles_manage on public.invoice_compliance_profiles;
create policy invoice_compliance_profiles_manage
on public.invoice_compliance_profiles for all to authenticated
using (public.is_service_role() or public.can_manage_gym_config(gym_id, auth.uid()))
with check (public.is_service_role() or public.can_manage_gym_config(gym_id, auth.uid()));

-- invoice_delivery_jobs
drop policy if exists invoice_delivery_jobs_select on public.invoice_delivery_jobs;
create policy invoice_delivery_jobs_select
on public.invoice_delivery_jobs for select to authenticated
using (public.is_service_role() or public.can_manage_gym_config(gym_id, auth.uid()));

drop policy if exists invoice_delivery_jobs_manage on public.invoice_delivery_jobs;
create policy invoice_delivery_jobs_manage
on public.invoice_delivery_jobs for all to authenticated
using (public.is_service_role() or public.can_manage_gym_config(gym_id, auth.uid()))
with check (public.is_service_role() or public.can_manage_gym_config(gym_id, auth.uid()));

-- support_tickets
drop policy if exists support_tickets_select on public.support_tickets;
create policy support_tickets_select
on public.support_tickets for select to authenticated
using (
  public.is_service_role()
  or public.can_view_support_ticket(id, auth.uid())
);

drop policy if exists support_tickets_insert on public.support_tickets;
create policy support_tickets_insert
on public.support_tickets for insert to authenticated
with check (
  public.is_service_role()
  or (
    reporter_user_id = auth.uid()
    and (
      gym_id is null
      or public.is_gym_member(gym_id, auth.uid())
      or public.can_manage_gym_config(gym_id, auth.uid())
    )
  )
);

drop policy if exists support_tickets_update on public.support_tickets;
create policy support_tickets_update
on public.support_tickets for update to authenticated
using (
  public.is_service_role()
  or public.can_manage_support_ticket(id, auth.uid())
)
with check (
  public.is_service_role()
  or public.can_manage_support_ticket(id, auth.uid())
);

drop policy if exists support_tickets_delete on public.support_tickets;
create policy support_tickets_delete
on public.support_tickets for delete to authenticated
using (public.is_service_role());

-- support_ticket_messages
drop policy if exists support_ticket_messages_select on public.support_ticket_messages;
create policy support_ticket_messages_select
on public.support_ticket_messages for select to authenticated
using (
  public.is_service_role()
  or public.can_view_support_ticket(ticket_id, auth.uid())
);

drop policy if exists support_ticket_messages_insert on public.support_ticket_messages;
create policy support_ticket_messages_insert
on public.support_ticket_messages for insert to authenticated
with check (
  public.is_service_role()
  or (
    public.can_view_support_ticket(ticket_id, auth.uid())
    and (actor_user_id is null or actor_user_id = auth.uid())
  )
);

drop policy if exists support_ticket_messages_update on public.support_ticket_messages;
create policy support_ticket_messages_update
on public.support_ticket_messages for update to authenticated
using (
  public.is_service_role()
  or public.can_manage_support_ticket(ticket_id, auth.uid())
)
with check (
  public.is_service_role()
  or public.can_manage_support_ticket(ticket_id, auth.uid())
);

drop policy if exists support_ticket_messages_delete on public.support_ticket_messages;
create policy support_ticket_messages_delete
on public.support_ticket_messages for delete to authenticated
using (
  public.is_service_role()
  or public.can_manage_support_ticket(ticket_id, auth.uid())
);

-- support_automation_runs
drop policy if exists support_automation_runs_select on public.support_automation_runs;
create policy support_automation_runs_select
on public.support_automation_runs for select to authenticated
using (
  public.is_service_role()
  or public.can_manage_support_ticket(ticket_id, auth.uid())
);

drop policy if exists support_automation_runs_insert on public.support_automation_runs;
create policy support_automation_runs_insert
on public.support_automation_runs for insert to authenticated
with check (
  public.is_service_role()
  or public.can_manage_support_ticket(ticket_id, auth.uid())
);

drop policy if exists support_automation_runs_update on public.support_automation_runs;
create policy support_automation_runs_update
on public.support_automation_runs for update to authenticated
using (
  public.is_service_role()
  or public.can_manage_support_ticket(ticket_id, auth.uid())
)
with check (
  public.is_service_role()
  or public.can_manage_support_ticket(ticket_id, auth.uid())
);

drop policy if exists support_automation_runs_delete on public.support_automation_runs;
create policy support_automation_runs_delete
on public.support_automation_runs for delete to authenticated
using (public.is_service_role());
