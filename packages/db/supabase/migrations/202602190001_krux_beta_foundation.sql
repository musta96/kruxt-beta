-- KRUXT Beta Foundation Migration
-- Date: 2026-02-19
-- Notes:
-- - Full B2C + B2B + compliance foundation
-- - Apple + Garmin integration enabled by default via feature flags
-- - Billing modeled but disabled by default

create extension if not exists "pgcrypto";

-- =====================================================
-- ENUMS
-- =====================================================

do $$ begin create type public.rank_tier as enum (
  'initiate','apprentice','trainee','grinder','forged','vanguard',
  'sentinel','warden','champion','paragon','titan','legend'
); exception when duplicate_object then null; end $$;

do $$ begin create type public.workout_visibility as enum ('public','followers','gym','private');
exception when duplicate_object then null; end $$;

do $$ begin create type public.workout_type as enum ('strength','functional','hyrox','crossfit','conditioning','custom');
exception when duplicate_object then null; end $$;

do $$ begin create type public.workout_block_type as enum ('straight_set','superset','circuit','emom','amrap');
exception when duplicate_object then null; end $$;

do $$ begin create type public.social_connection_status as enum ('pending','accepted','blocked');
exception when duplicate_object then null; end $$;

do $$ begin create type public.social_interaction_type as enum ('reaction','comment');
exception when duplicate_object then null; end $$;

do $$ begin create type public.reaction_type as enum ('fist','fire','shield','clap','crown');
exception when duplicate_object then null; end $$;

do $$ begin create type public.challenge_visibility as enum ('public','gym','invite_only');
exception when duplicate_object then null; end $$;

do $$ begin create type public.challenge_type as enum ('volume','consistency','max_effort','time_based');
exception when duplicate_object then null; end $$;

do $$ begin create type public.leaderboard_scope as enum ('global','gym','exercise','challenge');
exception when duplicate_object then null; end $$;

do $$ begin create type public.leaderboard_metric as enum (
  'xp','volume_kg','estimated_1rm','consistency_days','challenge_score'
); exception when duplicate_object then null; end $$;

do $$ begin create type public.leaderboard_timeframe as enum ('daily','weekly','monthly','all_time');
exception when duplicate_object then null; end $$;

do $$ begin create type public.gym_role as enum ('leader','officer','coach','member');
exception when duplicate_object then null; end $$;

do $$ begin create type public.membership_status as enum ('pending','trial','active','paused','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin create type public.class_status as enum ('scheduled','cancelled','completed');
exception when duplicate_object then null; end $$;

do $$ begin create type public.booking_status as enum ('booked','waitlisted','cancelled','attended','no_show');
exception when duplicate_object then null; end $$;

do $$ begin create type public.billing_interval as enum ('monthly','quarterly','yearly','dropin');
exception when duplicate_object then null; end $$;

do $$ begin create type public.integration_provider as enum (
  'apple_health','garmin','fitbit','huawei_health','suunto','oura','whoop','manual'
); exception when duplicate_object then null; end $$;

do $$ begin create type public.integration_connection_status as enum ('active','revoked','expired','error');
exception when duplicate_object then null; end $$;

do $$ begin create type public.sync_job_status as enum ('queued','running','succeeded','failed','retry_scheduled');
exception when duplicate_object then null; end $$;

do $$ begin create type public.integration_processing_status as enum ('pending','processed','failed','ignored');
exception when duplicate_object then null; end $$;

do $$ begin create type public.waitlist_status as enum ('pending','promoted','expired','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin create type public.subscription_status as enum (
  'incomplete','trialing','active','past_due','paused','canceled','unpaid'
); exception when duplicate_object then null; end $$;

do $$ begin create type public.payment_status as enum (
  'draft','open','paid','void','uncollectible','refunded','partially_refunded','failed'
); exception when duplicate_object then null; end $$;

do $$ begin create type public.refund_status as enum ('pending','succeeded','failed','canceled');
exception when duplicate_object then null; end $$;

do $$ begin create type public.dunning_stage as enum (
  'payment_failed','retry_1','retry_2','retry_3','final_notice','cancelled'
); exception when duplicate_object then null; end $$;

do $$ begin create type public.access_event_type as enum (
  'door_checkin','door_denied','frontdesk_checkin','manual_override'
); exception when duplicate_object then null; end $$;

do $$ begin create type public.access_result as enum ('allowed','denied','override_allowed');
exception when duplicate_object then null; end $$;

do $$ begin create type public.consent_type as enum (
  'terms','privacy','health_data_processing','marketing_email','push_notifications'
); exception when duplicate_object then null; end $$;

do $$ begin create type public.privacy_request_type as enum (
  'access','export','delete','rectify','restrict_processing'
); exception when duplicate_object then null; end $$;

do $$ begin create type public.privacy_request_status as enum (
  'submitted','in_review','completed','rejected'
); exception when duplicate_object then null; end $$;

do $$ begin create type public.policy_type as enum (
  'terms','privacy','health_data','waiver'
); exception when duplicate_object then null; end $$;

do $$ begin create type public.report_target_type as enum ('workout','comment','profile','gym');
exception when duplicate_object then null; end $$;

-- =====================================================
-- UTILITY FUNCTIONS
-- =====================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_service_role()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt()->>'role', '') = 'service_role';
$$;

create or replace function public.calculate_level_from_xp(_xp integer)
returns integer
language sql
immutable
as $$
  select least(50, greatest(1, floor(sqrt(greatest(_xp, 0)::numeric / 100.0) + 1)::int));
$$;

-- =====================================================
-- CORE TABLES
-- =====================================================

create table if not exists public.feature_flags (
  key text primary key,
  description text not null,
  enabled boolean not null default false,
  rollout_percentage integer not null default 100 check (rollout_percentage between 0 and 100),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gyms (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  motto text,
  description text,
  sigil_url text,
  banner_url text,
  city text,
  country_code char(2),
  timezone text not null default 'UTC',
  is_public boolean not null default true,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  payment_provider text,
  provider_account_id text,
  payouts_enabled boolean not null default false,
  charges_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (char_length(username) between 3 and 24),
  display_name text not null,
  avatar_url text,
  bio text,
  home_gym_id uuid references public.gyms(id) on delete set null,
  is_public boolean not null default true,
  xp_total integer not null default 0 check (xp_total >= 0),
  level integer not null default 1 check (level between 1 and 50),
  rank_tier public.rank_tier not null default 'initiate',
  chain_days integer not null default 0 check (chain_days >= 0),
  last_workout_at timestamptz,
  locale text,
  preferred_units text not null default 'metric' check (preferred_units in ('metric','imperial')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  category text not null,
  movement_pattern text,
  equipment text,
  is_public boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(name, created_by)
);

create table if not exists public.social_connections (
  id uuid primary key default gen_random_uuid(),
  follower_user_id uuid not null references public.profiles(id) on delete cascade,
  followed_user_id uuid not null references public.profiles(id) on delete cascade,
  status public.social_connection_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(follower_user_id, followed_user_id),
  check (follower_user_id <> followed_user_id)
);

create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  gym_id uuid references public.gyms(id) on delete set null,
  title text not null,
  workout_type public.workout_type not null default 'strength',
  notes text,
  started_at timestamptz not null,
  ended_at timestamptz,
  rpe numeric(3,1) check (rpe between 0 and 10),
  visibility public.workout_visibility not null default 'public',
  total_sets integer not null default 0 check (total_sets >= 0),
  total_volume_kg numeric(12,2) not null default 0 check (total_volume_kg >= 0),
  is_pr boolean not null default false,
  source public.integration_provider not null default 'manual',
  external_activity_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);

create table if not exists public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  order_index integer not null check (order_index >= 1),
  block_id uuid,
  block_type public.workout_block_type not null default 'straight_set',
  target_reps text,
  target_weight_kg numeric(8,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workout_id, order_index)
);

create table if not exists public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null references public.workout_exercises(id) on delete cascade,
  set_index integer not null check (set_index >= 1),
  reps integer check (reps is null or reps >= 0),
  weight_kg numeric(8,2) check (weight_kg is null or weight_kg >= 0),
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  distance_m integer check (distance_m is null or distance_m >= 0),
  rpe numeric(3,1) check (rpe is null or (rpe >= 0 and rpe <= 10)),
  is_pr boolean not null default false,
  completed_at timestamptz not null default now(),
  unique(workout_exercise_id, set_index)
);

create table if not exists public.feed_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  workout_id uuid references public.workouts(id) on delete cascade,
  event_type text not null default 'workout_logged',
  caption text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.social_interactions (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  actor_user_id uuid not null references public.profiles(id) on delete cascade,
  interaction_type public.social_interaction_type not null,
  reaction_type public.reaction_type,
  comment_text text,
  parent_interaction_id uuid references public.social_interactions(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (interaction_type = 'reaction' and reaction_type is not null and comment_text is null)
    or
    (interaction_type = 'comment' and comment_text is not null)
  )
);

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  creator_user_id uuid not null references public.profiles(id) on delete cascade,
  gym_id uuid references public.gyms(id) on delete cascade,
  title text not null,
  description text,
  challenge_type public.challenge_type not null,
  visibility public.challenge_visibility not null default 'public',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  points_per_unit integer not null default 1 check (points_per_unit > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.challenge_participants (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  score numeric(12,2) not null default 0,
  completed boolean not null default false,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(challenge_id, user_id)
);

create table if not exists public.leaderboards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  scope public.leaderboard_scope not null,
  scope_gym_id uuid references public.gyms(id) on delete cascade,
  scope_exercise_id uuid references public.exercises(id) on delete cascade,
  scope_challenge_id uuid references public.challenges(id) on delete cascade,
  metric public.leaderboard_metric not null,
  timeframe public.leaderboard_timeframe not null default 'weekly',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  constraint leaderboards_scope_ref_ck check (
    (scope = 'global' and scope_gym_id is null and scope_exercise_id is null and scope_challenge_id is null) or
    (scope = 'gym' and scope_gym_id is not null and scope_exercise_id is null and scope_challenge_id is null) or
    (scope = 'exercise' and scope_exercise_id is not null and scope_challenge_id is null) or
    (scope = 'challenge' and scope_challenge_id is not null)
  )
);

create table if not exists public.leaderboard_entries (
  id uuid primary key default gen_random_uuid(),
  leaderboard_id uuid not null references public.leaderboards(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rank integer not null check (rank > 0),
  score numeric(14,3) not null,
  details jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now(),
  unique(leaderboard_id, user_id),
  unique(leaderboard_id, rank)
);

-- =====================================================
-- B2B TABLES
-- =====================================================

create table if not exists public.gym_membership_plans (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  name text not null,
  billing_cycle public.billing_interval not null,
  price_cents integer not null check (price_cents >= 0),
  currency char(3) not null default 'USD',
  class_credits_per_cycle integer,
  trial_days integer check (trial_days is null or trial_days >= 0),
  cancel_policy text,
  provider_product_id text,
  provider_price_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(gym_id, name)
);

create table if not exists public.gym_memberships (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.gym_role not null default 'member',
  membership_status public.membership_status not null default 'pending',
  membership_plan_id uuid references public.gym_membership_plans(id) on delete set null,
  started_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(gym_id, user_id)
);

create table if not exists public.gym_classes (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  coach_user_id uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  capacity integer not null check (capacity > 0),
  status public.class_status not null default 'scheduled',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  booking_opens_at timestamptz,
  booking_closes_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.class_bookings (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.gym_classes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status public.booking_status not null default 'booked',
  booked_at timestamptz not null default now(),
  checked_in_at timestamptz,
  source_channel text not null default 'app',
  updated_at timestamptz not null default now(),
  unique(class_id, user_id)
);

create table if not exists public.class_waitlist (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.gym_classes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  position integer not null check (position > 0),
  status public.waitlist_status not null default 'pending',
  notified_at timestamptz,
  expires_at timestamptz,
  promoted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(class_id, user_id)
);

create table if not exists public.waivers (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  title text not null,
  policy_version text not null,
  language_code text not null default 'en',
  document_url text not null,
  is_active boolean not null default true,
  effective_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(gym_id, title, policy_version)
);

create table if not exists public.waiver_acceptances (
  id uuid primary key default gen_random_uuid(),
  waiver_id uuid not null references public.waivers(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  gym_membership_id uuid references public.gym_memberships(id) on delete set null,
  accepted_at timestamptz not null default now(),
  source text not null default 'mobile',
  locale text,
  ip_address text,
  user_agent text,
  signature_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(waiver_id, user_id)
);

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  title text not null,
  contract_type text not null default 'membership',
  policy_version text not null,
  language_code text not null default 'en',
  document_url text not null,
  is_active boolean not null default true,
  effective_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(gym_id, title, policy_version)
);

create table if not exists public.contract_acceptances (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  gym_membership_id uuid references public.gym_memberships(id) on delete set null,
  accepted_at timestamptz not null default now(),
  source text not null default 'mobile',
  locale text,
  ip_address text,
  user_agent text,
  signature_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(contract_id, user_id)
);

create table if not exists public.gym_checkins (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  membership_id uuid references public.gym_memberships(id) on delete set null,
  class_id uuid references public.gym_classes(id) on delete set null,
  event_type public.access_event_type not null,
  result public.access_result not null,
  source_channel text not null default 'app',
  note text,
  checked_in_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.access_logs (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  checkin_id uuid references public.gym_checkins(id) on delete set null,
  event_type public.access_event_type not null,
  result public.access_result not null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);

create or replace view public.checkins as
select * from public.gym_checkins;

-- =====================================================
-- BILLING TABLES (SCHEMA READY, FEATURE FLAGGED)
-- =====================================================

create table if not exists public.member_subscriptions (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  membership_plan_id uuid references public.gym_membership_plans(id) on delete set null,
  status public.subscription_status not null default 'incomplete',
  provider text not null default 'stripe',
  provider_customer_id text,
  provider_subscription_id text unique,
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  cancel_at timestamptz,
  canceled_at timestamptz,
  payment_method_last4 text,
  payment_method_brand text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references public.member_subscriptions(id) on delete set null,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider_invoice_id text unique,
  status public.payment_status not null default 'draft',
  currency char(3) not null default 'USD',
  subtotal_cents integer not null default 0,
  tax_cents integer not null default 0,
  total_cents integer not null default 0,
  amount_paid_cents integer not null default 0,
  amount_due_cents integer not null default 0,
  due_at timestamptz,
  paid_at timestamptz,
  invoice_pdf_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references public.invoices(id) on delete set null,
  subscription_id uuid references public.member_subscriptions(id) on delete set null,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  provider text not null default 'stripe',
  provider_payment_intent_id text,
  provider_charge_id text unique,
  status public.payment_status not null default 'open',
  payment_method_type text,
  amount_cents integer not null check (amount_cents >= 0),
  fee_cents integer not null default 0,
  tax_cents integer not null default 0,
  net_cents integer generated always as (amount_cents - fee_cents - tax_cents) stored,
  currency char(3) not null default 'USD',
  failure_code text,
  failure_message text,
  captured_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_transaction_id uuid not null references public.payment_transactions(id) on delete cascade,
  provider_refund_id text unique,
  status public.refund_status not null default 'pending',
  amount_cents integer not null check (amount_cents >= 0),
  currency char(3) not null default 'USD',
  reason text,
  processed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dunning_events (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.member_subscriptions(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete set null,
  stage public.dunning_stage not null,
  attempt_number integer not null default 1,
  scheduled_for timestamptz,
  sent_at timestamptz,
  result text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================
-- DEVICE INTEGRATION TABLES
-- =====================================================

create table if not exists public.device_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider public.integration_provider not null,
  status public.integration_connection_status not null default 'active',
  provider_user_id text,
  scopes text[] not null default '{}'::text[],
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  last_synced_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, provider)
);

create table if not exists public.device_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.device_connections(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider public.integration_provider not null,
  job_type text not null default 'pull_activities',
  status public.sync_job_status not null default 'queued',
  cursor jsonb not null default '{}'::jsonb,
  requested_by uuid references public.profiles(id) on delete set null,
  retry_count integer not null default 0,
  next_retry_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.external_activity_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  connection_id uuid not null references public.device_connections(id) on delete cascade,
  provider public.integration_provider not null,
  external_activity_id text not null,
  activity_type text,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  distance_m integer,
  calories integer,
  average_hr integer,
  max_hr integer,
  raw_data jsonb not null default '{}'::jsonb,
  mapped_workout_id uuid references public.workouts(id) on delete set null,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(user_id, provider, external_activity_id)
);

create table if not exists public.integration_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider public.integration_provider not null,
  provider_event_id text not null,
  event_type text not null,
  payload_hash text not null,
  payload_json jsonb not null,
  processing_status public.integration_processing_status not null default 'pending',
  retry_count integer not null default 0,
  next_retry_at timestamptz,
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique(provider, provider_event_id),
  unique(provider, payload_hash)
);

-- =====================================================
-- SOCIAL SAFETY + NOTIFICATION TABLES
-- =====================================================

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  push_enabled boolean not null default true,
  email_enabled boolean not null default false,
  in_app_enabled boolean not null default true,
  marketing_enabled boolean not null default false,
  workout_reactions_enabled boolean not null default true,
  comments_enabled boolean not null default true,
  challenge_updates_enabled boolean not null default true,
  class_reminders_enabled boolean not null default true,
  quiet_hours_start time,
  quiet_hours_end time,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_user_id uuid not null references public.profiles(id) on delete cascade,
  blocked_user_id uuid not null references public.profiles(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  unique(blocker_user_id, blocked_user_id),
  check (blocker_user_id <> blocked_user_id)
);

create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references public.profiles(id) on delete cascade,
  target_type public.report_target_type not null,
  target_id uuid not null,
  reason text not null,
  details text,
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace view public.user_blocks_reports as
select
  b.id,
  b.blocker_user_id as actor_user_id,
  b.blocked_user_id as target_user_id,
  'block'::text as record_type,
  b.reason,
  b.created_at,
  null::text as status
from public.user_blocks b
union all
select
  r.id,
  r.reporter_user_id as actor_user_id,
  r.target_id as target_user_id,
  'report'::text as record_type,
  r.reason,
  r.created_at,
  r.status
from public.user_reports r;

-- =====================================================
-- COMPLIANCE TABLES
-- =====================================================

create table if not exists public.policy_version_tracking (
  id uuid primary key default gen_random_uuid(),
  policy_type public.policy_type not null,
  version text not null,
  label text,
  document_url text not null,
  checksum text,
  effective_at timestamptz not null,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(policy_type, version)
);

create table if not exists public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  consent_type public.consent_type not null,
  policy_version_id uuid references public.policy_version_tracking(id) on delete set null,
  granted boolean not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  source text not null default 'mobile',
  locale text,
  ip_address text,
  user_agent text,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  request_type public.privacy_request_type not null,
  status public.privacy_request_status not null default 'submitted',
  reason text,
  submitted_at timestamptz not null default now(),
  due_at timestamptz not null default (now() + interval '30 days'),
  resolved_at timestamptz,
  response_location text,
  handled_by uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor_role text,
  action text not null,
  target_table text,
  target_id uuid,
  reason text,
  ip_address text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.event_outbox (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  aggregate_type text not null,
  aggregate_id uuid,
  payload jsonb not null,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  published_at timestamptz
);

-- =====================================================
-- INDEXES
-- =====================================================

create index if not exists idx_profiles_home_gym on public.profiles(home_gym_id);
create index if not exists idx_workouts_user_started_at on public.workouts(user_id, started_at desc);
create index if not exists idx_workouts_visibility_started_at on public.workouts(visibility, started_at desc);
create index if not exists idx_workouts_gym_started_at on public.workouts(gym_id, started_at desc);
create index if not exists idx_workout_exercises_workout_order on public.workout_exercises(workout_id, order_index);
create index if not exists idx_workout_sets_we_set on public.workout_sets(workout_exercise_id, set_index);
create index if not exists idx_feed_events_created_at on public.feed_events(created_at desc);
create index if not exists idx_social_interactions_workout on public.social_interactions(workout_id, created_at desc);
create index if not exists idx_social_interactions_actor on public.social_interactions(actor_user_id, created_at desc);
create unique index if not exists idx_social_one_reaction_per_user
  on public.social_interactions(workout_id, actor_user_id)
  where interaction_type = 'reaction';
create index if not exists idx_social_connections_followed on public.social_connections(followed_user_id, status);
create index if not exists idx_social_connections_follower on public.social_connections(follower_user_id, status);
create index if not exists idx_challenge_participants_user on public.challenge_participants(user_id);
create index if not exists idx_leaderboard_entries_lb_rank on public.leaderboard_entries(leaderboard_id, rank);
create index if not exists idx_leaderboard_entries_user on public.leaderboard_entries(user_id, calculated_at desc);
create index if not exists idx_gym_memberships_user_status on public.gym_memberships(user_id, membership_status);
create index if not exists idx_gym_classes_gym_start on public.gym_classes(gym_id, starts_at);
create index if not exists idx_class_bookings_user_status on public.class_bookings(user_id, status);
create index if not exists idx_class_waitlist_class_position on public.class_waitlist(class_id, status, position);
create index if not exists idx_contracts_gym_active on public.contracts(gym_id, is_active, effective_at desc);
create index if not exists idx_contract_acceptances_user_time on public.contract_acceptances(user_id, accepted_at desc);
create index if not exists idx_gym_checkins_user_time on public.gym_checkins(user_id, checked_in_at desc);
create index if not exists idx_access_logs_gym_time on public.access_logs(gym_id, created_at desc);
create index if not exists idx_member_subscriptions_user on public.member_subscriptions(user_id, status);
create index if not exists idx_invoices_gym_status on public.invoices(gym_id, status, due_at);
create index if not exists idx_payment_transactions_invoice on public.payment_transactions(invoice_id, status);
create index if not exists idx_refunds_payment on public.refunds(payment_transaction_id, status);
create index if not exists idx_dunning_subscription on public.dunning_events(subscription_id, stage, created_at desc);
create index if not exists idx_device_connections_user_provider on public.device_connections(user_id, provider);
create index if not exists idx_sync_jobs_connection_status on public.device_sync_jobs(connection_id, status, created_at desc);
create index if not exists idx_external_activity_imports_user_time on public.external_activity_imports(user_id, imported_at desc);
create index if not exists idx_webhook_events_status on public.integration_webhook_events(processing_status, received_at);
create index if not exists idx_user_blocks_blocker on public.user_blocks(blocker_user_id);
create index if not exists idx_user_reports_status on public.user_reports(status, created_at desc);
create index if not exists idx_consents_user_type on public.consents(user_id, consent_type, granted_at desc);
create index if not exists idx_privacy_requests_user_status on public.privacy_requests(user_id, status);
create index if not exists idx_audit_logs_actor_time on public.audit_logs(actor_user_id, created_at desc);
create index if not exists idx_event_outbox_published on public.event_outbox(published, created_at);

-- =====================================================
-- ACCESS / BUSINESS LOGIC HELPERS
-- =====================================================

create or replace function public.is_gym_member(_gym_id uuid, _viewer uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.gym_memberships gm
    where gm.gym_id = _gym_id
      and gm.user_id = _viewer
      and gm.membership_status in ('trial','active')
  );
$$;

create or replace function public.is_gym_staff(_gym_id uuid, _viewer uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.gym_memberships gm
    where gm.gym_id = _gym_id
      and gm.user_id = _viewer
      and gm.membership_status in ('trial','active')
      and gm.role in ('leader','officer','coach')
  );
$$;

create or replace function public.can_view_gym(_gym_id uuid, _viewer uuid default auth.uid())
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
      and (g.is_public or public.is_gym_member(_gym_id, _viewer))
  );
$$;

create or replace function public.can_view_workout(
  _owner uuid,
  _visibility public.workout_visibility,
  _gym_id uuid,
  _viewer uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    _viewer = _owner
    or _visibility = 'public'
    or (
      _visibility = 'followers'
      and exists (
        select 1
        from public.social_connections sc
        where sc.follower_user_id = _viewer
          and sc.followed_user_id = _owner
          and sc.status = 'accepted'
      )
    )
    or (
      _visibility = 'gym'
      and _gym_id is not null
      and public.is_gym_member(_gym_id, _viewer)
    );
$$;

create or replace function public.can_manage_subscription(_subscription_id uuid, _viewer uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.member_subscriptions ms
    where ms.id = _subscription_id
      and (
        ms.user_id = _viewer
        or public.is_gym_staff(ms.gym_id, _viewer)
      )
  );
$$;

create or replace function public.refresh_workout_totals(_workout_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.workouts w
  set
    total_sets = coalesce(x.total_sets, 0),
    total_volume_kg = coalesce(x.total_volume, 0)
  from (
    select
      we.workout_id,
      count(ws.id)::int as total_sets,
      coalesce(sum(coalesce(ws.weight_kg, 0) * coalesce(ws.reps, 0)), 0)::numeric(12,2) as total_volume
    from public.workout_exercises we
    left join public.workout_sets ws on ws.workout_exercise_id = we.id
    where we.workout_id = _workout_id
    group by we.workout_id
  ) x
  where w.id = x.workout_id;

  update public.workouts w
  set total_sets = 0,
      total_volume_kg = 0
  where w.id = _workout_id
    and not exists (
      select 1
      from public.workout_exercises we
      where we.workout_id = _workout_id
    );
end;
$$;

create or replace function public.refresh_workout_totals_from_set_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workout_id uuid;
begin
  if tg_op = 'DELETE' then
    select we.workout_id into v_workout_id
    from public.workout_exercises we
    where we.id = old.workout_exercise_id;
  else
    select we.workout_id into v_workout_id
    from public.workout_exercises we
    where we.id = new.workout_exercise_id;
  end if;

  if v_workout_id is not null then
    perform public.refresh_workout_totals(v_workout_id);
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.apply_workout_progress_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_xp_gain integer;
begin
  v_xp_gain := 10 + coalesce(new.total_sets, 0);

  update public.profiles p
  set
    xp_total = p.xp_total + v_xp_gain,
    level = public.calculate_level_from_xp(p.xp_total + v_xp_gain),
    chain_days = case
      when p.last_workout_at is null then 1
      when p.last_workout_at::date = new.started_at::date then p.chain_days
      when p.last_workout_at::date = (new.started_at::date - 1) then p.chain_days + 1
      else 1
    end,
    last_workout_at = greatest(coalesce(p.last_workout_at, new.started_at), new.started_at)
  where p.id = new.user_id;

  insert into public.event_outbox(event_type, aggregate_type, aggregate_id, payload)
  values (
    'workout.logged',
    'workout',
    new.id,
    jsonb_build_object('user_id', new.user_id, 'workout_id', new.id, 'xp_gain', v_xp_gain)
  );

  return new;
end;
$$;

create or replace function public.create_workout_feed_event_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.feed_events(user_id, workout_id, event_type, caption, metadata)
  values (
    new.user_id,
    new.id,
    'workout_logged',
    'Post the proof.',
    jsonb_build_object('visibility', new.visibility, 'workout_type', new.workout_type)
  );

  return new;
end;
$$;

create or replace function public.append_audit_log(
  _action text,
  _target_table text,
  _target_id uuid,
  _reason text default null,
  _metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.audit_logs(
    actor_user_id,
    actor_role,
    action,
    target_table,
    target_id,
    reason,
    metadata
  )
  values (
    auth.uid(),
    coalesce(auth.jwt()->>'role', 'authenticated'),
    _action,
    _target_table,
    _target_id,
    _reason,
    _metadata
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- =====================================================
-- RPC FUNCTIONS
-- =====================================================

create or replace function public.log_workout_atomic(
  p_workout jsonb,
  p_exercises jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workout_id uuid;
  v_workout_exercise_id uuid;
  v_exercise jsonb;
  v_set jsonb;
  v_order integer := 1;
  v_set_idx integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.workouts(
    user_id,
    gym_id,
    title,
    workout_type,
    notes,
    started_at,
    ended_at,
    rpe,
    visibility,
    source,
    external_activity_id
  )
  values (
    auth.uid(),
    nullif(p_workout->>'gym_id', '')::uuid,
    coalesce(p_workout->>'title', 'Workout Session'),
    coalesce((p_workout->>'workout_type')::public.workout_type, 'strength'),
    p_workout->>'notes',
    coalesce((p_workout->>'started_at')::timestamptz, now()),
    nullif(p_workout->>'ended_at', '')::timestamptz,
    nullif(p_workout->>'rpe', '')::numeric,
    coalesce((p_workout->>'visibility')::public.workout_visibility, 'public'),
    coalesce((p_workout->>'source')::public.integration_provider, 'manual'),
    p_workout->>'external_activity_id'
  )
  returning id into v_workout_id;

  if jsonb_typeof(p_exercises) = 'array' then
    for v_exercise in select value from jsonb_array_elements(p_exercises)
    loop
      insert into public.workout_exercises(
        workout_id,
        exercise_id,
        order_index,
        block_id,
        block_type,
        target_reps,
        target_weight_kg,
        notes
      )
      values (
        v_workout_id,
        (v_exercise->>'exercise_id')::uuid,
        coalesce((v_exercise->>'order_index')::integer, v_order),
        nullif(v_exercise->>'block_id', '')::uuid,
        coalesce((v_exercise->>'block_type')::public.workout_block_type, 'straight_set'),
        v_exercise->>'target_reps',
        nullif(v_exercise->>'target_weight_kg', '')::numeric,
        v_exercise->>'notes'
      )
      returning id into v_workout_exercise_id;

      v_order := v_order + 1;
      v_set_idx := 1;

      if jsonb_typeof(v_exercise->'sets') = 'array' then
        for v_set in select value from jsonb_array_elements(v_exercise->'sets')
        loop
          insert into public.workout_sets(
            workout_exercise_id,
            set_index,
            reps,
            weight_kg,
            duration_seconds,
            distance_m,
            rpe,
            is_pr
          )
          values (
            v_workout_exercise_id,
            coalesce((v_set->>'set_index')::integer, v_set_idx),
            nullif(v_set->>'reps', '')::integer,
            nullif(v_set->>'weight_kg', '')::numeric,
            nullif(v_set->>'duration_seconds', '')::integer,
            nullif(v_set->>'distance_m', '')::integer,
            nullif(v_set->>'rpe', '')::numeric,
            coalesce((v_set->>'is_pr')::boolean, false)
          );

          v_set_idx := v_set_idx + 1;
        end loop;
      end if;
    end loop;
  end if;

  perform public.refresh_workout_totals(v_workout_id);

  return v_workout_id;
end;
$$;

create or replace function public.join_waitlist(p_class_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_position integer;
  v_waitlist_id uuid;
  v_class_status public.class_status;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select status
  into v_class_status
  from public.gym_classes
  where id = p_class_id;

  if v_class_status is null then
    raise exception 'Class not found';
  end if;

  if v_class_status <> 'scheduled' then
    raise exception 'Class is not open for waitlist';
  end if;

  select coalesce(max(position), 0) + 1
  into v_position
  from public.class_waitlist
  where class_id = p_class_id
    and status = 'pending';

  insert into public.class_waitlist(class_id, user_id, position, status)
  values (p_class_id, auth.uid(), v_position, 'pending')
  on conflict (class_id, user_id)
  do update
    set status = 'pending',
        updated_at = now(),
        position = excluded.position
  returning id into v_waitlist_id;

  perform public.append_audit_log(
    'waitlist.joined',
    'class_waitlist',
    v_waitlist_id,
    'User joined class waitlist',
    jsonb_build_object('class_id', p_class_id)
  );

  return v_waitlist_id;
end;
$$;

create or replace function public.promote_waitlist_member(p_class_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gym_id uuid;
  v_capacity integer;
  v_booked integer;
  v_waitlist_row public.class_waitlist%rowtype;
  v_booking_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select gym_id, capacity
  into v_gym_id, v_capacity
  from public.gym_classes
  where id = p_class_id;

  if v_gym_id is null then
    raise exception 'Class not found';
  end if;

  if not public.is_gym_staff(v_gym_id, auth.uid()) then
    raise exception 'Only gym staff can promote waitlist members';
  end if;

  select count(*)::integer
  into v_booked
  from public.class_bookings cb
  where cb.class_id = p_class_id
    and cb.status in ('booked', 'attended');

  if v_booked >= v_capacity then
    raise exception 'Class is still full';
  end if;

  select *
  into v_waitlist_row
  from public.class_waitlist cw
  where cw.class_id = p_class_id
    and cw.status = 'pending'
  order by cw.position asc
  limit 1
  for update skip locked;

  if v_waitlist_row.id is null then
    raise exception 'No pending waitlist members';
  end if;

  insert into public.class_bookings(class_id, user_id, status, source_channel)
  values (p_class_id, v_waitlist_row.user_id, 'booked', 'waitlist_promotion')
  on conflict (class_id, user_id)
  do update
    set status = 'booked',
        updated_at = now(),
        source_channel = 'waitlist_promotion'
  returning id into v_booking_id;

  update public.class_waitlist
  set status = 'promoted',
      promoted_at = now(),
      updated_at = now()
  where id = v_waitlist_row.id;

  insert into public.event_outbox(event_type, aggregate_type, aggregate_id, payload)
  values (
    'class.waitlist_promoted',
    'class',
    p_class_id,
    jsonb_build_object('booking_id', v_booking_id, 'user_id', v_waitlist_row.user_id)
  );

  perform public.append_audit_log(
    'waitlist.promoted',
    'class_waitlist',
    v_waitlist_row.id,
    'Staff promoted waitlist user',
    jsonb_build_object('class_id', p_class_id, 'booking_id', v_booking_id)
  );

  return v_booking_id;
end;
$$;

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

create or replace function public.rebuild_leaderboard_scope(p_leaderboard_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lb public.leaderboards%rowtype;
  v_count integer := 0;
begin
  select *
  into v_lb
  from public.leaderboards
  where id = p_leaderboard_id;

  if v_lb.id is null then
    raise exception 'Leaderboard not found';
  end if;

  if not public.is_service_role()
    and (v_lb.scope_gym_id is not null and not public.is_gym_staff(v_lb.scope_gym_id, auth.uid()))
  then
    raise exception 'Not authorized to rebuild this leaderboard';
  end if;

  delete from public.leaderboard_entries
  where leaderboard_id = p_leaderboard_id;

  if v_lb.metric = 'xp' then
    insert into public.leaderboard_entries(leaderboard_id, user_id, rank, score, details)
    select
      p_leaderboard_id,
      p.id,
      row_number() over (order by p.xp_total desc, p.created_at asc),
      p.xp_total::numeric,
      jsonb_build_object('metric', 'xp')
    from public.profiles p
    where (v_lb.scope = 'global')
       or (v_lb.scope = 'gym' and p.home_gym_id = v_lb.scope_gym_id)
       or (v_lb.scope = 'exercise')
       or (v_lb.scope = 'challenge')
    limit 500;

  elsif v_lb.metric = 'consistency_days' then
    insert into public.leaderboard_entries(leaderboard_id, user_id, rank, score, details)
    select
      p_leaderboard_id,
      p.id,
      row_number() over (order by p.chain_days desc, p.created_at asc),
      p.chain_days::numeric,
      jsonb_build_object('metric', 'consistency_days')
    from public.profiles p
    where (v_lb.scope = 'global')
       or (v_lb.scope = 'gym' and p.home_gym_id = v_lb.scope_gym_id)
    limit 500;

  elsif v_lb.metric = 'volume_kg' then
    insert into public.leaderboard_entries(leaderboard_id, user_id, rank, score, details)
    select
      p_leaderboard_id,
      x.user_id,
      row_number() over (order by x.score desc, x.user_id),
      x.score,
      jsonb_build_object('metric', 'volume_kg', 'starts_at', v_lb.starts_at, 'ends_at', v_lb.ends_at)
    from (
      select
        w.user_id,
        coalesce(sum(w.total_volume_kg), 0)::numeric(14,3) as score
      from public.workouts w
      where w.started_at >= v_lb.starts_at
        and w.started_at < v_lb.ends_at
        and (
          v_lb.scope = 'global'
          or (v_lb.scope = 'gym' and w.gym_id = v_lb.scope_gym_id)
          or (v_lb.scope = 'exercise' and exists (
            select 1 from public.workout_exercises we
            where we.workout_id = w.id and we.exercise_id = v_lb.scope_exercise_id
          ))
        )
      group by w.user_id
    ) x
    limit 500;

  elsif v_lb.metric = 'estimated_1rm' then
    insert into public.leaderboard_entries(leaderboard_id, user_id, rank, score, details)
    select
      p_leaderboard_id,
      x.user_id,
      row_number() over (order by x.score desc, x.user_id),
      x.score,
      jsonb_build_object('metric', 'estimated_1rm')
    from (
      select
        w.user_id,
        max((coalesce(ws.weight_kg, 0) * (1 + coalesce(ws.reps, 0) / 30.0))::numeric(14,3)) as score
      from public.workout_sets ws
      join public.workout_exercises we on we.id = ws.workout_exercise_id
      join public.workouts w on w.id = we.workout_id
      where w.started_at >= v_lb.starts_at
        and w.started_at < v_lb.ends_at
        and (
          v_lb.scope <> 'exercise' or we.exercise_id = v_lb.scope_exercise_id
        )
      group by w.user_id
    ) x
    where x.score is not null
    limit 500;

  elsif v_lb.metric = 'challenge_score' then
    insert into public.leaderboard_entries(leaderboard_id, user_id, rank, score, details)
    select
      p_leaderboard_id,
      cp.user_id,
      row_number() over (order by cp.score desc, cp.user_id),
      cp.score::numeric(14,3),
      jsonb_build_object('metric', 'challenge_score', 'challenge_id', cp.challenge_id)
    from public.challenge_participants cp
    where (v_lb.scope = 'challenge' and cp.challenge_id = v_lb.scope_challenge_id)
       or (v_lb.scope = 'global')
    limit 500;
  end if;

  get diagnostics v_count = row_count;

  insert into public.event_outbox(event_type, aggregate_type, aggregate_id, payload)
  values (
    'rank.updated',
    'leaderboard',
    p_leaderboard_id,
    jsonb_build_object('leaderboard_id', p_leaderboard_id, 'rows', v_count)
  );

  return v_count;
end;
$$;

-- =====================================================
-- TRIGGERS
-- =====================================================

drop trigger if exists trg_feature_flags_set_updated_at on public.feature_flags;
create trigger trg_feature_flags_set_updated_at before update on public.feature_flags
for each row execute function public.set_updated_at();

drop trigger if exists trg_gyms_set_updated_at on public.gyms;
create trigger trg_gyms_set_updated_at before update on public.gyms
for each row execute function public.set_updated_at();

drop trigger if exists trg_profiles_set_updated_at on public.profiles;
create trigger trg_profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_exercises_set_updated_at on public.exercises;
create trigger trg_exercises_set_updated_at before update on public.exercises
for each row execute function public.set_updated_at();

drop trigger if exists trg_social_connections_set_updated_at on public.social_connections;
create trigger trg_social_connections_set_updated_at before update on public.social_connections
for each row execute function public.set_updated_at();

drop trigger if exists trg_workouts_set_updated_at on public.workouts;
create trigger trg_workouts_set_updated_at before update on public.workouts
for each row execute function public.set_updated_at();

drop trigger if exists trg_workout_exercises_set_updated_at on public.workout_exercises;
create trigger trg_workout_exercises_set_updated_at before update on public.workout_exercises
for each row execute function public.set_updated_at();

drop trigger if exists trg_social_interactions_set_updated_at on public.social_interactions;
create trigger trg_social_interactions_set_updated_at before update on public.social_interactions
for each row execute function public.set_updated_at();

drop trigger if exists trg_challenges_set_updated_at on public.challenges;
create trigger trg_challenges_set_updated_at before update on public.challenges
for each row execute function public.set_updated_at();

drop trigger if exists trg_challenge_participants_set_updated_at on public.challenge_participants;
create trigger trg_challenge_participants_set_updated_at before update on public.challenge_participants
for each row execute function public.set_updated_at();

drop trigger if exists trg_leaderboards_set_updated_at on public.leaderboards;
create trigger trg_leaderboards_set_updated_at before update on public.leaderboards
for each row execute function public.set_updated_at();

drop trigger if exists trg_gym_membership_plans_set_updated_at on public.gym_membership_plans;
create trigger trg_gym_membership_plans_set_updated_at before update on public.gym_membership_plans
for each row execute function public.set_updated_at();

drop trigger if exists trg_gym_memberships_set_updated_at on public.gym_memberships;
create trigger trg_gym_memberships_set_updated_at before update on public.gym_memberships
for each row execute function public.set_updated_at();

drop trigger if exists trg_gym_classes_set_updated_at on public.gym_classes;
create trigger trg_gym_classes_set_updated_at before update on public.gym_classes
for each row execute function public.set_updated_at();

drop trigger if exists trg_class_bookings_set_updated_at on public.class_bookings;
create trigger trg_class_bookings_set_updated_at before update on public.class_bookings
for each row execute function public.set_updated_at();

drop trigger if exists trg_class_waitlist_set_updated_at on public.class_waitlist;
create trigger trg_class_waitlist_set_updated_at before update on public.class_waitlist
for each row execute function public.set_updated_at();

drop trigger if exists trg_waivers_set_updated_at on public.waivers;
create trigger trg_waivers_set_updated_at before update on public.waivers
for each row execute function public.set_updated_at();

drop trigger if exists trg_contracts_set_updated_at on public.contracts;
create trigger trg_contracts_set_updated_at before update on public.contracts
for each row execute function public.set_updated_at();

drop trigger if exists trg_member_subscriptions_set_updated_at on public.member_subscriptions;
create trigger trg_member_subscriptions_set_updated_at before update on public.member_subscriptions
for each row execute function public.set_updated_at();

drop trigger if exists trg_invoices_set_updated_at on public.invoices;
create trigger trg_invoices_set_updated_at before update on public.invoices
for each row execute function public.set_updated_at();

drop trigger if exists trg_payment_transactions_set_updated_at on public.payment_transactions;
create trigger trg_payment_transactions_set_updated_at before update on public.payment_transactions
for each row execute function public.set_updated_at();

drop trigger if exists trg_refunds_set_updated_at on public.refunds;
create trigger trg_refunds_set_updated_at before update on public.refunds
for each row execute function public.set_updated_at();

drop trigger if exists trg_dunning_events_set_updated_at on public.dunning_events;
create trigger trg_dunning_events_set_updated_at before update on public.dunning_events
for each row execute function public.set_updated_at();

drop trigger if exists trg_device_connections_set_updated_at on public.device_connections;
create trigger trg_device_connections_set_updated_at before update on public.device_connections
for each row execute function public.set_updated_at();

drop trigger if exists trg_device_sync_jobs_set_updated_at on public.device_sync_jobs;
create trigger trg_device_sync_jobs_set_updated_at before update on public.device_sync_jobs
for each row execute function public.set_updated_at();

drop trigger if exists trg_notification_preferences_set_updated_at on public.notification_preferences;
create trigger trg_notification_preferences_set_updated_at before update on public.notification_preferences
for each row execute function public.set_updated_at();

drop trigger if exists trg_user_reports_set_updated_at on public.user_reports;
create trigger trg_user_reports_set_updated_at before update on public.user_reports
for each row execute function public.set_updated_at();

drop trigger if exists trg_consents_set_updated_at on public.consents;
create trigger trg_consents_set_updated_at before update on public.consents
for each row execute function public.set_updated_at();

drop trigger if exists trg_privacy_requests_set_updated_at on public.privacy_requests;
create trigger trg_privacy_requests_set_updated_at before update on public.privacy_requests
for each row execute function public.set_updated_at();

drop trigger if exists trg_workout_sets_refresh_totals_insupd on public.workout_sets;
create trigger trg_workout_sets_refresh_totals_insupd
after insert or update on public.workout_sets
for each row execute function public.refresh_workout_totals_from_set_trigger();

drop trigger if exists trg_workout_sets_refresh_totals_del on public.workout_sets;
create trigger trg_workout_sets_refresh_totals_del
after delete on public.workout_sets
for each row execute function public.refresh_workout_totals_from_set_trigger();

drop trigger if exists trg_workout_progress on public.workouts;
create trigger trg_workout_progress
after insert on public.workouts
for each row execute function public.apply_workout_progress_trigger();

drop trigger if exists trg_workout_feed_event on public.workouts;
create trigger trg_workout_feed_event
after insert on public.workouts
for each row execute function public.create_workout_feed_event_trigger();

-- =====================================================
-- RLS ENABLEMENT
-- =====================================================

alter table public.feature_flags enable row level security;
alter table public.gyms enable row level security;
alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.social_connections enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_sets enable row level security;
alter table public.feed_events enable row level security;
alter table public.social_interactions enable row level security;
alter table public.challenges enable row level security;
alter table public.challenge_participants enable row level security;
alter table public.leaderboards enable row level security;
alter table public.leaderboard_entries enable row level security;
alter table public.gym_membership_plans enable row level security;
alter table public.gym_memberships enable row level security;
alter table public.gym_classes enable row level security;
alter table public.class_bookings enable row level security;
alter table public.class_waitlist enable row level security;
alter table public.waivers enable row level security;
alter table public.waiver_acceptances enable row level security;
alter table public.contracts enable row level security;
alter table public.contract_acceptances enable row level security;
alter table public.gym_checkins enable row level security;
alter table public.access_logs enable row level security;
alter table public.member_subscriptions enable row level security;
alter table public.invoices enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.refunds enable row level security;
alter table public.dunning_events enable row level security;
alter table public.device_connections enable row level security;
alter table public.device_sync_jobs enable row level security;
alter table public.external_activity_imports enable row level security;
alter table public.integration_webhook_events enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.user_blocks enable row level security;
alter table public.user_reports enable row level security;
alter table public.policy_version_tracking enable row level security;
alter table public.consents enable row level security;
alter table public.privacy_requests enable row level security;
alter table public.audit_logs enable row level security;
alter table public.event_outbox enable row level security;

-- Feature flags

drop policy if exists feature_flags_select on public.feature_flags;
create policy feature_flags_select
on public.feature_flags for select to authenticated
using (true);

drop policy if exists feature_flags_manage_service on public.feature_flags;
create policy feature_flags_manage_service
on public.feature_flags for all to authenticated
using (public.is_service_role())
with check (public.is_service_role());

-- Profiles

drop policy if exists profiles_select_public_or_self on public.profiles;
create policy profiles_select_public_or_self
on public.profiles for select to authenticated
using (is_public or id = auth.uid());

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self
on public.profiles for insert to authenticated
with check (id = auth.uid());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists profiles_delete_self on public.profiles;
create policy profiles_delete_self
on public.profiles for delete to authenticated
using (id = auth.uid());

-- Gyms

drop policy if exists gyms_select_public_or_member on public.gyms;
create policy gyms_select_public_or_member
on public.gyms for select to authenticated
using (is_public or public.is_gym_member(id, auth.uid()));

drop policy if exists gyms_insert_owner_self on public.gyms;
create policy gyms_insert_owner_self
on public.gyms for insert to authenticated
with check (owner_user_id = auth.uid());

drop policy if exists gyms_update_staff_or_owner on public.gyms;
create policy gyms_update_staff_or_owner
on public.gyms for update to authenticated
using (public.is_gym_staff(id, auth.uid()) or owner_user_id = auth.uid())
with check (public.is_gym_staff(id, auth.uid()) or owner_user_id = auth.uid());

drop policy if exists gyms_delete_owner on public.gyms;
create policy gyms_delete_owner
on public.gyms for delete to authenticated
using (owner_user_id = auth.uid());

-- Exercises

drop policy if exists exercises_select_public_or_owner on public.exercises;
create policy exercises_select_public_or_owner
on public.exercises for select to authenticated
using (is_public or created_by = auth.uid());

drop policy if exists exercises_insert_self on public.exercises;
create policy exercises_insert_self
on public.exercises for insert to authenticated
with check (created_by = auth.uid());

drop policy if exists exercises_update_owner on public.exercises;
create policy exercises_update_owner
on public.exercises for update to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());

drop policy if exists exercises_delete_owner on public.exercises;
create policy exercises_delete_owner
on public.exercises for delete to authenticated
using (created_by = auth.uid());

-- Social connections

drop policy if exists social_connections_select on public.social_connections;
create policy social_connections_select
on public.social_connections for select to authenticated
using (
  status = 'accepted'
  or follower_user_id = auth.uid()
  or followed_user_id = auth.uid()
);

drop policy if exists social_connections_insert_self on public.social_connections;
create policy social_connections_insert_self
on public.social_connections for insert to authenticated
with check (follower_user_id = auth.uid());

drop policy if exists social_connections_update_party on public.social_connections;
create policy social_connections_update_party
on public.social_connections for update to authenticated
using (follower_user_id = auth.uid() or followed_user_id = auth.uid())
with check (follower_user_id = auth.uid() or followed_user_id = auth.uid());

drop policy if exists social_connections_delete_party on public.social_connections;
create policy social_connections_delete_party
on public.social_connections for delete to authenticated
using (follower_user_id = auth.uid() or followed_user_id = auth.uid());

-- Workouts + feed

drop policy if exists workouts_select_visible on public.workouts;
create policy workouts_select_visible
on public.workouts for select to authenticated
using (
  not exists (
    select 1
    from public.user_blocks ub
    where (ub.blocker_user_id = auth.uid() and ub.blocked_user_id = workouts.user_id)
       or (ub.blocker_user_id = workouts.user_id and ub.blocked_user_id = auth.uid())
  )
  and public.can_view_workout(user_id, visibility, gym_id, auth.uid())
);

drop policy if exists workouts_insert_own on public.workouts;
create policy workouts_insert_own
on public.workouts for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists workouts_update_own on public.workouts;
create policy workouts_update_own
on public.workouts for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists workouts_delete_own on public.workouts;
create policy workouts_delete_own
on public.workouts for delete to authenticated
using (user_id = auth.uid());

drop policy if exists workout_exercises_select_visible on public.workout_exercises;
create policy workout_exercises_select_visible
on public.workout_exercises for select to authenticated
using (
  exists (
    select 1
    from public.workouts w
    where w.id = workout_exercises.workout_id
      and public.can_view_workout(w.user_id, w.visibility, w.gym_id, auth.uid())
  )
);

drop policy if exists workout_exercises_insert_owner on public.workout_exercises;
create policy workout_exercises_insert_owner
on public.workout_exercises for insert to authenticated
with check (
  exists (
    select 1 from public.workouts w
    where w.id = workout_exercises.workout_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists workout_exercises_update_owner on public.workout_exercises;
create policy workout_exercises_update_owner
on public.workout_exercises for update to authenticated
using (
  exists (
    select 1 from public.workouts w
    where w.id = workout_exercises.workout_id
      and w.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.workouts w
    where w.id = workout_exercises.workout_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists workout_exercises_delete_owner on public.workout_exercises;
create policy workout_exercises_delete_owner
on public.workout_exercises for delete to authenticated
using (
  exists (
    select 1 from public.workouts w
    where w.id = workout_exercises.workout_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists workout_sets_select_visible on public.workout_sets;
create policy workout_sets_select_visible
on public.workout_sets for select to authenticated
using (
  exists (
    select 1
    from public.workout_exercises we
    join public.workouts w on w.id = we.workout_id
    where we.id = workout_sets.workout_exercise_id
      and public.can_view_workout(w.user_id, w.visibility, w.gym_id, auth.uid())
  )
);

drop policy if exists workout_sets_insert_owner on public.workout_sets;
create policy workout_sets_insert_owner
on public.workout_sets for insert to authenticated
with check (
  exists (
    select 1
    from public.workout_exercises we
    join public.workouts w on w.id = we.workout_id
    where we.id = workout_sets.workout_exercise_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists workout_sets_update_owner on public.workout_sets;
create policy workout_sets_update_owner
on public.workout_sets for update to authenticated
using (
  exists (
    select 1
    from public.workout_exercises we
    join public.workouts w on w.id = we.workout_id
    where we.id = workout_sets.workout_exercise_id
      and w.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.workout_exercises we
    join public.workouts w on w.id = we.workout_id
    where we.id = workout_sets.workout_exercise_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists workout_sets_delete_owner on public.workout_sets;
create policy workout_sets_delete_owner
on public.workout_sets for delete to authenticated
using (
  exists (
    select 1
    from public.workout_exercises we
    join public.workouts w on w.id = we.workout_id
    where we.id = workout_sets.workout_exercise_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists feed_events_select_visible on public.feed_events;
create policy feed_events_select_visible
on public.feed_events for select to authenticated
using (
  exists (
    select 1
    from public.workouts w
    where w.id = feed_events.workout_id
      and public.can_view_workout(w.user_id, w.visibility, w.gym_id, auth.uid())
  )
);

drop policy if exists feed_events_insert_owner_or_service on public.feed_events;
create policy feed_events_insert_owner_or_service
on public.feed_events for insert to authenticated
with check (user_id = auth.uid() or public.is_service_role());

-- Interactions

drop policy if exists social_interactions_select_visible on public.social_interactions;
create policy social_interactions_select_visible
on public.social_interactions for select to authenticated
using (
  exists (
    select 1
    from public.workouts w
    where w.id = social_interactions.workout_id
      and public.can_view_workout(w.user_id, w.visibility, w.gym_id, auth.uid())
  )
);

drop policy if exists social_interactions_insert_self on public.social_interactions;
create policy social_interactions_insert_self
on public.social_interactions for insert to authenticated
with check (
  actor_user_id = auth.uid()
  and exists (
    select 1
    from public.workouts w
    where w.id = social_interactions.workout_id
      and public.can_view_workout(w.user_id, w.visibility, w.gym_id, auth.uid())
  )
);

drop policy if exists social_interactions_update_self on public.social_interactions;
create policy social_interactions_update_self
on public.social_interactions for update to authenticated
using (actor_user_id = auth.uid())
with check (actor_user_id = auth.uid());

drop policy if exists social_interactions_delete_self on public.social_interactions;
create policy social_interactions_delete_self
on public.social_interactions for delete to authenticated
using (actor_user_id = auth.uid());

-- Challenges

drop policy if exists challenges_select_visible on public.challenges;
create policy challenges_select_visible
on public.challenges for select to authenticated
using (
  visibility = 'public'
  or creator_user_id = auth.uid()
  or (
    visibility = 'gym'
    and gym_id is not null
    and public.can_view_gym(gym_id, auth.uid())
  )
);

drop policy if exists challenges_insert_self on public.challenges;
create policy challenges_insert_self
on public.challenges for insert to authenticated
with check (
  creator_user_id = auth.uid()
  and (gym_id is null or public.is_gym_staff(gym_id, auth.uid()))
);

drop policy if exists challenges_update_creator_or_staff on public.challenges;
create policy challenges_update_creator_or_staff
on public.challenges for update to authenticated
using (
  creator_user_id = auth.uid()
  or (gym_id is not null and public.is_gym_staff(gym_id, auth.uid()))
)
with check (
  creator_user_id = auth.uid()
  or (gym_id is not null and public.is_gym_staff(gym_id, auth.uid()))
);

drop policy if exists challenges_delete_creator_or_staff on public.challenges;
create policy challenges_delete_creator_or_staff
on public.challenges for delete to authenticated
using (
  creator_user_id = auth.uid()
  or (gym_id is not null and public.is_gym_staff(gym_id, auth.uid()))
);

drop policy if exists challenge_participants_select on public.challenge_participants;
create policy challenge_participants_select
on public.challenge_participants for select to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.challenges c
    where c.id = challenge_participants.challenge_id
      and (
        c.visibility = 'public'
        or c.creator_user_id = auth.uid()
        or (c.visibility = 'gym' and c.gym_id is not null and public.can_view_gym(c.gym_id, auth.uid()))
      )
  )
);

drop policy if exists challenge_participants_insert_self on public.challenge_participants;
create policy challenge_participants_insert_self
on public.challenge_participants for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists challenge_participants_update_self_or_creator on public.challenge_participants;
create policy challenge_participants_update_self_or_creator
on public.challenge_participants for update to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.challenges c
    where c.id = challenge_participants.challenge_id
      and c.creator_user_id = auth.uid()
  )
)
with check (
  user_id = auth.uid()
  or exists (
    select 1 from public.challenges c
    where c.id = challenge_participants.challenge_id
      and c.creator_user_id = auth.uid()
  )
);

-- Leaderboards read-only for clients

drop policy if exists leaderboards_select_all on public.leaderboards;
create policy leaderboards_select_all
on public.leaderboards for select to authenticated
using (true);

drop policy if exists leaderboard_entries_select_all on public.leaderboard_entries;
create policy leaderboard_entries_select_all
on public.leaderboard_entries for select to authenticated
using (true);

drop policy if exists leaderboards_manage_service_or_staff on public.leaderboards;
create policy leaderboards_manage_service_or_staff
on public.leaderboards for all to authenticated
using (
  public.is_service_role()
  or (scope_gym_id is not null and public.is_gym_staff(scope_gym_id, auth.uid()))
)
with check (
  public.is_service_role()
  or (scope_gym_id is not null and public.is_gym_staff(scope_gym_id, auth.uid()))
);

drop policy if exists leaderboard_entries_manage_service on public.leaderboard_entries;
create policy leaderboard_entries_manage_service
on public.leaderboard_entries for all to authenticated
using (public.is_service_role())
with check (public.is_service_role());

-- Gym plans/memberships/classes/bookings

drop policy if exists gym_membership_plans_select_visible on public.gym_membership_plans;
create policy gym_membership_plans_select_visible
on public.gym_membership_plans for select to authenticated
using (public.can_view_gym(gym_id, auth.uid()));

drop policy if exists gym_membership_plans_manage_staff on public.gym_membership_plans;
create policy gym_membership_plans_manage_staff
on public.gym_membership_plans for all to authenticated
using (public.is_gym_staff(gym_id, auth.uid()))
with check (public.is_gym_staff(gym_id, auth.uid()));

drop policy if exists gym_memberships_select_self_or_staff on public.gym_memberships;
create policy gym_memberships_select_self_or_staff
on public.gym_memberships for select to authenticated
using (user_id = auth.uid() or public.is_gym_staff(gym_id, auth.uid()));

drop policy if exists gym_memberships_insert_self_or_staff on public.gym_memberships;
create policy gym_memberships_insert_self_or_staff
on public.gym_memberships for insert to authenticated
with check (user_id = auth.uid() or public.is_gym_staff(gym_id, auth.uid()));

drop policy if exists gym_memberships_update_self_or_staff on public.gym_memberships;
create policy gym_memberships_update_self_or_staff
on public.gym_memberships for update to authenticated
using (user_id = auth.uid() or public.is_gym_staff(gym_id, auth.uid()))
with check (user_id = auth.uid() or public.is_gym_staff(gym_id, auth.uid()));

drop policy if exists gym_classes_select_visible on public.gym_classes;
create policy gym_classes_select_visible
on public.gym_classes for select to authenticated
using (public.can_view_gym(gym_id, auth.uid()));

drop policy if exists gym_classes_manage_staff on public.gym_classes;
create policy gym_classes_manage_staff
on public.gym_classes for all to authenticated
using (public.is_gym_staff(gym_id, auth.uid()))
with check (public.is_gym_staff(gym_id, auth.uid()));

drop policy if exists class_bookings_select_self_or_staff on public.class_bookings;
create policy class_bookings_select_self_or_staff
on public.class_bookings for select to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.gym_classes gc
    where gc.id = class_bookings.class_id
      and public.is_gym_staff(gc.gym_id, auth.uid())
  )
);

drop policy if exists class_bookings_insert_self_or_staff on public.class_bookings;
create policy class_bookings_insert_self_or_staff
on public.class_bookings for insert to authenticated
with check (
  user_id = auth.uid()
  or exists (
    select 1
    from public.gym_classes gc
    where gc.id = class_bookings.class_id
      and public.is_gym_staff(gc.gym_id, auth.uid())
  )
);

drop policy if exists class_bookings_update_self_or_staff on public.class_bookings;
create policy class_bookings_update_self_or_staff
on public.class_bookings for update to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.gym_classes gc
    where gc.id = class_bookings.class_id
      and public.is_gym_staff(gc.gym_id, auth.uid())
  )
)
with check (
  user_id = auth.uid()
  or exists (
    select 1
    from public.gym_classes gc
    where gc.id = class_bookings.class_id
      and public.is_gym_staff(gc.gym_id, auth.uid())
  )
);

-- Waitlist

drop policy if exists class_waitlist_select_self_or_staff on public.class_waitlist;
create policy class_waitlist_select_self_or_staff
on public.class_waitlist for select to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.gym_classes gc
    where gc.id = class_waitlist.class_id
      and public.is_gym_staff(gc.gym_id, auth.uid())
  )
);

drop policy if exists class_waitlist_insert_self on public.class_waitlist;
create policy class_waitlist_insert_self
on public.class_waitlist for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists class_waitlist_update_self_or_staff on public.class_waitlist;
create policy class_waitlist_update_self_or_staff
on public.class_waitlist for update to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.gym_classes gc
    where gc.id = class_waitlist.class_id
      and public.is_gym_staff(gc.gym_id, auth.uid())
  )
)
with check (
  user_id = auth.uid()
  or exists (
    select 1
    from public.gym_classes gc
    where gc.id = class_waitlist.class_id
      and public.is_gym_staff(gc.gym_id, auth.uid())
  )
);

-- Waivers

drop policy if exists waivers_select_visible on public.waivers;
create policy waivers_select_visible
on public.waivers for select to authenticated
using (public.can_view_gym(gym_id, auth.uid()));

drop policy if exists waivers_manage_staff on public.waivers;
create policy waivers_manage_staff
on public.waivers for all to authenticated
using (public.is_gym_staff(gym_id, auth.uid()))
with check (public.is_gym_staff(gym_id, auth.uid()));

drop policy if exists waiver_acceptances_select_self_or_staff on public.waiver_acceptances;
create policy waiver_acceptances_select_self_or_staff
on public.waiver_acceptances for select to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.waivers w
    where w.id = waiver_acceptances.waiver_id
      and public.is_gym_staff(w.gym_id, auth.uid())
  )
);

drop policy if exists waiver_acceptances_insert_self on public.waiver_acceptances;
create policy waiver_acceptances_insert_self
on public.waiver_acceptances for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists contracts_select_visible on public.contracts;
create policy contracts_select_visible
on public.contracts for select to authenticated
using (public.can_view_gym(gym_id, auth.uid()));

drop policy if exists contracts_manage_staff on public.contracts;
create policy contracts_manage_staff
on public.contracts for all to authenticated
using (public.is_gym_staff(gym_id, auth.uid()))
with check (public.is_gym_staff(gym_id, auth.uid()));

drop policy if exists contract_acceptances_select_self_or_staff on public.contract_acceptances;
create policy contract_acceptances_select_self_or_staff
on public.contract_acceptances for select to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.contracts c
    where c.id = contract_acceptances.contract_id
      and public.is_gym_staff(c.gym_id, auth.uid())
  )
);

drop policy if exists contract_acceptances_insert_self on public.contract_acceptances;
create policy contract_acceptances_insert_self
on public.contract_acceptances for insert to authenticated
with check (user_id = auth.uid());

-- Check-ins/access

drop policy if exists gym_checkins_select_self_or_staff on public.gym_checkins;
create policy gym_checkins_select_self_or_staff
on public.gym_checkins for select to authenticated
using (user_id = auth.uid() or public.is_gym_staff(gym_id, auth.uid()));

drop policy if exists gym_checkins_insert_self_or_staff on public.gym_checkins;
create policy gym_checkins_insert_self_or_staff
on public.gym_checkins for insert to authenticated
with check (user_id = auth.uid() or public.is_gym_staff(gym_id, auth.uid()));

drop policy if exists access_logs_select_staff_or_self on public.access_logs;
create policy access_logs_select_staff_or_self
on public.access_logs for select to authenticated
using ((user_id is not null and user_id = auth.uid()) or public.is_gym_staff(gym_id, auth.uid()));

drop policy if exists access_logs_insert_staff_or_service on public.access_logs;
create policy access_logs_insert_staff_or_service
on public.access_logs for insert to authenticated
with check (public.is_service_role() or public.is_gym_staff(gym_id, auth.uid()));

-- Billing

drop policy if exists member_subscriptions_select_self_or_staff on public.member_subscriptions;
create policy member_subscriptions_select_self_or_staff
on public.member_subscriptions for select to authenticated
using (user_id = auth.uid() or public.is_gym_staff(gym_id, auth.uid()));

drop policy if exists member_subscriptions_manage_service_or_staff on public.member_subscriptions;
create policy member_subscriptions_manage_service_or_staff
on public.member_subscriptions for all to authenticated
using (public.is_service_role() or public.is_gym_staff(gym_id, auth.uid()))
with check (public.is_service_role() or public.is_gym_staff(gym_id, auth.uid()));

drop policy if exists invoices_select_self_or_staff on public.invoices;
create policy invoices_select_self_or_staff
on public.invoices for select to authenticated
using (user_id = auth.uid() or public.is_gym_staff(gym_id, auth.uid()));

drop policy if exists invoices_manage_service_or_staff on public.invoices;
create policy invoices_manage_service_or_staff
on public.invoices for all to authenticated
using (public.is_service_role() or public.is_gym_staff(gym_id, auth.uid()))
with check (public.is_service_role() or public.is_gym_staff(gym_id, auth.uid()));

drop policy if exists payment_transactions_select_self_or_staff on public.payment_transactions;
create policy payment_transactions_select_self_or_staff
on public.payment_transactions for select to authenticated
using ((user_id is not null and user_id = auth.uid()) or public.is_gym_staff(gym_id, auth.uid()));

drop policy if exists payment_transactions_manage_service_or_staff on public.payment_transactions;
create policy payment_transactions_manage_service_or_staff
on public.payment_transactions for all to authenticated
using (public.is_service_role() or public.is_gym_staff(gym_id, auth.uid()))
with check (public.is_service_role() or public.is_gym_staff(gym_id, auth.uid()));

drop policy if exists refunds_select_self_or_staff on public.refunds;
create policy refunds_select_self_or_staff
on public.refunds for select to authenticated
using (
  exists (
    select 1
    from public.payment_transactions pt
    where pt.id = refunds.payment_transaction_id
      and ((pt.user_id is not null and pt.user_id = auth.uid()) or public.is_gym_staff(pt.gym_id, auth.uid()))
  )
);

drop policy if exists refunds_manage_service_or_staff on public.refunds;
create policy refunds_manage_service_or_staff
on public.refunds for all to authenticated
using (
  public.is_service_role()
  or exists (
    select 1
    from public.payment_transactions pt
    where pt.id = refunds.payment_transaction_id
      and public.is_gym_staff(pt.gym_id, auth.uid())
  )
)
with check (
  public.is_service_role()
  or exists (
    select 1
    from public.payment_transactions pt
    where pt.id = refunds.payment_transaction_id
      and public.is_gym_staff(pt.gym_id, auth.uid())
  )
);

drop policy if exists dunning_events_select_self_or_staff on public.dunning_events;
create policy dunning_events_select_self_or_staff
on public.dunning_events for select to authenticated
using (
  exists (
    select 1
    from public.member_subscriptions ms
    where ms.id = dunning_events.subscription_id
      and (ms.user_id = auth.uid() or public.is_gym_staff(ms.gym_id, auth.uid()))
  )
);

drop policy if exists dunning_events_manage_service_or_staff on public.dunning_events;
create policy dunning_events_manage_service_or_staff
on public.dunning_events for all to authenticated
using (
  public.is_service_role()
  or exists (
    select 1
    from public.member_subscriptions ms
    where ms.id = dunning_events.subscription_id
      and public.is_gym_staff(ms.gym_id, auth.uid())
  )
)
with check (
  public.is_service_role()
  or exists (
    select 1
    from public.member_subscriptions ms
    where ms.id = dunning_events.subscription_id
      and public.is_gym_staff(ms.gym_id, auth.uid())
  )
);

-- Integration

drop policy if exists device_connections_select_self on public.device_connections;
create policy device_connections_select_self
on public.device_connections for select to authenticated
using (user_id = auth.uid());

drop policy if exists device_connections_insert_self on public.device_connections;
create policy device_connections_insert_self
on public.device_connections for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists device_connections_update_self_or_service on public.device_connections;
create policy device_connections_update_self_or_service
on public.device_connections for update to authenticated
using (user_id = auth.uid() or public.is_service_role())
with check (user_id = auth.uid() or public.is_service_role());

drop policy if exists device_sync_jobs_select_self on public.device_sync_jobs;
create policy device_sync_jobs_select_self
on public.device_sync_jobs for select to authenticated
using (user_id = auth.uid());

drop policy if exists device_sync_jobs_insert_self_or_service on public.device_sync_jobs;
create policy device_sync_jobs_insert_self_or_service
on public.device_sync_jobs for insert to authenticated
with check (user_id = auth.uid() or public.is_service_role());

drop policy if exists device_sync_jobs_update_service_or_self on public.device_sync_jobs;
create policy device_sync_jobs_update_service_or_self
on public.device_sync_jobs for update to authenticated
using (public.is_service_role() or requested_by = auth.uid())
with check (public.is_service_role() or requested_by = auth.uid());

drop policy if exists external_activity_imports_select_self on public.external_activity_imports;
create policy external_activity_imports_select_self
on public.external_activity_imports for select to authenticated
using (user_id = auth.uid());

drop policy if exists external_activity_imports_manage_service on public.external_activity_imports;
create policy external_activity_imports_manage_service
on public.external_activity_imports for all to authenticated
using (public.is_service_role())
with check (public.is_service_role());

drop policy if exists integration_webhook_events_service_only on public.integration_webhook_events;
create policy integration_webhook_events_service_only
on public.integration_webhook_events for all to authenticated
using (public.is_service_role())
with check (public.is_service_role());

-- Notification + social safety

drop policy if exists notification_preferences_self on public.notification_preferences;
create policy notification_preferences_self
on public.notification_preferences for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists user_blocks_select_party on public.user_blocks;
create policy user_blocks_select_party
on public.user_blocks for select to authenticated
using (blocker_user_id = auth.uid() or blocked_user_id = auth.uid());

drop policy if exists user_blocks_insert_self on public.user_blocks;
create policy user_blocks_insert_self
on public.user_blocks for insert to authenticated
with check (blocker_user_id = auth.uid());

drop policy if exists user_blocks_delete_self on public.user_blocks;
create policy user_blocks_delete_self
on public.user_blocks for delete to authenticated
using (blocker_user_id = auth.uid());

drop policy if exists user_reports_select_reporter_or_staff on public.user_reports;
create policy user_reports_select_reporter_or_staff
on public.user_reports for select to authenticated
using (
  reporter_user_id = auth.uid()
  or public.is_service_role()
  or exists (
    select 1
    from public.gym_memberships gm
    where gm.user_id = auth.uid()
      and gm.role in ('leader','officer')
      and gm.membership_status in ('trial','active')
  )
);

drop policy if exists user_reports_insert_reporter on public.user_reports;
create policy user_reports_insert_reporter
on public.user_reports for insert to authenticated
with check (reporter_user_id = auth.uid());

drop policy if exists user_reports_update_staff_or_service on public.user_reports;
create policy user_reports_update_staff_or_service
on public.user_reports for update to authenticated
using (
  public.is_service_role()
  or exists (
    select 1
    from public.gym_memberships gm
    where gm.user_id = auth.uid()
      and gm.role in ('leader','officer')
      and gm.membership_status in ('trial','active')
  )
)
with check (
  public.is_service_role()
  or exists (
    select 1
    from public.gym_memberships gm
    where gm.user_id = auth.uid()
      and gm.role in ('leader','officer')
      and gm.membership_status in ('trial','active')
  )
);

-- Compliance

drop policy if exists policy_versions_select on public.policy_version_tracking;
create policy policy_versions_select
on public.policy_version_tracking for select to authenticated
using (true);

drop policy if exists policy_versions_manage_service on public.policy_version_tracking;
create policy policy_versions_manage_service
on public.policy_version_tracking for all to authenticated
using (public.is_service_role())
with check (public.is_service_role());

drop policy if exists consents_select_self on public.consents;
create policy consents_select_self
on public.consents for select to authenticated
using (user_id = auth.uid() or public.is_service_role());

drop policy if exists consents_insert_self on public.consents;
create policy consents_insert_self
on public.consents for insert to authenticated
with check (user_id = auth.uid() or public.is_service_role());

drop policy if exists consents_update_self_or_service on public.consents;
create policy consents_update_self_or_service
on public.consents for update to authenticated
using (user_id = auth.uid() or public.is_service_role())
with check (user_id = auth.uid() or public.is_service_role());

drop policy if exists privacy_requests_select_self_or_service on public.privacy_requests;
create policy privacy_requests_select_self_or_service
on public.privacy_requests for select to authenticated
using (user_id = auth.uid() or public.is_service_role());

drop policy if exists privacy_requests_insert_self on public.privacy_requests;
create policy privacy_requests_insert_self
on public.privacy_requests for insert to authenticated
with check (user_id = auth.uid() or public.is_service_role());

drop policy if exists privacy_requests_update_service on public.privacy_requests;
create policy privacy_requests_update_service
on public.privacy_requests for update to authenticated
using (public.is_service_role())
with check (public.is_service_role());

drop policy if exists audit_logs_select_service_or_staff on public.audit_logs;
create policy audit_logs_select_service_or_staff
on public.audit_logs for select to authenticated
using (
  public.is_service_role()
  or exists (
    select 1
    from public.gym_memberships gm
    where gm.user_id = auth.uid()
      and gm.role in ('leader','officer')
      and gm.membership_status in ('trial','active')
  )
);

drop policy if exists audit_logs_insert_service_or_staff on public.audit_logs;
create policy audit_logs_insert_service_or_staff
on public.audit_logs for insert to authenticated
with check (
  public.is_service_role()
  or exists (
    select 1
    from public.gym_memberships gm
    where gm.user_id = auth.uid()
      and gm.role in ('leader','officer')
      and gm.membership_status in ('trial','active')
  )
);

drop policy if exists event_outbox_service_only on public.event_outbox;
create policy event_outbox_service_only
on public.event_outbox for all to authenticated
using (public.is_service_role())
with check (public.is_service_role());

-- =====================================================
-- IMMUTABILITY GUARDS
-- =====================================================

create or replace function public.prevent_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'This table is append-only';
end;
$$;

drop trigger if exists trg_audit_logs_no_update on public.audit_logs;
create trigger trg_audit_logs_no_update
before update or delete on public.audit_logs
for each row execute function public.prevent_mutation();

drop trigger if exists trg_webhook_events_no_delete on public.integration_webhook_events;
create trigger trg_webhook_events_no_delete
before delete on public.integration_webhook_events
for each row execute function public.prevent_mutation();

-- =====================================================
-- DEFAULT NOTIFICATION PREFERENCES ON PROFILE CREATE
-- =====================================================

create or replace function public.seed_notification_preferences()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_preferences(user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_seed_notification_preferences on public.profiles;
create trigger trg_seed_notification_preferences
after insert on public.profiles
for each row execute function public.seed_notification_preferences();

-- End of migration
