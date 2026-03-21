
-- === original: 202602190001_krux_beta_foundation_part1.sql ===
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
  _metadata jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $append_audit_log$
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
    coalesce((auth.jwt() ->> 'role'), 'authenticated'),
    _action,
    _target_table,
    _target_id,
    _reason,
    coalesce(_metadata, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$append_audit_log$;

-- === original: 202602190002_krux_beta_part2_s001.sql ===
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

-- === original: 202602190003_krux_beta_part2_s002.sql ===
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

-- === original: 202602190004_krux_beta_part2_s003.sql ===
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

-- === original: 202602190005_krux_beta_part2_s004.sql ===
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

-- === original: 202602190006_krux_beta_part2_s005.sql ===
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

-- === original: 202602190007_krux_beta_part2_s006.sql ===
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

-- === original: 202602190008_krux_beta_part2_s007.sql ===
-- =====================================================
-- TRIGGERS
-- =====================================================

drop trigger if exists trg_feature_flags_set_updated_at on public.feature_flags;

-- === original: 202602190009_krux_beta_part2_s008.sql ===
create trigger trg_feature_flags_set_updated_at before update on public.feature_flags
for each row execute function public.set_updated_at();

-- === original: 202602190010_krux_beta_part2_s009.sql ===
drop trigger if exists trg_gyms_set_updated_at on public.gyms;

-- === original: 202602190011_krux_beta_part2_s010.sql ===
create trigger trg_gyms_set_updated_at before update on public.gyms
for each row execute function public.set_updated_at();

-- === original: 202602190012_krux_beta_part2_s011.sql ===
drop trigger if exists trg_profiles_set_updated_at on public.profiles;

-- === original: 202602190013_krux_beta_part2_s012.sql ===
create trigger trg_profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

-- === original: 202602190014_krux_beta_part2_s013.sql ===
drop trigger if exists trg_exercises_set_updated_at on public.exercises;

-- === original: 202602190015_krux_beta_part2_s014.sql ===
create trigger trg_exercises_set_updated_at before update on public.exercises
for each row execute function public.set_updated_at();

-- === original: 202602190016_krux_beta_part2_s015.sql ===
drop trigger if exists trg_social_connections_set_updated_at on public.social_connections;

-- === original: 202602190017_krux_beta_part2_s016.sql ===
create trigger trg_social_connections_set_updated_at before update on public.social_connections
for each row execute function public.set_updated_at();

-- === original: 202602190018_krux_beta_part2_s017.sql ===
drop trigger if exists trg_workouts_set_updated_at on public.workouts;

-- === original: 202602190019_krux_beta_part2_s018.sql ===
create trigger trg_workouts_set_updated_at before update on public.workouts
for each row execute function public.set_updated_at();

-- === original: 202602190020_krux_beta_part2_s019.sql ===
drop trigger if exists trg_workout_exercises_set_updated_at on public.workout_exercises;

-- === original: 202602190021_krux_beta_part2_s020.sql ===
create trigger trg_workout_exercises_set_updated_at before update on public.workout_exercises
for each row execute function public.set_updated_at();

-- === original: 202602190022_krux_beta_part2_s021.sql ===
drop trigger if exists trg_social_interactions_set_updated_at on public.social_interactions;

-- === original: 202602190023_krux_beta_part2_s022.sql ===
create trigger trg_social_interactions_set_updated_at before update on public.social_interactions
for each row execute function public.set_updated_at();

-- === original: 202602190024_krux_beta_part2_s023.sql ===
drop trigger if exists trg_challenges_set_updated_at on public.challenges;

-- === original: 202602190025_krux_beta_part2_s024.sql ===
create trigger trg_challenges_set_updated_at before update on public.challenges
for each row execute function public.set_updated_at();

-- === original: 202602190026_krux_beta_part2_s025.sql ===
drop trigger if exists trg_challenge_participants_set_updated_at on public.challenge_participants;

-- === original: 202602190027_krux_beta_part2_s026.sql ===
create trigger trg_challenge_participants_set_updated_at before update on public.challenge_participants
for each row execute function public.set_updated_at();

-- === original: 202602190028_krux_beta_part2_s027.sql ===
drop trigger if exists trg_leaderboards_set_updated_at on public.leaderboards;

-- === original: 202602190029_krux_beta_part2_s028.sql ===
create trigger trg_leaderboards_set_updated_at before update on public.leaderboards
for each row execute function public.set_updated_at();

-- === original: 202602190030_krux_beta_part2_s029.sql ===
drop trigger if exists trg_gym_membership_plans_set_updated_at on public.gym_membership_plans;

-- === original: 202602190031_krux_beta_part2_s030.sql ===
create trigger trg_gym_membership_plans_set_updated_at before update on public.gym_membership_plans
for each row execute function public.set_updated_at();

-- === original: 202602190032_krux_beta_part2_s031.sql ===
drop trigger if exists trg_gym_memberships_set_updated_at on public.gym_memberships;

-- === original: 202602190033_krux_beta_part2_s032.sql ===
create trigger trg_gym_memberships_set_updated_at before update on public.gym_memberships
for each row execute function public.set_updated_at();

-- === original: 202602190034_krux_beta_part2_s033.sql ===
drop trigger if exists trg_gym_classes_set_updated_at on public.gym_classes;

-- === original: 202602190035_krux_beta_part2_s034.sql ===
create trigger trg_gym_classes_set_updated_at before update on public.gym_classes
for each row execute function public.set_updated_at();

-- === original: 202602190036_krux_beta_part2_s035.sql ===
drop trigger if exists trg_class_bookings_set_updated_at on public.class_bookings;

-- === original: 202602190037_krux_beta_part2_s036.sql ===
create trigger trg_class_bookings_set_updated_at before update on public.class_bookings
for each row execute function public.set_updated_at();

-- === original: 202602190038_krux_beta_part2_s037.sql ===
drop trigger if exists trg_class_waitlist_set_updated_at on public.class_waitlist;

-- === original: 202602190039_krux_beta_part2_s038.sql ===
create trigger trg_class_waitlist_set_updated_at before update on public.class_waitlist
for each row execute function public.set_updated_at();

-- === original: 202602190040_krux_beta_part2_s039.sql ===
drop trigger if exists trg_waivers_set_updated_at on public.waivers;

-- === original: 202602190041_krux_beta_part2_s040.sql ===
create trigger trg_waivers_set_updated_at before update on public.waivers
for each row execute function public.set_updated_at();

-- === original: 202602190042_krux_beta_part2_s041.sql ===
drop trigger if exists trg_contracts_set_updated_at on public.contracts;

-- === original: 202602190043_krux_beta_part2_s042.sql ===
create trigger trg_contracts_set_updated_at before update on public.contracts
for each row execute function public.set_updated_at();

-- === original: 202602190044_krux_beta_part2_s043.sql ===
drop trigger if exists trg_member_subscriptions_set_updated_at on public.member_subscriptions;

-- === original: 202602190045_krux_beta_part2_s044.sql ===
create trigger trg_member_subscriptions_set_updated_at before update on public.member_subscriptions
for each row execute function public.set_updated_at();

-- === original: 202602190046_krux_beta_part2_s045.sql ===
drop trigger if exists trg_invoices_set_updated_at on public.invoices;

-- === original: 202602190047_krux_beta_part2_s046.sql ===
create trigger trg_invoices_set_updated_at before update on public.invoices
for each row execute function public.set_updated_at();

-- === original: 202602190048_krux_beta_part2_s047.sql ===
drop trigger if exists trg_payment_transactions_set_updated_at on public.payment_transactions;

-- === original: 202602190049_krux_beta_part2_s048.sql ===
create trigger trg_payment_transactions_set_updated_at before update on public.payment_transactions
for each row execute function public.set_updated_at();

-- === original: 202602190050_krux_beta_part2_s049.sql ===
drop trigger if exists trg_refunds_set_updated_at on public.refunds;

-- === original: 202602190051_krux_beta_part2_s050.sql ===
create trigger trg_refunds_set_updated_at before update on public.refunds
for each row execute function public.set_updated_at();

-- === original: 202602190052_krux_beta_part2_s051.sql ===
drop trigger if exists trg_dunning_events_set_updated_at on public.dunning_events;

-- === original: 202602190053_krux_beta_part2_s052.sql ===
create trigger trg_dunning_events_set_updated_at before update on public.dunning_events
for each row execute function public.set_updated_at();

-- === original: 202602190054_krux_beta_part2_s053.sql ===
drop trigger if exists trg_device_connections_set_updated_at on public.device_connections;

-- === original: 202602190055_krux_beta_part2_s054.sql ===
create trigger trg_device_connections_set_updated_at before update on public.device_connections
for each row execute function public.set_updated_at();

-- === original: 202602190056_krux_beta_part2_s055.sql ===
drop trigger if exists trg_device_sync_jobs_set_updated_at on public.device_sync_jobs;

-- === original: 202602190057_krux_beta_part2_s056.sql ===
create trigger trg_device_sync_jobs_set_updated_at before update on public.device_sync_jobs
for each row execute function public.set_updated_at();

-- === original: 202602190058_krux_beta_part2_s057.sql ===
drop trigger if exists trg_notification_preferences_set_updated_at on public.notification_preferences;

-- === original: 202602190059_krux_beta_part2_s058.sql ===
create trigger trg_notification_preferences_set_updated_at before update on public.notification_preferences
for each row execute function public.set_updated_at();

-- === original: 202602190060_krux_beta_part2_s059.sql ===
drop trigger if exists trg_user_reports_set_updated_at on public.user_reports;

-- === original: 202602190061_krux_beta_part2_s060.sql ===
create trigger trg_user_reports_set_updated_at before update on public.user_reports
for each row execute function public.set_updated_at();

-- === original: 202602190062_krux_beta_part2_s061.sql ===
drop trigger if exists trg_consents_set_updated_at on public.consents;

-- === original: 202602190063_krux_beta_part2_s062.sql ===
create trigger trg_consents_set_updated_at before update on public.consents
for each row execute function public.set_updated_at();

-- === original: 202602190064_krux_beta_part2_s063.sql ===
drop trigger if exists trg_privacy_requests_set_updated_at on public.privacy_requests;

-- === original: 202602190065_krux_beta_part2_s064.sql ===
create trigger trg_privacy_requests_set_updated_at before update on public.privacy_requests
for each row execute function public.set_updated_at();

-- === original: 202602190066_krux_beta_part2_s065.sql ===
drop trigger if exists trg_workout_sets_refresh_totals_insupd on public.workout_sets;

-- === original: 202602190067_krux_beta_part2_s066.sql ===
create trigger trg_workout_sets_refresh_totals_insupd
after insert or update on public.workout_sets
for each row execute function public.refresh_workout_totals_from_set_trigger();

-- === original: 202602190068_krux_beta_part2_s067.sql ===
drop trigger if exists trg_workout_sets_refresh_totals_del on public.workout_sets;

-- === original: 202602190069_krux_beta_part2_s068.sql ===
create trigger trg_workout_sets_refresh_totals_del
after delete on public.workout_sets
for each row execute function public.refresh_workout_totals_from_set_trigger();

-- === original: 202602190070_krux_beta_part2_s069.sql ===
drop trigger if exists trg_workout_progress on public.workouts;

-- === original: 202602190071_krux_beta_part2_s070.sql ===
create trigger trg_workout_progress
after insert on public.workouts
for each row execute function public.apply_workout_progress_trigger();

-- === original: 202602190072_krux_beta_part2_s071.sql ===
drop trigger if exists trg_workout_feed_event on public.workouts;

-- === original: 202602190073_krux_beta_part2_s072.sql ===
create trigger trg_workout_feed_event
after insert on public.workouts
for each row execute function public.create_workout_feed_event_trigger();

-- === original: 202602190074_krux_beta_part2_s073.sql ===
-- =====================================================
-- RLS ENABLEMENT
-- =====================================================

alter table public.feature_flags enable row level security;

-- === original: 202602190075_krux_beta_part2_s074.sql ===
alter table public.gyms enable row level security;

-- === original: 202602190076_krux_beta_part2_s075.sql ===
alter table public.profiles enable row level security;

-- === original: 202602190077_krux_beta_part2_s076.sql ===
alter table public.exercises enable row level security;

-- === original: 202602190078_krux_beta_part2_s077.sql ===
alter table public.social_connections enable row level security;

-- === original: 202602190079_krux_beta_part2_s078.sql ===
alter table public.workouts enable row level security;

-- === original: 202602190080_krux_beta_part2_s079.sql ===
alter table public.workout_exercises enable row level security;

-- === original: 202602190081_krux_beta_part2_s080.sql ===
alter table public.workout_sets enable row level security;

-- === original: 202602190082_krux_beta_part2_s081.sql ===
alter table public.feed_events enable row level security;

-- === original: 202602190083_krux_beta_part2_s082.sql ===
alter table public.social_interactions enable row level security;

-- === original: 202602190084_krux_beta_part2_s083.sql ===
alter table public.challenges enable row level security;

-- === original: 202602190085_krux_beta_part2_s084.sql ===
alter table public.challenge_participants enable row level security;

-- === original: 202602190086_krux_beta_part2_s085.sql ===
alter table public.leaderboards enable row level security;

-- === original: 202602190087_krux_beta_part2_s086.sql ===
alter table public.leaderboard_entries enable row level security;

-- === original: 202602190088_krux_beta_part2_s087.sql ===
alter table public.gym_membership_plans enable row level security;

-- === original: 202602190089_krux_beta_part2_s088.sql ===
alter table public.gym_memberships enable row level security;

-- === original: 202602190090_krux_beta_part2_s089.sql ===
alter table public.gym_classes enable row level security;

-- === original: 202602190091_krux_beta_part2_s090.sql ===
alter table public.class_bookings enable row level security;

-- === original: 202602190092_krux_beta_part2_s091.sql ===
alter table public.class_waitlist enable row level security;

-- === original: 202602190093_krux_beta_part2_s092.sql ===
alter table public.waivers enable row level security;

-- === original: 202602190094_krux_beta_part2_s093.sql ===
alter table public.waiver_acceptances enable row level security;

-- === original: 202602190095_krux_beta_part2_s094.sql ===
alter table public.contracts enable row level security;

-- === original: 202602190096_krux_beta_part2_s095.sql ===
alter table public.contract_acceptances enable row level security;

-- === original: 202602190097_krux_beta_part2_s096.sql ===
alter table public.gym_checkins enable row level security;

-- === original: 202602190098_krux_beta_part2_s097.sql ===
alter table public.access_logs enable row level security;

-- === original: 202602190099_krux_beta_part2_s098.sql ===
alter table public.member_subscriptions enable row level security;

-- === original: 202602190100_krux_beta_part2_s099.sql ===
alter table public.invoices enable row level security;

-- === original: 202602190101_krux_beta_part2_s100.sql ===
alter table public.payment_transactions enable row level security;

-- === original: 202602190102_krux_beta_part2_s101.sql ===
alter table public.refunds enable row level security;

-- === original: 202602190103_krux_beta_part2_s102.sql ===
alter table public.dunning_events enable row level security;

-- === original: 202602190104_krux_beta_part2_s103.sql ===
alter table public.device_connections enable row level security;

-- === original: 202602190105_krux_beta_part2_s104.sql ===
alter table public.device_sync_jobs enable row level security;

-- === original: 202602190106_krux_beta_part2_s105.sql ===
alter table public.external_activity_imports enable row level security;

-- === original: 202602190107_krux_beta_part2_s106.sql ===
alter table public.integration_webhook_events enable row level security;

-- === original: 202602190108_krux_beta_part2_s107.sql ===
alter table public.notification_preferences enable row level security;

-- === original: 202602190109_krux_beta_part2_s108.sql ===
alter table public.user_blocks enable row level security;

-- === original: 202602190110_krux_beta_part2_s109.sql ===
alter table public.user_reports enable row level security;

-- === original: 202602190111_krux_beta_part2_s110.sql ===
alter table public.policy_version_tracking enable row level security;

-- === original: 202602190112_krux_beta_part2_s111.sql ===
alter table public.consents enable row level security;

-- === original: 202602190113_krux_beta_part2_s112.sql ===
alter table public.privacy_requests enable row level security;

-- === original: 202602190114_krux_beta_part2_s113.sql ===
alter table public.audit_logs enable row level security;

-- === original: 202602190115_krux_beta_part2_s114.sql ===
alter table public.event_outbox enable row level security;

-- === original: 202602190116_krux_beta_part2_s115.sql ===
-- Feature flags

drop policy if exists feature_flags_select on public.feature_flags;

-- === original: 202602190117_krux_beta_part2_s116.sql ===
create policy feature_flags_select
on public.feature_flags for select to authenticated
using (true);

-- === original: 202602190118_krux_beta_part2_s117.sql ===
drop policy if exists feature_flags_manage_service on public.feature_flags;

-- === original: 202602190119_krux_beta_part2_s118.sql ===
create policy feature_flags_manage_service
on public.feature_flags for all to authenticated
using (public.is_service_role())
with check (public.is_service_role());

-- === original: 202602190120_krux_beta_part2_s119.sql ===
-- Profiles

drop policy if exists profiles_select_public_or_self on public.profiles;

-- === original: 202602190121_krux_beta_part2_s120.sql ===
create policy profiles_select_public_or_self
on public.profiles for select to authenticated
using (is_public or id = auth.uid());

-- === original: 202602190122_krux_beta_part2_s121.sql ===
drop policy if exists profiles_insert_self on public.profiles;

-- === original: 202602190123_krux_beta_part2_s122.sql ===
create policy profiles_insert_self
on public.profiles for insert to authenticated
with check (id = auth.uid());

-- === original: 202602190124_krux_beta_part2_s123.sql ===
drop policy if exists profiles_update_self on public.profiles;

-- === original: 202602190125_krux_beta_part2_s124.sql ===
create policy profiles_update_self
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- === original: 202602190126_krux_beta_part2_s125.sql ===
drop policy if exists profiles_delete_self on public.profiles;

-- === original: 202602190127_krux_beta_part2_s126.sql ===
create policy profiles_delete_self
on public.profiles for delete to authenticated
using (id = auth.uid());

-- === original: 202602190128_krux_beta_part2_s127.sql ===
-- Gyms

drop policy if exists gyms_select_public_or_member on public.gyms;

-- === original: 202602190129_krux_beta_part2_s128.sql ===
create policy gyms_select_public_or_member
on public.gyms for select to authenticated
using (is_public or public.is_gym_member(id, auth.uid()));

-- === original: 202602190130_krux_beta_part2_s129.sql ===
drop policy if exists gyms_insert_owner_self on public.gyms;

-- === original: 202602190131_krux_beta_part2_s130.sql ===
create policy gyms_insert_owner_self
on public.gyms for insert to authenticated
with check (owner_user_id = auth.uid());

-- === original: 202602190132_krux_beta_part2_s131.sql ===
drop policy if exists gyms_update_staff_or_owner on public.gyms;

-- === original: 202602190133_krux_beta_part2_s132.sql ===
create policy gyms_update_staff_or_owner
on public.gyms for update to authenticated
using (public.is_gym_staff(id, auth.uid()) or owner_user_id = auth.uid())
with check (public.is_gym_staff(id, auth.uid()) or owner_user_id = auth.uid());

-- === original: 202602190134_krux_beta_part2_s133.sql ===
drop policy if exists gyms_delete_owner on public.gyms;

-- === original: 202602190135_krux_beta_part2_s134.sql ===
create policy gyms_delete_owner
on public.gyms for delete to authenticated
using (owner_user_id = auth.uid());

-- === original: 202602190136_krux_beta_part2_s135.sql ===
-- Exercises

drop policy if exists exercises_select_public_or_owner on public.exercises;

-- === original: 202602190137_krux_beta_part2_s136.sql ===
create policy exercises_select_public_or_owner
on public.exercises for select to authenticated
using (is_public or created_by = auth.uid());

-- === original: 202602190138_krux_beta_part2_s137.sql ===
drop policy if exists exercises_insert_self on public.exercises;

-- === original: 202602190139_krux_beta_part2_s138.sql ===
create policy exercises_insert_self
on public.exercises for insert to authenticated
with check (created_by = auth.uid());

-- === original: 202602190140_krux_beta_part2_s139.sql ===
drop policy if exists exercises_update_owner on public.exercises;

-- === original: 202602190141_krux_beta_part2_s140.sql ===
create policy exercises_update_owner
on public.exercises for update to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());

-- === original: 202602190142_krux_beta_part2_s141.sql ===
drop policy if exists exercises_delete_owner on public.exercises;

-- === original: 202602190143_krux_beta_part2_s142.sql ===
create policy exercises_delete_owner
on public.exercises for delete to authenticated
using (created_by = auth.uid());

-- === original: 202602190144_krux_beta_part2_s143.sql ===
-- Social connections

drop policy if exists social_connections_select on public.social_connections;

-- === original: 202602190145_krux_beta_part2_s144.sql ===
create policy social_connections_select
on public.social_connections for select to authenticated
using (
  status = 'accepted'
  or follower_user_id = auth.uid()
  or followed_user_id = auth.uid()
);

-- === original: 202602190146_krux_beta_part2_s145.sql ===
drop policy if exists social_connections_insert_self on public.social_connections;

-- === original: 202602190147_krux_beta_part2_s146.sql ===
create policy social_connections_insert_self
on public.social_connections for insert to authenticated
with check (follower_user_id = auth.uid());

-- === original: 202602190148_krux_beta_part2_s147.sql ===
drop policy if exists social_connections_update_party on public.social_connections;

-- === original: 202602190149_krux_beta_part2_s148.sql ===
create policy social_connections_update_party
on public.social_connections for update to authenticated
using (follower_user_id = auth.uid() or followed_user_id = auth.uid())
with check (follower_user_id = auth.uid() or followed_user_id = auth.uid());

-- === original: 202602190150_krux_beta_part2_s149.sql ===
drop policy if exists social_connections_delete_party on public.social_connections;

-- === original: 202602190151_krux_beta_part2_s150.sql ===
create policy social_connections_delete_party
on public.social_connections for delete to authenticated
using (follower_user_id = auth.uid() or followed_user_id = auth.uid());

-- === original: 202602190152_krux_beta_part2_s151.sql ===
-- Workouts + feed

drop policy if exists workouts_select_visible on public.workouts;

-- === original: 202602190153_krux_beta_part2_s152.sql ===
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

-- === original: 202602190154_krux_beta_part2_s153.sql ===
drop policy if exists workouts_insert_own on public.workouts;

-- === original: 202602190155_krux_beta_part2_s154.sql ===
create policy workouts_insert_own
on public.workouts for insert to authenticated
with check (user_id = auth.uid());

-- === original: 202602190156_krux_beta_part2_s155.sql ===
drop policy if exists workouts_update_own on public.workouts;

-- === original: 202602190157_krux_beta_part2_s156.sql ===
create policy workouts_update_own
on public.workouts for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- === original: 202602190158_krux_beta_part2_s157.sql ===
drop policy if exists workouts_delete_own on public.workouts;

-- === original: 202602190159_krux_beta_part2_s158.sql ===
create policy workouts_delete_own
on public.workouts for delete to authenticated
using (user_id = auth.uid());

-- === original: 202602190160_krux_beta_part2_s159.sql ===
drop policy if exists workout_exercises_select_visible on public.workout_exercises;

-- === original: 202602190161_krux_beta_part2_s160.sql ===
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

-- === original: 202602190162_krux_beta_part2_s161.sql ===
drop policy if exists workout_exercises_insert_owner on public.workout_exercises;

-- === original: 202602190163_krux_beta_part2_s162.sql ===
create policy workout_exercises_insert_owner
on public.workout_exercises for insert to authenticated
with check (
  exists (
    select 1 from public.workouts w
    where w.id = workout_exercises.workout_id
      and w.user_id = auth.uid()
  )
);

-- === original: 202602190164_krux_beta_part2_s163.sql ===
drop policy if exists workout_exercises_update_owner on public.workout_exercises;

-- === original: 202602190165_krux_beta_part2_s164.sql ===
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

-- === original: 202602190166_krux_beta_part2_s165.sql ===
drop policy if exists workout_exercises_delete_owner on public.workout_exercises;

-- === original: 202602190167_krux_beta_part2_s166.sql ===
create policy workout_exercises_delete_owner
on public.workout_exercises for delete to authenticated
using (
  exists (
    select 1 from public.workouts w
    where w.id = workout_exercises.workout_id
      and w.user_id = auth.uid()
  )
);

-- === original: 202602190168_krux_beta_part2_s167.sql ===
drop policy if exists workout_sets_select_visible on public.workout_sets;

-- === original: 202602190169_krux_beta_part2_s168.sql ===
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

-- === original: 202602190170_krux_beta_part2_s169.sql ===
drop policy if exists workout_sets_insert_owner on public.workout_sets;

-- === original: 202602190171_krux_beta_part2_s170.sql ===
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

-- === original: 202602190172_krux_beta_part2_s171.sql ===
drop policy if exists workout_sets_update_owner on public.workout_sets;

-- === original: 202602190173_krux_beta_part2_s172.sql ===
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

-- === original: 202602190174_krux_beta_part2_s173.sql ===
drop policy if exists workout_sets_delete_owner on public.workout_sets;

-- === original: 202602190175_krux_beta_part2_s174.sql ===
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

-- === original: 202602190176_krux_beta_part2_s175.sql ===
drop policy if exists feed_events_select_visible on public.feed_events;

-- === original: 202602190177_krux_beta_part2_s176.sql ===
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

-- === original: 202602190178_krux_beta_part2_s177.sql ===
drop policy if exists feed_events_insert_owner_or_service on public.feed_events;

-- === original: 202602190179_krux_beta_part2_s178.sql ===
create policy feed_events_insert_owner_or_service
on public.feed_events for insert to authenticated
with check (user_id = auth.uid() or public.is_service_role());

-- === original: 202602190180_krux_beta_part2_s179.sql ===
-- Interactions

drop policy if exists social_interactions_select_visible on public.social_interactions;

-- === original: 202602190181_krux_beta_part2_s180.sql ===
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

-- === original: 202602190182_krux_beta_part2_s181.sql ===
drop policy if exists social_interactions_insert_self on public.social_interactions;

-- === original: 202602190183_krux_beta_part2_s182.sql ===
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

-- === original: 202602190184_krux_beta_part2_s183.sql ===
drop policy if exists social_interactions_update_self on public.social_interactions;

-- === original: 202602190185_krux_beta_part2_s184.sql ===
create policy social_interactions_update_self
on public.social_interactions for update to authenticated
using (actor_user_id = auth.uid())
with check (actor_user_id = auth.uid());

-- === original: 202602190186_krux_beta_part2_s185.sql ===
drop policy if exists social_interactions_delete_self on public.social_interactions;

-- === original: 202602190187_krux_beta_part2_s186.sql ===
create policy social_interactions_delete_self
on public.social_interactions for delete to authenticated
using (actor_user_id = auth.uid());

-- === original: 202602190188_krux_beta_part2_s187.sql ===
-- Challenges

drop policy if exists challenges_select_visible on public.challenges;

-- === original: 202602190189_krux_beta_part2_s188.sql ===
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

-- === original: 202602190190_krux_beta_part2_s189.sql ===
drop policy if exists challenges_insert_self on public.challenges;

-- === original: 202602190191_krux_beta_part2_s190.sql ===
create policy challenges_insert_self
on public.challenges for insert to authenticated
with check (
  creator_user_id = auth.uid()
  and (gym_id is null or public.is_gym_staff(gym_id, auth.uid()))
);

-- === original: 202602190192_krux_beta_part2_s191.sql ===
drop policy if exists challenges_update_creator_or_staff on public.challenges;

-- === original: 202602190193_krux_beta_part2_s192.sql ===
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

-- === original: 202602190194_krux_beta_part2_s193.sql ===
drop policy if exists challenges_delete_creator_or_staff on public.challenges;

-- === original: 202602190195_krux_beta_part2_s194.sql ===
create policy challenges_delete_creator_or_staff
on public.challenges for delete to authenticated
using (
  creator_user_id = auth.uid()
  or (gym_id is not null and public.is_gym_staff(gym_id, auth.uid()))
);

-- === original: 202602190196_krux_beta_part2_s195.sql ===
drop policy if exists challenge_participants_select on public.challenge_participants;

-- === original: 202602190197_krux_beta_part2_s196.sql ===
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

-- === original: 202602190198_krux_beta_part2_s197.sql ===
drop policy if exists challenge_participants_insert_self on public.challenge_participants;

-- === original: 202602190199_krux_beta_part2_s198.sql ===
create policy challenge_participants_insert_self
on public.challenge_participants for insert to authenticated
with check (user_id = auth.uid());

-- === original: 202602190200_krux_beta_part2_s199.sql ===
drop policy if exists challenge_participants_update_self_or_creator on public.challenge_participants;

-- === original: 202602190201_krux_beta_part2_s200.sql ===
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

-- === original: 202602190202_krux_beta_part2_s201.sql ===
-- Leaderboards read-only for clients

drop policy if exists leaderboards_select_all on public.leaderboards;

-- === original: 202602190203_krux_beta_part2_s202.sql ===
create policy leaderboards_select_all
on public.leaderboards for select to authenticated
using (true);

-- === original: 202602190204_krux_beta_part2_s203.sql ===
drop policy if exists leaderboard_entries_select_all on public.leaderboard_entries;

-- === original: 202602190205_krux_beta_part2_s204.sql ===
create policy leaderboard_entries_select_all
on public.leaderboard_entries for select to authenticated
using (true);

-- === original: 202602190206_krux_beta_part2_s205.sql ===
drop policy if exists leaderboards_manage_service_or_staff on public.leaderboards;

-- === original: 202602190207_krux_beta_part2_s206.sql ===
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

-- === original: 202602190208_krux_beta_part2_s207.sql ===
drop policy if exists leaderboard_entries_manage_service on public.leaderboard_entries;

-- === original: 202602190209_krux_beta_part2_s208.sql ===
create policy leaderboard_entries_manage_service
on public.leaderboard_entries for all to authenticated
using (public.is_service_role())
with check (public.is_service_role());

-- === original: 202602190210_krux_beta_part2_s209.sql ===
-- Gym plans/memberships/classes/bookings

drop policy if exists gym_membership_plans_select_visible on public.gym_membership_plans;

-- === original: 202602190211_krux_beta_part2_s210.sql ===
create policy gym_membership_plans_select_visible
on public.gym_membership_plans for select to authenticated
using (public.can_view_gym(gym_id, auth.uid()));

-- === original: 202602190212_krux_beta_part2_s211.sql ===
drop policy if exists gym_membership_plans_manage_staff on public.gym_membership_plans;

-- === original: 202602190213_krux_beta_part2_s212.sql ===
create policy gym_membership_plans_manage_staff
on public.gym_membership_plans for all to authenticated
using (public.is_gym_staff(gym_id, auth.uid()))
with check (public.is_gym_staff(gym_id, auth.uid()));

-- === original: 202602190214_krux_beta_part2_s213.sql ===
drop policy if exists gym_memberships_select_self_or_staff on public.gym_memberships;

-- === original: 202602190215_krux_beta_part2_s214.sql ===
create policy gym_memberships_select_self_or_staff
on public.gym_memberships for select to authenticated
using (user_id = auth.uid() or public.is_gym_staff(gym_id, auth.uid()));

-- === original: 202602190216_krux_beta_part2_s215.sql ===
drop policy if exists gym_memberships_insert_self_or_staff on public.gym_memberships;

-- === original: 202602190217_krux_beta_part2_s216.sql ===
create policy gym_memberships_insert_self_or_staff
on public.gym_memberships for insert to authenticated
with check (user_id = auth.uid() or public.is_gym_staff(gym_id, auth.uid()));

-- === original: 202602190218_krux_beta_part2_s217.sql ===
drop policy if exists gym_memberships_update_self_or_staff on public.gym_memberships;

-- === original: 202602190219_krux_beta_part2_s218.sql ===
create policy gym_memberships_update_self_or_staff
on public.gym_memberships for update to authenticated
using (user_id = auth.uid() or public.is_gym_staff(gym_id, auth.uid()))
with check (user_id = auth.uid() or public.is_gym_staff(gym_id, auth.uid()));

-- === original: 202602190220_krux_beta_part2_s219.sql ===
drop policy if exists gym_classes_select_visible on public.gym_classes;

-- === original: 202602190221_krux_beta_part2_s220.sql ===
create policy gym_classes_select_visible
on public.gym_classes for select to authenticated
using (public.can_view_gym(gym_id, auth.uid()));

-- === original: 202602190222_krux_beta_part2_s221.sql ===
drop policy if exists gym_classes_manage_staff on public.gym_classes;

-- === original: 202602190223_krux_beta_part2_s222.sql ===
create policy gym_classes_manage_staff
on public.gym_classes for all to authenticated
using (public.is_gym_staff(gym_id, auth.uid()))
with check (public.is_gym_staff(gym_id, auth.uid()));

-- === original: 202602190224_krux_beta_part2_s223.sql ===
drop policy if exists class_bookings_select_self_or_staff on public.class_bookings;

-- === original: 202602190225_krux_beta_part2_s224.sql ===
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

-- === original: 202602190226_krux_beta_part2_s225.sql ===
drop policy if exists class_bookings_insert_self_or_staff on public.class_bookings;

-- === original: 202602190227_krux_beta_part2_s226.sql ===
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

-- === original: 202602190228_krux_beta_part2_s227.sql ===
drop policy if exists class_bookings_update_self_or_staff on public.class_bookings;

-- === original: 202602190229_krux_beta_part2_s228.sql ===
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

-- === original: 202602190230_krux_beta_part2_s229.sql ===
-- Waitlist

drop policy if exists class_waitlist_select_self_or_staff on public.class_waitlist;

-- === original: 202602190231_krux_beta_part2_s230.sql ===
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

-- === original: 202602190232_krux_beta_part2_s231.sql ===
drop policy if exists class_waitlist_insert_self on public.class_waitlist;

-- === original: 202602190233_krux_beta_part2_s232.sql ===
create policy class_waitlist_insert_self
on public.class_waitlist for insert to authenticated
with check (user_id = auth.uid());

-- === original: 202602190234_krux_beta_part2_s233.sql ===
drop policy if exists class_waitlist_update_self_or_staff on public.class_waitlist;

-- === original: 202602190235_krux_beta_part2_s234.sql ===
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

-- === original: 202602190236_krux_beta_part2_s235.sql ===
-- Waivers

drop policy if exists waivers_select_visible on public.waivers;

-- === original: 202602190237_krux_beta_part2_s236.sql ===
create policy waivers_select_visible
on public.waivers for select to authenticated
using (public.can_view_gym(gym_id, auth.uid()));

-- === original: 202602190238_krux_beta_part2_s237.sql ===
drop policy if exists waivers_manage_staff on public.waivers;

-- === original: 202602190239_krux_beta_part2_s238.sql ===
create policy waivers_manage_staff
on public.waivers for all to authenticated
using (public.is_gym_staff(gym_id, auth.uid()))
with check (public.is_gym_staff(gym_id, auth.uid()));

-- === original: 202602190240_krux_beta_part2_s239.sql ===
drop policy if exists waiver_acceptances_select_self_or_staff on public.waiver_acceptances;

-- === original: 202602190241_krux_beta_part2_s240.sql ===
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

-- === original: 202602190242_krux_beta_part2_s241.sql ===
drop policy if exists waiver_acceptances_insert_self on public.waiver_acceptances;

-- === original: 202602190243_krux_beta_part2_s242.sql ===
create policy waiver_acceptances_insert_self
on public.waiver_acceptances for insert to authenticated
with check (user_id = auth.uid());

-- === original: 202602190244_krux_beta_part2_s243.sql ===
drop policy if exists contracts_select_visible on public.contracts;

-- === original: 202602190245_krux_beta_part2_s244.sql ===
create policy contracts_select_visible
on public.contracts for select to authenticated
using (public.can_view_gym(gym_id, auth.uid()));

-- === original: 202602190246_krux_beta_part2_s245.sql ===
drop policy if exists contracts_manage_staff on public.contracts;

-- === original: 202602190247_krux_beta_part2_s246.sql ===
create policy contracts_manage_staff
on public.contracts for all to authenticated
using (public.is_gym_staff(gym_id, auth.uid()))
with check (public.is_gym_staff(gym_id, auth.uid()));

-- === original: 202602190248_krux_beta_part2_s247.sql ===
drop policy if exists contract_acceptances_select_self_or_staff on public.contract_acceptances;

-- === original: 202602190249_krux_beta_part2_s248.sql ===
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

-- === original: 202602190250_krux_beta_part2_s249.sql ===
drop policy if exists contract_acceptances_insert_self on public.contract_acceptances;

-- === original: 202602190251_krux_beta_part2_s250.sql ===
create policy contract_acceptances_insert_self
on public.contract_acceptances for insert to authenticated
with check (user_id = auth.uid());

-- === original: 202602190252_krux_beta_part2_s251.sql ===
-- Check-ins/access

drop policy if exists gym_checkins_select_self_or_staff on public.gym_checkins;

-- === original: 202602190253_krux_beta_part2_s252.sql ===
create policy gym_checkins_select_self_or_staff
on public.gym_checkins for select to authenticated
using (user_id = auth.uid() or public.is_gym_staff(gym_id, auth.uid()));

-- === original: 202602190254_krux_beta_part2_s253.sql ===
drop policy if exists gym_checkins_insert_self_or_staff on public.gym_checkins;

-- === original: 202602190255_krux_beta_part2_s254.sql ===
create policy gym_checkins_insert_self_or_staff
on public.gym_checkins for insert to authenticated
with check (user_id = auth.uid() or public.is_gym_staff(gym_id, auth.uid()));

-- === original: 202602190256_krux_beta_part2_s255.sql ===
drop policy if exists access_logs_select_staff_or_self on public.access_logs;

-- === original: 202602190257_krux_beta_part2_s256.sql ===
create policy access_logs_select_staff_or_self
on public.access_logs for select to authenticated
using ((user_id is not null and user_id = auth.uid()) or public.is_gym_staff(gym_id, auth.uid()));

-- === original: 202602190258_krux_beta_part2_s257.sql ===
drop policy if exists access_logs_insert_staff_or_service on public.access_logs;

-- === original: 202602190259_krux_beta_part2_s258.sql ===
create policy access_logs_insert_staff_or_service
on public.access_logs for insert to authenticated
with check (public.is_service_role() or public.is_gym_staff(gym_id, auth.uid()));

-- === original: 202602190260_krux_beta_part2_s259.sql ===
-- Billing

drop policy if exists member_subscriptions_select_self_or_staff on public.member_subscriptions;

-- === original: 202602190261_krux_beta_part2_s260.sql ===
create policy member_subscriptions_select_self_or_staff
on public.member_subscriptions for select to authenticated
using (user_id = auth.uid() or public.is_gym_staff(gym_id, auth.uid()));

-- === original: 202602190262_krux_beta_part2_s261.sql ===
drop policy if exists member_subscriptions_manage_service_or_staff on public.member_subscriptions;

-- === original: 202602190263_krux_beta_part2_s262.sql ===
create policy member_subscriptions_manage_service_or_staff
on public.member_subscriptions for all to authenticated
using (public.is_service_role() or public.is_gym_staff(gym_id, auth.uid()))
with check (public.is_service_role() or public.is_gym_staff(gym_id, auth.uid()));

-- === original: 202602190264_krux_beta_part2_s263.sql ===
drop policy if exists invoices_select_self_or_staff on public.invoices;

-- === original: 202602190265_krux_beta_part2_s264.sql ===
create policy invoices_select_self_or_staff
on public.invoices for select to authenticated
using (user_id = auth.uid() or public.is_gym_staff(gym_id, auth.uid()));

-- === original: 202602190266_krux_beta_part2_s265.sql ===
drop policy if exists invoices_manage_service_or_staff on public.invoices;

-- === original: 202602190267_krux_beta_part2_s266.sql ===
create policy invoices_manage_service_or_staff
on public.invoices for all to authenticated
using (public.is_service_role() or public.is_gym_staff(gym_id, auth.uid()))
with check (public.is_service_role() or public.is_gym_staff(gym_id, auth.uid()));

-- === original: 202602190268_krux_beta_part2_s267.sql ===
drop policy if exists payment_transactions_select_self_or_staff on public.payment_transactions;

-- === original: 202602190269_krux_beta_part2_s268.sql ===
create policy payment_transactions_select_self_or_staff
on public.payment_transactions for select to authenticated
using ((user_id is not null and user_id = auth.uid()) or public.is_gym_staff(gym_id, auth.uid()));

-- === original: 202602190270_krux_beta_part2_s269.sql ===
drop policy if exists payment_transactions_manage_service_or_staff on public.payment_transactions;

-- === original: 202602190271_krux_beta_part2_s270.sql ===
create policy payment_transactions_manage_service_or_staff
on public.payment_transactions for all to authenticated
using (public.is_service_role() or public.is_gym_staff(gym_id, auth.uid()))
with check (public.is_service_role() or public.is_gym_staff(gym_id, auth.uid()));

-- === original: 202602190272_krux_beta_part2_s271.sql ===
drop policy if exists refunds_select_self_or_staff on public.refunds;

-- === original: 202602190273_krux_beta_part2_s272.sql ===
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

-- === original: 202602190274_krux_beta_part2_s273.sql ===
drop policy if exists refunds_manage_service_or_staff on public.refunds;

-- === original: 202602190275_krux_beta_part2_s274.sql ===
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

-- === original: 202602190276_krux_beta_part2_s275.sql ===
drop policy if exists dunning_events_select_self_or_staff on public.dunning_events;

-- === original: 202602190277_krux_beta_part2_s276.sql ===
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

-- === original: 202602190278_krux_beta_part2_s277.sql ===
drop policy if exists dunning_events_manage_service_or_staff on public.dunning_events;

-- === original: 202602190279_krux_beta_part2_s278.sql ===
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

-- === original: 202602190280_krux_beta_part2_s279.sql ===
-- Integration

drop policy if exists device_connections_select_self on public.device_connections;

-- === original: 202602190281_krux_beta_part2_s280.sql ===
create policy device_connections_select_self
on public.device_connections for select to authenticated
using (user_id = auth.uid());

-- === original: 202602190282_krux_beta_part2_s281.sql ===
drop policy if exists device_connections_insert_self on public.device_connections;

-- === original: 202602190283_krux_beta_part2_s282.sql ===
create policy device_connections_insert_self
on public.device_connections for insert to authenticated
with check (user_id = auth.uid());

-- === original: 202602190284_krux_beta_part2_s283.sql ===
drop policy if exists device_connections_update_self_or_service on public.device_connections;

-- === original: 202602190285_krux_beta_part2_s284.sql ===
create policy device_connections_update_self_or_service
on public.device_connections for update to authenticated
using (user_id = auth.uid() or public.is_service_role())
with check (user_id = auth.uid() or public.is_service_role());

-- === original: 202602190286_krux_beta_part2_s285.sql ===
drop policy if exists device_sync_jobs_select_self on public.device_sync_jobs;

-- === original: 202602190287_krux_beta_part2_s286.sql ===
create policy device_sync_jobs_select_self
on public.device_sync_jobs for select to authenticated
using (user_id = auth.uid());

-- === original: 202602190288_krux_beta_part2_s287.sql ===
drop policy if exists device_sync_jobs_insert_self_or_service on public.device_sync_jobs;

-- === original: 202602190289_krux_beta_part2_s288.sql ===
create policy device_sync_jobs_insert_self_or_service
on public.device_sync_jobs for insert to authenticated
with check (user_id = auth.uid() or public.is_service_role());

-- === original: 202602190290_krux_beta_part2_s289.sql ===
drop policy if exists device_sync_jobs_update_service_or_self on public.device_sync_jobs;

-- === original: 202602190291_krux_beta_part2_s290.sql ===
create policy device_sync_jobs_update_service_or_self
on public.device_sync_jobs for update to authenticated
using (public.is_service_role() or requested_by = auth.uid())
with check (public.is_service_role() or requested_by = auth.uid());

-- === original: 202602190292_krux_beta_part2_s291.sql ===
drop policy if exists external_activity_imports_select_self on public.external_activity_imports;

-- === original: 202602190293_krux_beta_part2_s292.sql ===
create policy external_activity_imports_select_self
on public.external_activity_imports for select to authenticated
using (user_id = auth.uid());

-- === original: 202602190294_krux_beta_part2_s293.sql ===
drop policy if exists external_activity_imports_manage_service on public.external_activity_imports;

-- === original: 202602190295_krux_beta_part2_s294.sql ===
create policy external_activity_imports_manage_service
on public.external_activity_imports for all to authenticated
using (public.is_service_role())
with check (public.is_service_role());

-- === original: 202602190296_krux_beta_part2_s295.sql ===
drop policy if exists integration_webhook_events_service_only on public.integration_webhook_events;

-- === original: 202602190297_krux_beta_part2_s296.sql ===
create policy integration_webhook_events_service_only
on public.integration_webhook_events for all to authenticated
using (public.is_service_role())
with check (public.is_service_role());

-- === original: 202602190298_krux_beta_part2_s297.sql ===
-- Notification + social safety

drop policy if exists notification_preferences_self on public.notification_preferences;

-- === original: 202602190299_krux_beta_part2_s298.sql ===
create policy notification_preferences_self
on public.notification_preferences for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- === original: 202602190300_krux_beta_part2_s299.sql ===
drop policy if exists user_blocks_select_party on public.user_blocks;

-- === original: 202602190301_krux_beta_part2_s300.sql ===
create policy user_blocks_select_party
on public.user_blocks for select to authenticated
using (blocker_user_id = auth.uid() or blocked_user_id = auth.uid());

-- === original: 202602190302_krux_beta_part2_s301.sql ===
drop policy if exists user_blocks_insert_self on public.user_blocks;

-- === original: 202602190303_krux_beta_part2_s302.sql ===
create policy user_blocks_insert_self
on public.user_blocks for insert to authenticated
with check (blocker_user_id = auth.uid());

-- === original: 202602190304_krux_beta_part2_s303.sql ===
drop policy if exists user_blocks_delete_self on public.user_blocks;

-- === original: 202602190305_krux_beta_part2_s304.sql ===
create policy user_blocks_delete_self
on public.user_blocks for delete to authenticated
using (blocker_user_id = auth.uid());

-- === original: 202602190306_krux_beta_part2_s305.sql ===
drop policy if exists user_reports_select_reporter_or_staff on public.user_reports;

-- === original: 202602190307_krux_beta_part2_s306.sql ===
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

-- === original: 202602190308_krux_beta_part2_s307.sql ===
drop policy if exists user_reports_insert_reporter on public.user_reports;

-- === original: 202602190309_krux_beta_part2_s308.sql ===
create policy user_reports_insert_reporter
on public.user_reports for insert to authenticated
with check (reporter_user_id = auth.uid());

-- === original: 202602190310_krux_beta_part2_s309.sql ===
drop policy if exists user_reports_update_staff_or_service on public.user_reports;

-- === original: 202602190311_krux_beta_part2_s310.sql ===
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

-- === original: 202602190312_krux_beta_part2_s311.sql ===
-- Compliance

drop policy if exists policy_versions_select on public.policy_version_tracking;

-- === original: 202602190313_krux_beta_part2_s312.sql ===
create policy policy_versions_select
on public.policy_version_tracking for select to authenticated
using (true);

-- === original: 202602190314_krux_beta_part2_s313.sql ===
drop policy if exists policy_versions_manage_service on public.policy_version_tracking;

-- === original: 202602190315_krux_beta_part2_s314.sql ===
create policy policy_versions_manage_service
on public.policy_version_tracking for all to authenticated
using (public.is_service_role())
with check (public.is_service_role());

-- === original: 202602190316_krux_beta_part2_s315.sql ===
drop policy if exists consents_select_self on public.consents;

-- === original: 202602190317_krux_beta_part2_s316.sql ===
create policy consents_select_self
on public.consents for select to authenticated
using (user_id = auth.uid() or public.is_service_role());

-- === original: 202602190318_krux_beta_part2_s317.sql ===
drop policy if exists consents_insert_self on public.consents;

-- === original: 202602190319_krux_beta_part2_s318.sql ===
create policy consents_insert_self
on public.consents for insert to authenticated
with check (user_id = auth.uid() or public.is_service_role());

-- === original: 202602190320_krux_beta_part2_s319.sql ===
drop policy if exists consents_update_self_or_service on public.consents;

-- === original: 202602190321_krux_beta_part2_s320.sql ===
create policy consents_update_self_or_service
on public.consents for update to authenticated
using (user_id = auth.uid() or public.is_service_role())
with check (user_id = auth.uid() or public.is_service_role());

-- === original: 202602190322_krux_beta_part2_s321.sql ===
drop policy if exists privacy_requests_select_self_or_service on public.privacy_requests;

-- === original: 202602190323_krux_beta_part2_s322.sql ===
create policy privacy_requests_select_self_or_service
on public.privacy_requests for select to authenticated
using (user_id = auth.uid() or public.is_service_role());

-- === original: 202602190324_krux_beta_part2_s323.sql ===
drop policy if exists privacy_requests_insert_self on public.privacy_requests;

-- === original: 202602190325_krux_beta_part2_s324.sql ===
create policy privacy_requests_insert_self
on public.privacy_requests for insert to authenticated
with check (user_id = auth.uid() or public.is_service_role());

-- === original: 202602190326_krux_beta_part2_s325.sql ===
drop policy if exists privacy_requests_update_service on public.privacy_requests;

-- === original: 202602190327_krux_beta_part2_s326.sql ===
create policy privacy_requests_update_service
on public.privacy_requests for update to authenticated
using (public.is_service_role())
with check (public.is_service_role());

-- === original: 202602190328_krux_beta_part2_s327.sql ===
drop policy if exists audit_logs_select_service_or_staff on public.audit_logs;

-- === original: 202602190329_krux_beta_part2_s328.sql ===
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

-- === original: 202602190330_krux_beta_part2_s329.sql ===
drop policy if exists audit_logs_insert_service_or_staff on public.audit_logs;

-- === original: 202602190331_krux_beta_part2_s330.sql ===
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

-- === original: 202602190332_krux_beta_part2_s331.sql ===
drop policy if exists event_outbox_service_only on public.event_outbox;

-- === original: 202602190333_krux_beta_part2_s332.sql ===
create policy event_outbox_service_only
on public.event_outbox for all to authenticated
using (public.is_service_role())
with check (public.is_service_role());

-- === original: 202602190334_krux_beta_part2_s333.sql ===
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

-- === original: 202602190335_krux_beta_part2_s334.sql ===
drop trigger if exists trg_audit_logs_no_update on public.audit_logs;

-- === original: 202602190336_krux_beta_part2_s335.sql ===
create trigger trg_audit_logs_no_update
before update or delete on public.audit_logs
for each row execute function public.prevent_mutation();

-- === original: 202602190337_krux_beta_part2_s336.sql ===
drop trigger if exists trg_webhook_events_no_delete on public.integration_webhook_events;

-- === original: 202602190338_krux_beta_part2_s337.sql ===
create trigger trg_webhook_events_no_delete
before delete on public.integration_webhook_events
for each row execute function public.prevent_mutation();

-- === original: 202602190339_krux_beta_part2_s338.sql ===
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

-- === original: 202602190340_krux_beta_part2_s339.sql ===
drop trigger if exists trg_seed_notification_preferences on public.profiles;

-- === original: 202602190341_krux_beta_part2_s340.sql ===
create trigger trg_seed_notification_preferences
after insert on public.profiles
for each row execute function public.seed_notification_preferences();

-- === original: 202602190342_krux_beta_part3_s001.sql ===
create or replace function public.admin_list_user_consents(
  p_gym_id uuid,
  p_user_id uuid
)
returns setof public.consents
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_gym_staff(p_gym_id, auth.uid()) then
    raise exception 'Gym staff access is required';
  end if;

  if not exists (
    select 1
    from public.gym_memberships gm
    where gm.gym_id = p_gym_id
      and gm.user_id = p_user_id
  ) then
    raise exception 'Target user is not a member of this gym';
  end if;

  return query
  select c.*
  from public.consents c
  where c.user_id = p_user_id
  order by c.granted_at desc;
end;
$$;

-- === original: 202602190343_krux_beta_part3_s002.sql ===
revoke all on function public.admin_list_user_consents(uuid, uuid) from public;

-- === original: 202602190344_krux_beta_part3_s003.sql ===
grant execute on function public.admin_list_user_consents(uuid, uuid) to authenticated;

-- === original: 202602190345_krux_beta_part3_s004.sql ===
create or replace function public.admin_list_open_privacy_requests(
  p_gym_id uuid
)
returns table (
  id uuid,
  user_id uuid,
  request_type public.privacy_request_type,
  status public.privacy_request_status,
  submitted_at timestamptz,
  due_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_gym_staff(p_gym_id, auth.uid()) then
    raise exception 'Gym staff access is required';
  end if;

  return query
  select
    pr.id,
    pr.user_id,
    pr.request_type,
    pr.status,
    pr.submitted_at,
    pr.due_at
  from public.privacy_requests pr
  where pr.status in ('submitted', 'in_review')
    and exists (
      select 1
      from public.gym_memberships gm
      where gm.gym_id = p_gym_id
        and gm.user_id = pr.user_id
    )
  order by pr.submitted_at asc;
end;
$$;

-- === original: 202602190346_krux_beta_part3_s005.sql ===
revoke all on function public.admin_list_open_privacy_requests(uuid) from public;

-- === original: 202602190347_krux_beta_part3_s006.sql ===
grant execute on function public.admin_list_open_privacy_requests(uuid) to authenticated;

-- === original: 202602190348_krux_beta_part3_s007.sql ===
create or replace function public.admin_get_gym_ops_summary(
  p_gym_id uuid
)
returns table (
  gym_id uuid,
  pending_memberships integer,
  active_or_trial_members integer,
  upcoming_classes integer,
  pending_waitlist_entries integer,
  open_privacy_requests integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_gym_staff(p_gym_id, auth.uid()) then
    raise exception 'Gym staff access is required';
  end if;

  return query
  select
    p_gym_id as gym_id,
    coalesce((
      select count(*)::integer
      from public.gym_memberships gm
      where gm.gym_id = p_gym_id
        and gm.membership_status = 'pending'
    ), 0) as pending_memberships,
    coalesce((
      select count(*)::integer
      from public.gym_memberships gm
      where gm.gym_id = p_gym_id
        and gm.membership_status in ('trial', 'active')
    ), 0) as active_or_trial_members,
    coalesce((
      select count(*)::integer
      from public.gym_classes gc
      where gc.gym_id = p_gym_id
        and gc.status = 'scheduled'
        and gc.starts_at >= now()
    ), 0) as upcoming_classes,
    coalesce((
      select count(*)::integer
      from public.class_waitlist cw
      join public.gym_classes gc on gc.id = cw.class_id
      where gc.gym_id = p_gym_id
        and gc.status = 'scheduled'
        and gc.starts_at >= now()
        and cw.status = 'pending'
    ), 0) as pending_waitlist_entries,
    coalesce((
      select count(*)::integer
      from public.privacy_requests pr
      where pr.status in ('submitted', 'in_review')
        and exists (
          select 1
          from public.gym_memberships gm
          where gm.gym_id = p_gym_id
            and gm.user_id = pr.user_id
        )
    ), 0) as open_privacy_requests;
end;
$$;

-- === original: 202602190349_krux_beta_part3_s008.sql ===
revoke all on function public.admin_get_gym_ops_summary(uuid) from public;

-- === original: 202602190350_krux_beta_part3_s009.sql ===
grant execute on function public.admin_get_gym_ops_summary(uuid) to authenticated;

-- === original: 202602190351_krux_beta_part3_s010.sql ===
create or replace function public.apply_workout_pr_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workout_id uuid;
  v_user_id uuid;
  v_exercise_id uuid;
  v_estimated_1rm numeric(14,3);
  v_previous_best numeric(14,3);
  v_workout_has_pr boolean;
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  select
    we.workout_id,
    w.user_id,
    we.exercise_id
  into
    v_workout_id,
    v_user_id,
    v_exercise_id
  from public.workout_exercises we
  join public.workouts w on w.id = we.workout_id
  where we.id = new.workout_exercise_id;

  if v_workout_id is null then
    return new;
  end if;

  if coalesce(new.reps, 0) > 0 and coalesce(new.weight_kg, 0) > 0 then
    v_estimated_1rm := (new.weight_kg * (1 + (new.reps::numeric / 30.0)))::numeric(14,3);

    select max((ws.weight_kg * (1 + (ws.reps::numeric / 30.0)))::numeric(14,3))
    into v_previous_best
    from public.workout_sets ws
    join public.workout_exercises we2 on we2.id = ws.workout_exercise_id
    join public.workouts w2 on w2.id = we2.workout_id
    where w2.user_id = v_user_id
      and we2.exercise_id = v_exercise_id
      and ws.id <> new.id
      and coalesce(ws.reps, 0) > 0
      and coalesce(ws.weight_kg, 0) > 0;

    if v_previous_best is null or v_estimated_1rm > v_previous_best then
      if new.is_pr is distinct from true then
        update public.workout_sets
        set is_pr = true
        where id = new.id;
      end if;
    end if;
  end if;

  update public.workouts w
  set is_pr = exists (
    select 1
    from public.workout_exercises we3
    join public.workout_sets ws3 on ws3.workout_exercise_id = we3.id
    where we3.workout_id = v_workout_id
      and ws3.is_pr = true
  )
  where w.id = v_workout_id;

  select w.is_pr into v_workout_has_pr
  from public.workouts w
  where w.id = v_workout_id;

  if v_workout_has_pr then
    if not exists (
      select 1
      from public.feed_events fe
      where fe.workout_id = v_workout_id
        and fe.event_type = 'pr_verified'
    ) then
      insert into public.feed_events(user_id, workout_id, event_type, caption, metadata)
      values (
        v_user_id,
        v_workout_id,
        'pr_verified',
        'PR forged. Post the proof.',
        jsonb_build_object('source', 'system_pr_detection')
      );
    end if;

    if not exists (
      select 1
      from public.event_outbox eo
      where eo.event_type = 'pr.verified'
        and eo.aggregate_type = 'workout'
        and eo.aggregate_id = v_workout_id
    ) then
      insert into public.event_outbox(event_type, aggregate_type, aggregate_id, payload)
      values (
        'pr.verified',
        'workout',
        v_workout_id,
        jsonb_build_object(
          'user_id', v_user_id,
          'workout_id', v_workout_id,
          'workout_set_id', new.id,
          'estimated_1rm', v_estimated_1rm
        )
      );
    end if;
  end if;

  return new;
end;
$$;

-- === original: 202602190352_krux_beta_part3_s011.sql ===
drop trigger if exists trg_workout_sets_detect_pr on public.workout_sets;

-- === original: 202602190353_krux_beta_part3_s012.sql ===
create trigger trg_workout_sets_detect_pr
after insert or update of reps, weight_kg, is_pr
on public.workout_sets
for each row execute function public.apply_workout_pr_trigger();

-- === original: 202602190354_krux_beta_part3_s013.sql ===
revoke all on function public.apply_workout_pr_trigger() from public;

-- === original: 202602190355_krux_beta_part3_s014.sql ===
create table if not exists public.push_notification_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_id text not null,
  platform text not null check (platform in ('ios','android','web')),
  push_token text not null,
  is_active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, device_id),
  unique(user_id, push_token)
);

-- === original: 202602190356_krux_beta_part3_s015.sql ===
create index if not exists idx_push_tokens_user_active on public.push_notification_tokens(user_id, is_active, updated_at desc);

-- === original: 202602190357_krux_beta_part3_s016.sql ===
create index if not exists idx_push_tokens_platform_active on public.push_notification_tokens(platform, is_active, updated_at desc);

-- === original: 202602190358_krux_beta_part3_s017.sql ===
drop trigger if exists trg_push_notification_tokens_set_updated_at on public.push_notification_tokens;

-- === original: 202602190359_krux_beta_part3_s018.sql ===
create trigger trg_push_notification_tokens_set_updated_at before update on public.push_notification_tokens
for each row execute function public.set_updated_at();

-- === original: 202602190360_krux_beta_part3_s019.sql ===
alter table public.push_notification_tokens enable row level security;

-- === original: 202602190361_krux_beta_part3_s020.sql ===
create policy push_notification_tokens_self
on public.push_notification_tokens for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- === original: 202602190362_krux_beta_part3_s021.sql ===
alter view if exists public.checkins set (security_invoker = true);

-- === original: 202602190363_krux_beta_part3_s022.sql ===
alter view if exists public.user_blocks_reports set (security_invoker = true);

-- === original: 202602190364_krux_beta_part3_s023.sql ===
create or replace function public.admin_record_waiver_acceptance(
  p_waiver_id uuid,
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

  select w.gym_id
  into v_gym_id
  from public.waivers w
  where w.id = p_waiver_id
    and w.is_active = true;

  if v_gym_id is null then
    raise exception 'Waiver is not active';
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

  insert into public.waiver_acceptances(
    waiver_id,
    user_id,
    gym_membership_id,
    accepted_at,
    source,
    locale,
    signature_data
  )
  values (
    p_waiver_id,
    p_user_id,
    p_membership_id,
    now(),
    coalesce(nullif(p_source, ''), 'admin'),
    coalesce((auth.jwt() ->> 'locale'), 'en'),
    coalesce(p_signature_data, '{}'::jsonb)
  )
  on conflict (waiver_id, user_id)
  do update
    set accepted_at = now(),
        source = excluded.source,
        signature_data = excluded.signature_data
  returning id into v_id;

  perform public.append_audit_log(
    'waiver.accepted_admin',
    'waiver_acceptances',
    v_id,
    'Staff recorded waiver acceptance',
    jsonb_build_object('waiver_id', p_waiver_id, 'user_id', p_user_id)
  );

  return v_id;
end;
$$;

-- === original: 202602190365_krux_beta_part3_s024.sql ===
revoke all on function public.admin_record_waiver_acceptance(uuid, uuid, uuid, jsonb, text) from public;

-- === original: 202602190366_krux_beta_part3_s025.sql ===
grant execute on function public.admin_record_waiver_acceptance(uuid, uuid, uuid, jsonb, text) to authenticated;

-- === original: 202602190367_krux_beta_part3_s026.sql ===
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

-- === original: 202602190368_krux_beta_part3_s027.sql ===
revoke all on function public.admin_record_contract_acceptance(uuid, uuid, uuid, jsonb, text) from public;

-- === original: 202602190369_krux_beta_part3_s028.sql ===
grant execute on function public.admin_record_contract_acceptance(uuid, uuid, uuid, jsonb, text) to authenticated;

-- === original: 202602190370_krux_beta_part3_s029.sql ===
create table if not exists public.device_sync_cursors (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null unique references public.device_connections(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider public.integration_provider not null,
  cursor jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  last_job_id uuid references public.device_sync_jobs(id) on delete set null,
  last_webhook_event_id uuid references public.integration_webhook_events(id) on delete set null,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- === original: 202602190371_krux_beta_part3_s030.sql ===
create unique index if not exists idx_device_sync_cursors_user_provider
  on public.device_sync_cursors(user_id, provider);

-- === original: 202602190372_krux_beta_part3_s031.sql ===
alter table public.device_sync_cursors enable row level security;

-- === original: 202602190373_krux_beta_part3_s032.sql ===
drop policy if exists device_sync_cursors_select_self on public.device_sync_cursors;

-- === original: 202602190374_krux_beta_part3_s033.sql ===
create policy device_sync_cursors_select_self
on public.device_sync_cursors for select to authenticated
using (user_id = auth.uid());

-- === original: 202602190375_krux_beta_part3_s034.sql ===
drop policy if exists device_sync_cursors_manage_service on public.device_sync_cursors;

-- === original: 202602190376_krux_beta_part3_s035.sql ===
create policy device_sync_cursors_manage_service
on public.device_sync_cursors for all to authenticated
using (public.is_service_role())
with check (public.is_service_role());

-- === original: 202602190377_krux_beta_part3_s036.sql ===
drop trigger if exists trg_device_sync_cursors_set_updated_at on public.device_sync_cursors;

-- === original: 202602190378_krux_beta_part3_s037.sql ===
create trigger trg_device_sync_cursors_set_updated_at before update on public.device_sync_cursors
for each row execute function public.set_updated_at();

-- === original: 202602190379_krux_beta_part3_s038.sql ===
alter table public.device_sync_jobs
add column if not exists source_webhook_event_id uuid references public.integration_webhook_events(id) on delete set null;

-- === original: 202602190380_krux_beta_part3_s039.sql ===
create unique index if not exists idx_sync_jobs_connection_webhook_event
  on public.device_sync_jobs(connection_id, source_webhook_event_id);

-- === original: 202602190381_krux_beta_part3_s040.sql ===
create index if not exists idx_sync_jobs_status_next_retry
  on public.device_sync_jobs(status, next_retry_at, created_at);

-- === original: 202602190382_krux_beta_part3_s041.sql ===
create or replace function public.rebuild_leaderboard_scope(p_leaderboard_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lb public.leaderboards%rowtype;
  v_count integer := 0;
  v_actor uuid := auth.uid();
begin
  select *
  into v_lb
  from public.leaderboards
  where id = p_leaderboard_id;

  if v_lb.id is null then
    raise exception 'Leaderboard not found';
  end if;

  if not public.is_service_role() then
    if v_actor is null then
      raise exception 'Authentication required';
    end if;

    if not (
      v_lb.scope = 'gym'
      and v_lb.scope_gym_id is not null
      and public.is_gym_staff(v_lb.scope_gym_id, v_actor)
    ) then
      raise exception 'Not authorized to rebuild this leaderboard';
    end if;
  end if;

  delete from public.leaderboard_entries
  where leaderboard_id = p_leaderboard_id;

  if v_lb.metric = 'xp' then
    insert into public.leaderboard_entries(leaderboard_id, user_id, rank, score, details)
    select
      p_leaderboard_id,
      p.id,
      row_number() over (order by p.xp_total desc, p.id asc),
      p.xp_total::numeric(14,3),
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
      row_number() over (order by p.chain_days desc, p.id asc),
      p.chain_days::numeric(14,3),
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
      row_number() over (order by x.score desc, x.user_id asc),
      x.score,
      jsonb_build_object(
        'metric',
        'volume_kg',
        'starts_at',
        v_lb.starts_at,
        'ends_at',
        v_lb.ends_at,
        'workout_count',
        x.workout_count
      )
    from (
      select
        w.user_id,
        count(*)::integer as workout_count,
        coalesce(sum(w.total_volume_kg), 0)::numeric(14,3) as score
      from public.workouts w
      where w.started_at >= v_lb.starts_at
        and w.started_at < v_lb.ends_at
        and coalesce(w.total_sets, 0) between 1 and 400
        and coalesce(w.total_volume_kg, 0) between 0 and 50000
        and (w.source <> 'manual' or coalesce(w.total_volume_kg, 0) <= 12000)
        and (
          v_lb.scope = 'global'
          or (v_lb.scope = 'gym' and w.gym_id = v_lb.scope_gym_id)
          or (v_lb.scope = 'exercise' and exists (
            select 1 from public.workout_exercises we
            where we.workout_id = w.id
              and we.exercise_id = v_lb.scope_exercise_id
          ))
        )
      group by w.user_id
      having coalesce(sum(w.total_volume_kg), 0) > 0
    ) x
    limit 500;

  elsif v_lb.metric = 'estimated_1rm' then
    insert into public.leaderboard_entries(leaderboard_id, user_id, rank, score, details)
    select
      p_leaderboard_id,
      x.user_id,
      row_number() over (order by x.score desc, x.user_id asc),
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
        and coalesce(ws.weight_kg, 0) between 1 and 500
        and coalesce(ws.reps, 0) between 1 and 20
        and (w.source <> 'manual' or coalesce(ws.weight_kg, 0) <= 350)
        and (
          v_lb.scope = 'global'
          or (v_lb.scope = 'gym' and w.gym_id = v_lb.scope_gym_id)
          or (v_lb.scope = 'exercise' and we.exercise_id = v_lb.scope_exercise_id)
        )
      group by w.user_id
    ) x
    where x.score is not null
    limit 500;

  elsif v_lb.metric = 'challenge_score' then
    insert into public.leaderboard_entries(leaderboard_id, user_id, rank, score, details)
    select
      p_leaderboard_id,
      x.user_id,
      row_number() over (
        order by x.score desc, x.completed desc, x.updated_at asc, x.user_id asc
      ),
      x.score,
      jsonb_build_object('metric', 'challenge_score', 'challenge_id', x.challenge_id, 'completed', x.completed)
    from (
      select
        cp.user_id,
        cp.challenge_id,
        cp.completed,
        cp.updated_at,
        cp.score::numeric(14,3) as score
      from public.challenge_participants cp
      join public.challenges c on c.id = cp.challenge_id
      where cp.score between 0 and 1000000
        and (
          (v_lb.scope = 'challenge' and cp.challenge_id = v_lb.scope_challenge_id)
          or (v_lb.scope = 'global')
          or (v_lb.scope = 'gym' and c.gym_id = v_lb.scope_gym_id)
        )
    ) x
    limit 500;
  end if;

  get diagnostics v_count = row_count;

  insert into public.event_outbox(event_type, aggregate_type, aggregate_id, payload)
  values (
    'rank.updated',
    'leaderboard',
    p_leaderboard_id,
    jsonb_build_object(
      'leaderboard_id',
      p_leaderboard_id,
      'rows',
      v_count,
      'metric',
      v_lb.metric,
      'timeframe',
      v_lb.timeframe
    )
  );

  return v_count;
end;
$$;

-- === original: 202602190383_krux_beta_part3_s042.sql ===
revoke all on function public.rebuild_leaderboard_scope(uuid) from public;

-- === original: 202602190384_krux_beta_part3_s043.sql ===
grant execute on function public.rebuild_leaderboard_scope(uuid) to authenticated;

-- === original: 202602190385_krux_beta_part3_s044.sql ===
create or replace function public.join_challenge(p_challenge_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_challenge public.challenges%rowtype;
  v_participant_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_challenge
  from public.challenges
  where id = p_challenge_id;

  if v_challenge.id is null then
    raise exception 'Challenge not found';
  end if;

  if not (
    v_challenge.visibility = 'public'
    or v_challenge.creator_user_id = auth.uid()
    or (
      v_challenge.visibility = 'gym'
      and v_challenge.gym_id is not null
      and public.can_view_gym(v_challenge.gym_id, auth.uid())
    )
  ) then
    raise exception 'Challenge is not visible to this user';
  end if;

  if now() >= v_challenge.ends_at then
    raise exception 'Challenge has already ended';
  end if;

  insert into public.challenge_participants(challenge_id, user_id, score, completed)
  values (p_challenge_id, auth.uid(), 0, false)
  on conflict (challenge_id, user_id)
  do update
    set updated_at = now()
  returning id into v_participant_id;

  insert into public.event_outbox(event_type, aggregate_type, aggregate_id, payload)
  values (
    'challenge.joined',
    'challenge',
    p_challenge_id,
    jsonb_build_object('challenge_id', p_challenge_id, 'participant_id', v_participant_id, 'user_id', auth.uid())
  );

  perform public.append_audit_log(
    'challenge.joined',
    'challenge_participants',
    v_participant_id,
    'User joined challenge',
    jsonb_build_object('challenge_id', p_challenge_id)
  );

  return v_participant_id;
end;
$$;

-- === original: 202602190386_krux_beta_part3_s045.sql ===
revoke all on function public.join_challenge(uuid) from public;

-- === original: 202602190387_krux_beta_part3_s046.sql ===
grant execute on function public.join_challenge(uuid) to authenticated;

-- === original: 202602190388_krux_beta_part3_s047.sql ===
create or replace function public.leave_challenge(p_challenge_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participant_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  delete from public.challenge_participants cp
  where cp.challenge_id = p_challenge_id
    and cp.user_id = auth.uid()
    and cp.completed = false
  returning cp.id into v_participant_id;

  if v_participant_id is null then
    return false;
  end if;

  insert into public.event_outbox(event_type, aggregate_type, aggregate_id, payload)
  values (
    'challenge.left',
    'challenge',
    p_challenge_id,
    jsonb_build_object('challenge_id', p_challenge_id, 'participant_id', v_participant_id, 'user_id', auth.uid())
  );

  perform public.append_audit_log(
    'challenge.left',
    'challenge_participants',
    v_participant_id,
    'User left challenge',
    jsonb_build_object('challenge_id', p_challenge_id)
  );

  return true;
end;
$$;

-- === original: 202602190389_krux_beta_part3_s048.sql ===
revoke all on function public.leave_challenge(uuid) from public;

-- === original: 202602190390_krux_beta_part3_s049.sql ===
grant execute on function public.leave_challenge(uuid) to authenticated;

-- === original: 202602190391_krux_beta_part3_s050.sql ===
create or replace function public.submit_challenge_progress(
  p_challenge_id uuid,
  p_score_delta numeric,
  p_mark_completed boolean default false
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_challenge public.challenges%rowtype;
  v_participant public.challenge_participants%rowtype;
  v_max_delta numeric;
  v_point_delta numeric;
  v_new_score numeric;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_score_delta is null or p_score_delta <= 0 then
    raise exception 'Score delta must be greater than zero';
  end if;

  select *
  into v_challenge
  from public.challenges
  where id = p_challenge_id;

  if v_challenge.id is null then
    raise exception 'Challenge not found';
  end if;

  if now() < v_challenge.starts_at then
    raise exception 'Challenge has not started yet';
  end if;

  if now() >= v_challenge.ends_at then
    raise exception 'Challenge has already ended';
  end if;

  v_max_delta := case v_challenge.challenge_type
    when 'consistency' then 1
    when 'time_based' then 21600
    when 'max_effort' then 1000
    when 'volume' then 50000
    else 10000
  end;

  if p_score_delta > v_max_delta then
    raise exception 'Score delta exceeds allowed threshold for this challenge type';
  end if;

  select *
  into v_participant
  from public.challenge_participants cp
  where cp.challenge_id = p_challenge_id
    and cp.user_id = auth.uid()
  for update;

  if v_participant.id is null then
    raise exception 'Join the challenge before submitting progress';
  end if;

  v_point_delta := round((p_score_delta * v_challenge.points_per_unit)::numeric, 2);

  update public.challenge_participants
  set score = least(score + v_point_delta, 1000000),
      completed = completed or coalesce(p_mark_completed, false),
      updated_at = now()
  where id = v_participant.id
  returning score into v_new_score;

  insert into public.event_outbox(event_type, aggregate_type, aggregate_id, payload)
  values (
    'challenge.progress_updated',
    'challenge',
    p_challenge_id,
    jsonb_build_object(
      'challenge_id',
      p_challenge_id,
      'participant_id',
      v_participant.id,
      'user_id',
      auth.uid(),
      'score_delta',
      v_point_delta,
      'score_total',
      v_new_score
    )
  );

  perform public.append_audit_log(
    'challenge.progress_updated',
    'challenge_participants',
    v_participant.id,
    'User submitted challenge progress',
    jsonb_build_object('challenge_id', p_challenge_id, 'score_delta', v_point_delta, 'score_total', v_new_score)
  );

  return v_new_score;
end;
$$;

-- === original: 202602190392_krux_beta_part3_s051.sql ===
revoke all on function public.submit_challenge_progress(uuid, numeric, boolean) from public;

-- === original: 202602190393_krux_beta_part3_s052.sql ===
grant execute on function public.submit_challenge_progress(uuid, numeric, boolean) to authenticated;

-- === original: 202602190394_krux_beta_part3_s053.sql ===
drop policy if exists device_connections_select_self on public.device_connections;

-- === original: 202602190395_krux_beta_part3_s054.sql ===
create policy device_connections_select_self_or_gym_staff
on public.device_connections for select to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.gym_memberships gm
    where gm.user_id = device_connections.user_id
      and gm.membership_status in ('trial', 'active')
      and public.is_gym_staff(gm.gym_id, auth.uid())
  )
);

-- === original: 202602190396_krux_beta_part3_s055.sql ===
drop policy if exists device_sync_jobs_select_self on public.device_sync_jobs;

-- === original: 202602190397_krux_beta_part3_s056.sql ===
create policy device_sync_jobs_select_self_or_gym_staff
on public.device_sync_jobs for select to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.gym_memberships gm
    where gm.user_id = device_sync_jobs.user_id
      and gm.membership_status in ('trial', 'active')
      and public.is_gym_staff(gm.gym_id, auth.uid())
  )
);

-- === original: 202602190398_krux_beta_part4_s057.sql ===
alter type public.privacy_request_status add value if not exists 'triaged';
alter type public.privacy_request_status add value if not exists 'in_progress';
alter type public.privacy_request_status add value if not exists 'fulfilled';

alter table public.privacy_requests
  add column if not exists triaged_at timestamptz,
  add column if not exists in_progress_at timestamptz,
  add column if not exists sla_breached_at timestamptz;

create index if not exists idx_privacy_requests_status_due
  on public.privacy_requests(status, due_at);

-- === original: 202602190399_krux_beta_part4_s058.sql ===
create or replace function public.is_privacy_request_open_status(
  _status public.privacy_request_status
)
returns boolean
language sql
immutable
as $$
  select _status in ('submitted', 'triaged', 'in_progress', 'in_review');
$$;

update public.privacy_requests
set status = 'fulfilled'
where status = 'completed';

update public.privacy_requests
set status = 'triaged',
    triaged_at = coalesce(triaged_at, updated_at, submitted_at, now())
where status = 'in_review';

update public.privacy_requests
set resolved_at = coalesce(resolved_at, updated_at, now())
where status in ('fulfilled', 'rejected')
  and resolved_at is null;

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
  v_due_at timestamptz := now() + interval '30 days';
  v_reason text := nullif(btrim(p_reason), '');
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if exists (
    select 1
    from public.privacy_requests pr
    where pr.user_id = auth.uid()
      and pr.request_type = p_request_type
      and public.is_privacy_request_open_status(pr.status)
  ) then
    raise exception 'An open % request already exists', p_request_type;
  end if;

  insert into public.privacy_requests(user_id, request_type, reason, due_at)
  values (auth.uid(), p_request_type, v_reason, v_due_at)
  returning id into v_id;

  insert into public.event_outbox(event_type, aggregate_type, aggregate_id, payload)
  values (
    'privacy.request_submitted',
    'privacy_request',
    v_id,
    jsonb_build_object(
      'request_id', v_id,
      'user_id', auth.uid(),
      'request_type', p_request_type,
      'due_at', v_due_at
    )
  );

  perform public.append_audit_log(
    'privacy.request_submitted',
    'privacy_requests',
    v_id,
    'User submitted privacy request',
    jsonb_build_object(
      'request_type', p_request_type,
      'due_at', v_due_at
    )
  );

  return v_id;
end;
$$;

-- === original: 202602190400_krux_beta_part4_s059.sql ===
create or replace function public.transition_privacy_request_status(
  p_request_id uuid,
  p_next_status public.privacy_request_status,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.privacy_requests%rowtype;
  v_actor uuid := auth.uid();
  v_is_service boolean := public.is_service_role();
  v_actor_is_staff boolean := false;
  v_now timestamptz := now();
  v_note text := nullif(btrim(p_notes), '');
begin
  if v_actor is null and not v_is_service then
    raise exception 'Authentication required';
  end if;

  select *
  into v_request
  from public.privacy_requests pr
  where pr.id = p_request_id
  for update;

  if v_request.id is null then
    raise exception 'Privacy request not found';
  end if;

  if not v_is_service then
    select exists (
      select 1
      from public.gym_memberships gm_actor
      join public.gym_memberships gm_member
        on gm_member.gym_id = gm_actor.gym_id
       and gm_member.user_id = v_request.user_id
       and gm_member.membership_status in ('trial', 'active')
      where gm_actor.user_id = v_actor
        and gm_actor.membership_status in ('trial', 'active')
        and gm_actor.role in ('leader', 'officer', 'coach')
    )
    into v_actor_is_staff;

    if not v_actor_is_staff then
      raise exception 'Gym staff access is required';
    end if;
  end if;

  if v_request.status = p_next_status then
    return v_request.id;
  end if;

  if not (
    (v_request.status = 'submitted' and p_next_status in ('triaged', 'rejected', 'in_review'))
    or (v_request.status = 'triaged' and p_next_status in ('in_progress', 'rejected'))
    or (v_request.status = 'in_progress' and p_next_status in ('fulfilled', 'rejected'))
    or (v_request.status = 'in_review' and p_next_status in ('in_progress', 'fulfilled', 'rejected'))
    or (v_request.status = 'completed' and p_next_status = 'fulfilled')
  ) then
    raise exception 'Invalid status transition: % -> %', v_request.status, p_next_status;
  end if;

  update public.privacy_requests pr
  set
    status = p_next_status,
    triaged_at = case
      when p_next_status in ('triaged', 'in_review') then coalesce(pr.triaged_at, v_now)
      else pr.triaged_at
    end,
    in_progress_at = case
      when p_next_status = 'in_progress' then coalesce(pr.in_progress_at, v_now)
      else pr.in_progress_at
    end,
    resolved_at = case
      when p_next_status in ('fulfilled', 'completed', 'rejected') then coalesce(pr.resolved_at, v_now)
      else pr.resolved_at
    end,
    handled_by = case
      when v_actor is not null then v_actor
      else pr.handled_by
    end,
    notes = case
      when v_note is null then pr.notes
      when pr.notes is null or btrim(pr.notes) = '' then v_note
      else pr.notes || E'\n' || v_note
    end,
    updated_at = v_now
  where pr.id = v_request.id;

  insert into public.event_outbox(event_type, aggregate_type, aggregate_id, payload)
  values (
    'privacy.request_status_changed',
    'privacy_request',
    v_request.id,
    jsonb_build_object(
      'request_id', v_request.id,
      'user_id', v_request.user_id,
      'previous_status', v_request.status,
      'next_status', p_next_status,
      'handled_by', v_actor,
      'at', v_now
    )
  );

  perform public.append_audit_log(
    'privacy.request_status_changed',
    'privacy_requests',
    v_request.id,
    coalesce(v_note, 'Privacy request status transitioned'),
    jsonb_build_object(
      'previous_status', v_request.status,
      'next_status', p_next_status,
      'request_user_id', v_request.user_id,
      'service_transition', v_is_service
    )
  );

  return v_request.id;
end;
$$;

create or replace function public.process_privacy_request_queue(
  p_triage_limit integer default 25,
  p_overdue_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_triage_limit integer := greatest(1, least(coalesce(p_triage_limit, 25), 200));
  v_overdue_limit integer := greatest(1, least(coalesce(p_overdue_limit, 100), 500));
  v_triaged_ids uuid[] := '{}'::uuid[];
  v_overdue_ids uuid[] := '{}'::uuid[];
  v_item record;
  v_now timestamptz := now();
begin
  if not public.is_service_role() then
    raise exception 'Service role required';
  end if;

  for v_item in
    select pr.id
    from public.privacy_requests pr
    where pr.status = 'submitted'
    order by pr.submitted_at asc
    limit v_triage_limit
    for update skip locked
  loop
    perform public.transition_privacy_request_status(
      v_item.id,
      'triaged',
      'Queued by privacy_request_processor'
    );

    v_triaged_ids := array_append(v_triaged_ids, v_item.id);
  end loop;

  for v_item in
    select pr.id, pr.user_id, pr.due_at
    from public.privacy_requests pr
    where public.is_privacy_request_open_status(pr.status)
      and pr.due_at < v_now
      and pr.sla_breached_at is null
    order by pr.due_at asc, pr.submitted_at asc
    limit v_overdue_limit
    for update skip locked
  loop
    update public.privacy_requests pr
    set
      sla_breached_at = v_now,
      updated_at = v_now
    where pr.id = v_item.id
      and pr.sla_breached_at is null;

    if found then
      v_overdue_ids := array_append(v_overdue_ids, v_item.id);

      insert into public.event_outbox(event_type, aggregate_type, aggregate_id, payload)
      values (
        'privacy.request_overdue',
        'privacy_request',
        v_item.id,
        jsonb_build_object(
          'request_id', v_item.id,
          'user_id', v_item.user_id,
          'due_at', v_item.due_at,
          'breached_at', v_now
        )
      );

      perform public.append_audit_log(
        'privacy.request_overdue',
        'privacy_requests',
        v_item.id,
        'Privacy request SLA breached',
        jsonb_build_object(
          'request_user_id', v_item.user_id,
          'due_at', v_item.due_at,
          'breached_at', v_now
        )
      );
    end if;
  end loop;

  return jsonb_build_object(
    'triagedCount', coalesce(cardinality(v_triaged_ids), 0),
    'overdueMarkedCount', coalesce(cardinality(v_overdue_ids), 0),
    'triagedRequestIds', v_triaged_ids,
    'overdueRequestIds', v_overdue_ids
  );
end;
$$;

-- === original: 202602190401_krux_beta_part4_s060.sql ===
revoke all on function public.submit_privacy_request(public.privacy_request_type, text) from public;
grant execute on function public.submit_privacy_request(public.privacy_request_type, text) to authenticated;
grant execute on function public.submit_privacy_request(public.privacy_request_type, text) to service_role;

revoke all on function public.transition_privacy_request_status(uuid, public.privacy_request_status, text) from public;
grant execute on function public.transition_privacy_request_status(uuid, public.privacy_request_status, text) to authenticated;
grant execute on function public.transition_privacy_request_status(uuid, public.privacy_request_status, text) to service_role;

revoke all on function public.process_privacy_request_queue(integer, integer) from public;
grant execute on function public.process_privacy_request_queue(integer, integer) to service_role;

drop function if exists public.admin_list_open_privacy_requests(uuid);

create or replace function public.admin_list_open_privacy_requests(
  p_gym_id uuid
)
returns table (
  id uuid,
  user_id uuid,
  request_type public.privacy_request_type,
  status public.privacy_request_status,
  submitted_at timestamptz,
  due_at timestamptz,
  sla_breached_at timestamptz,
  is_overdue boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_gym_staff(p_gym_id, auth.uid()) then
    raise exception 'Gym staff access is required';
  end if;

  return query
  select
    pr.id,
    pr.user_id,
    pr.request_type,
    pr.status,
    pr.submitted_at,
    pr.due_at,
    pr.sla_breached_at,
    (pr.due_at < now()) as is_overdue
  from public.privacy_requests pr
  where public.is_privacy_request_open_status(pr.status)
    and exists (
      select 1
      from public.gym_memberships gm
      where gm.gym_id = p_gym_id
        and gm.user_id = pr.user_id
    )
  order by
    (pr.sla_breached_at is not null) desc,
    pr.due_at asc nulls last,
    pr.submitted_at asc;
end;
$$;

create or replace function public.admin_get_gym_ops_summary(
  p_gym_id uuid
)
returns table (
  gym_id uuid,
  pending_memberships integer,
  active_or_trial_members integer,
  upcoming_classes integer,
  pending_waitlist_entries integer,
  open_privacy_requests integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_gym_staff(p_gym_id, auth.uid()) then
    raise exception 'Gym staff access is required';
  end if;

  return query
  select
    p_gym_id as gym_id,
    coalesce((
      select count(*)::integer
      from public.gym_memberships gm
      where gm.gym_id = p_gym_id
        and gm.membership_status = 'pending'
    ), 0) as pending_memberships,
    coalesce((
      select count(*)::integer
      from public.gym_memberships gm
      where gm.gym_id = p_gym_id
        and gm.membership_status in ('trial', 'active')
    ), 0) as active_or_trial_members,
    coalesce((
      select count(*)::integer
      from public.gym_classes gc
      where gc.gym_id = p_gym_id
        and gc.status = 'scheduled'
        and gc.starts_at >= now()
    ), 0) as upcoming_classes,
    coalesce((
      select count(*)::integer
      from public.class_waitlist cw
      join public.gym_classes gc on gc.id = cw.class_id
      where gc.gym_id = p_gym_id
        and gc.status = 'scheduled'
        and gc.starts_at >= now()
        and cw.status = 'pending'
    ), 0) as pending_waitlist_entries,
    coalesce((
      select count(*)::integer
      from public.privacy_requests pr
      where public.is_privacy_request_open_status(pr.status)
        and exists (
          select 1
          from public.gym_memberships gm
          where gm.gym_id = p_gym_id
            and gm.user_id = pr.user_id
        )
    ), 0) as open_privacy_requests;
end;
$$;

revoke all on function public.admin_list_open_privacy_requests(uuid) from public;
grant execute on function public.admin_list_open_privacy_requests(uuid) to authenticated;
grant execute on function public.admin_list_open_privacy_requests(uuid) to service_role;

revoke all on function public.admin_get_gym_ops_summary(uuid) from public;
grant execute on function public.admin_get_gym_ops_summary(uuid) to authenticated;
grant execute on function public.admin_get_gym_ops_summary(uuid) to service_role;

-- === original: 202602190402_krux_beta_part4_s061.sql ===
alter table public.policy_version_tracking
  add column if not exists published_at timestamptz not null default now(),
  add column if not exists change_summary text,
  add column if not exists requires_reconsent boolean not null default true,
  add column if not exists supersedes_policy_version_id uuid references public.policy_version_tracking(id) on delete set null;

update public.policy_version_tracking
set published_at = coalesce(published_at, created_at)
where published_at is null;

create index if not exists idx_policy_version_type_effective
  on public.policy_version_tracking(policy_type, effective_at desc, created_at desc);

-- === original: 202602190403_krux_beta_part4_s062.sql ===
create or replace function public.consent_policy_type_from_consent_type(
  p_consent_type public.consent_type
)
returns public.policy_type
language plpgsql
immutable
as $$
begin
  case p_consent_type
    when 'terms' then
      return 'terms'::public.policy_type;
    when 'privacy', 'marketing_email', 'push_notifications' then
      return 'privacy'::public.policy_type;
    when 'health_data_processing' then
      return 'health_data'::public.policy_type;
    else
      raise exception 'Unsupported consent type: %', p_consent_type;
  end case;
end;
$$;

create or replace function public.current_policy_version_id(
  p_policy_type public.policy_type,
  p_as_of timestamptz default now()
)
returns uuid
language sql
stable
as $$
  select p.id
  from public.policy_version_tracking p
  where p.policy_type = p_policy_type
    and p.is_active = true
    and p.effective_at <= p_as_of
  order by p.effective_at desc, p.created_at desc
  limit 1;
$$;

create or replace function public.publish_policy_version(
  p_policy_type public.policy_type,
  p_version text,
  p_document_url text,
  p_effective_at timestamptz default now(),
  p_label text default null,
  p_requires_reconsent boolean default true,
  p_change_summary text default null,
  p_is_active boolean default true,
  p_supersedes_policy_version_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_version text := nullif(btrim(p_version), '');
  v_document_url text := nullif(btrim(p_document_url), '');
  v_supersedes_id uuid := p_supersedes_policy_version_id;
  v_effective_at timestamptz := coalesce(p_effective_at, now());
begin
  if not public.is_service_role() then
    raise exception 'Service role required';
  end if;

  if v_version is null then
    raise exception 'Policy version is required';
  end if;

  if v_document_url is null then
    raise exception 'Policy document URL is required';
  end if;

  if exists (
    select 1
    from public.policy_version_tracking p
    where p.policy_type = p_policy_type
      and p.version = v_version
  ) then
    raise exception 'Policy version already exists for policy type %: %', p_policy_type, v_version;
  end if;

  if v_supersedes_id is null then
    select public.current_policy_version_id(p_policy_type, v_effective_at)
    into v_supersedes_id;
  end if;

  insert into public.policy_version_tracking(
    policy_type,
    version,
    label,
    document_url,
    checksum,
    effective_at,
    is_active,
    created_by,
    published_at,
    change_summary,
    requires_reconsent,
    supersedes_policy_version_id
  )
  values (
    p_policy_type,
    v_version,
    nullif(btrim(p_label), ''),
    v_document_url,
    null,
    v_effective_at,
    coalesce(p_is_active, true),
    auth.uid(),
    now(),
    nullif(btrim(p_change_summary), ''),
    coalesce(p_requires_reconsent, true),
    v_supersedes_id
  )
  returning id into v_id;

  insert into public.event_outbox(event_type, aggregate_type, aggregate_id, payload)
  values (
    'policy.version_published',
    'policy_version',
    v_id,
    jsonb_build_object(
      'policy_version_id', v_id,
      'policy_type', p_policy_type,
      'version', v_version,
      'effective_at', v_effective_at,
      'requires_reconsent', coalesce(p_requires_reconsent, true),
      'supersedes_policy_version_id', v_supersedes_id
    )
  );

  perform public.append_audit_log(
    'policy.version_published',
    'policy_version_tracking',
    v_id,
    'Published policy version',
    jsonb_build_object(
      'policy_type', p_policy_type,
      'version', v_version,
      'effective_at', v_effective_at,
      'requires_reconsent', coalesce(p_requires_reconsent, true),
      'supersedes_policy_version_id', v_supersedes_id
    )
  );

  return v_id;
end;
$$;

-- === original: 202602190404_krux_beta_part4_s063.sql ===
create or replace function public.reject_mutation_immutable_table()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Table % is immutable; append-only writes only', tg_table_name;
end;
$$;

drop trigger if exists trg_policy_version_tracking_immutable on public.policy_version_tracking;
create trigger trg_policy_version_tracking_immutable
before update or delete on public.policy_version_tracking
for each row execute function public.reject_mutation_immutable_table();

drop trigger if exists trg_consents_set_updated_at on public.consents;

drop trigger if exists trg_consents_immutable on public.consents;
create trigger trg_consents_immutable
before update or delete on public.consents
for each row execute function public.reject_mutation_immutable_table();

drop policy if exists policy_versions_manage_service on public.policy_version_tracking;
drop policy if exists policy_versions_insert_service on public.policy_version_tracking;

create policy policy_versions_insert_service
on public.policy_version_tracking for insert to authenticated
with check (public.is_service_role());

drop policy if exists consents_insert_self on public.consents;
drop policy if exists consents_update_self_or_service on public.consents;
drop policy if exists consents_insert_service_only on public.consents;

create policy consents_insert_self_or_service
on public.consents for insert to authenticated
with check (user_id = auth.uid() or public.is_service_role());

-- === original: 202602190405_krux_beta_part4_s064.sql ===
create or replace function public.record_user_consent(
  p_consent_type public.consent_type,
  p_granted boolean,
  p_policy_version_id uuid default null,
  p_source text default 'mobile',
  p_locale text default null,
  p_user_id uuid default null,
  p_ip_address text default null,
  p_user_agent text default null,
  p_evidence jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_is_service boolean := public.is_service_role();
  v_target_user uuid := coalesce(p_user_id, v_actor);
  v_policy_type public.policy_type;
  v_policy public.policy_version_tracking%rowtype;
  v_now timestamptz := now();
  v_id uuid;
begin
  if p_granted is null then
    raise exception 'Consent grant flag is required';
  end if;

  if v_target_user is null then
    raise exception 'Authentication required';
  end if;

  if not v_is_service and v_actor is distinct from v_target_user then
    raise exception 'Cannot record consent for another user';
  end if;

  v_policy_type := public.consent_policy_type_from_consent_type(p_consent_type);

  if p_policy_version_id is null then
    select p.*
    into v_policy
    from public.policy_version_tracking p
    where p.id = public.current_policy_version_id(v_policy_type, v_now);
  else
    select p.*
    into v_policy
    from public.policy_version_tracking p
    where p.id = p_policy_version_id;
  end if;

  if v_policy.id is null then
    raise exception 'No active policy version found for consent type %', p_consent_type;
  end if;

  if v_policy.policy_type <> v_policy_type then
    raise exception 'Policy type mismatch for consent type %', p_consent_type;
  end if;

  if v_policy.effective_at > v_now then
    raise exception 'Cannot accept a policy version before its effective date';
  end if;

  if not v_policy.is_active then
    raise exception 'Policy version is not active';
  end if;

  insert into public.consents(
    user_id,
    consent_type,
    policy_version_id,
    granted,
    granted_at,
    revoked_at,
    source,
    locale,
    ip_address,
    user_agent,
    evidence
  )
  values (
    v_target_user,
    p_consent_type,
    v_policy.id,
    p_granted,
    v_now,
    case when p_granted then null else v_now end,
    coalesce(nullif(btrim(p_source), ''), 'mobile'),
    nullif(btrim(p_locale), ''),
    nullif(btrim(p_ip_address), ''),
    nullif(btrim(p_user_agent), ''),
    coalesce(p_evidence, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.validate_consent_insert()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_policy public.policy_version_tracking%rowtype;
  v_policy_type public.policy_type;
begin
  if new.user_id is null then
    raise exception 'Consent user id is required';
  end if;

  if new.consent_type is null then
    raise exception 'Consent type is required';
  end if;

  if new.granted is null then
    raise exception 'Consent grant flag is required';
  end if;

  new.granted_at := coalesce(new.granted_at, now());
  new.source := coalesce(nullif(btrim(new.source), ''), 'mobile');
  new.locale := nullif(btrim(new.locale), '');

  if new.policy_version_id is null then
    new.policy_version_id := public.current_policy_version_id(
      public.consent_policy_type_from_consent_type(new.consent_type),
      new.granted_at
    );
  end if;

  if new.policy_version_id is null then
    raise exception 'A valid policy version is required for consent type %', new.consent_type;
  end if;

  select p.*
  into v_policy
  from public.policy_version_tracking p
  where p.id = new.policy_version_id;

  if v_policy.id is null then
    raise exception 'Policy version not found';
  end if;

  v_policy_type := public.consent_policy_type_from_consent_type(new.consent_type);
  if v_policy.policy_type <> v_policy_type then
    raise exception 'Policy version type mismatch for consent type %', new.consent_type;
  end if;

  if not v_policy.is_active then
    raise exception 'Policy version is not active';
  end if;

  if v_policy.effective_at > new.granted_at then
    raise exception 'Policy version cannot be accepted before effective date';
  end if;

  if new.granted then
    new.revoked_at := null;
  else
    new.revoked_at := coalesce(new.revoked_at, new.granted_at);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_consents_validate_insert on public.consents;
create trigger trg_consents_validate_insert
before insert on public.consents
for each row execute function public.validate_consent_insert();

create or replace function public.emit_consent_recorded_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.event_outbox(event_type, aggregate_type, aggregate_id, payload)
  values (
    'consent.recorded',
    'consent',
    new.id,
    jsonb_build_object(
      'consent_id', new.id,
      'user_id', new.user_id,
      'consent_type', new.consent_type,
      'policy_version_id', new.policy_version_id,
      'granted', new.granted,
      'source', new.source,
      'at', new.granted_at
    )
  );

  perform public.append_audit_log(
    'consent.recorded',
    'consents',
    new.id,
    'Recorded consent decision',
    jsonb_build_object(
      'user_id', new.user_id,
      'consent_type', new.consent_type,
      'policy_version_id', new.policy_version_id,
      'granted', new.granted,
      'source', new.source
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_consents_emit_recorded_event on public.consents;
create trigger trg_consents_emit_recorded_event
after insert on public.consents
for each row execute function public.emit_consent_recorded_event();

create or replace function public.list_missing_required_consents(
  p_user_id uuid default auth.uid()
)
returns table (
  consent_type public.consent_type,
  required_policy_version_id uuid,
  required_policy_version text,
  reason text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_is_service boolean := public.is_service_role();
  v_target_user uuid := coalesce(p_user_id, v_actor);
  v_consent_type public.consent_type;
  v_policy_id uuid;
  v_policy_version text;
  v_requires_reconsent boolean;
  v_latest record;
begin
  if v_target_user is null then
    raise exception 'Authentication required';
  end if;

  if not v_is_service and v_actor is distinct from v_target_user then
    raise exception 'Cannot inspect consent gaps for another user';
  end if;

  foreach v_consent_type in array array[
    'terms'::public.consent_type,
    'privacy'::public.consent_type,
    'health_data_processing'::public.consent_type
  ]
  loop
    select
      p.id,
      p.version,
      p.requires_reconsent
    into
      v_policy_id,
      v_policy_version,
      v_requires_reconsent
    from public.policy_version_tracking p
    where p.policy_type = public.consent_policy_type_from_consent_type(v_consent_type)
      and p.is_active = true
      and p.effective_at <= now()
    order by p.effective_at desc, p.created_at desc
    limit 1;

    if v_policy_id is null then
      consent_type := v_consent_type;
      required_policy_version_id := null;
      required_policy_version := null;
      reason := 'missing_active_policy';
      return next;
      continue;
    end if;

    select
      c.id,
      c.granted,
      c.policy_version_id
    into v_latest
    from public.consents c
    where c.user_id = v_target_user
      and c.consent_type = v_consent_type
    order by c.granted_at desc, c.created_at desc
    limit 1;

    if v_latest.id is null then
      consent_type := v_consent_type;
      required_policy_version_id := v_policy_id;
      required_policy_version := v_policy_version;
      reason := 'missing_consent_record';
      return next;
      continue;
    end if;

    if not coalesce(v_latest.granted, false) then
      consent_type := v_consent_type;
      required_policy_version_id := v_policy_id;
      required_policy_version := v_policy_version;
      reason := 'latest_record_revoked';
      return next;
      continue;
    end if;

    if v_latest.policy_version_id is null then
      consent_type := v_consent_type;
      required_policy_version_id := v_policy_id;
      required_policy_version := v_policy_version;
      reason := 'missing_policy_binding';
      return next;
      continue;
    end if;

    if coalesce(v_requires_reconsent, true) and v_latest.policy_version_id <> v_policy_id then
      consent_type := v_consent_type;
      required_policy_version_id := v_policy_id;
      required_policy_version := v_policy_version;
      reason := 'reconsent_required';
      return next;
    end if;
  end loop;
end;
$$;

create or replace function public.user_has_required_consents(
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from public.list_missing_required_consents(p_user_id)
  );
$$;

-- === original: 202602190406_krux_beta_part4_s065.sql ===
revoke all on function public.publish_policy_version(
  public.policy_type,
  text,
  text,
  timestamptz,
  text,
  boolean,
  text,
  boolean,
  uuid
) from public;
grant execute on function public.publish_policy_version(
  public.policy_type,
  text,
  text,
  timestamptz,
  text,
  boolean,
  text,
  boolean,
  uuid
) to service_role;

revoke all on function public.current_policy_version_id(public.policy_type, timestamptz) from public;
grant execute on function public.current_policy_version_id(public.policy_type, timestamptz) to authenticated;
grant execute on function public.current_policy_version_id(public.policy_type, timestamptz) to service_role;

revoke all on function public.record_user_consent(
  public.consent_type,
  boolean,
  uuid,
  text,
  text,
  uuid,
  text,
  text,
  jsonb
) from public;
grant execute on function public.record_user_consent(
  public.consent_type,
  boolean,
  uuid,
  text,
  text,
  uuid,
  text,
  text,
  jsonb
) to authenticated;
grant execute on function public.record_user_consent(
  public.consent_type,
  boolean,
  uuid,
  text,
  text,
  uuid,
  text,
  text,
  jsonb
) to service_role;

revoke all on function public.list_missing_required_consents(uuid) from public;
grant execute on function public.list_missing_required_consents(uuid) to authenticated;
grant execute on function public.list_missing_required_consents(uuid) to service_role;

revoke all on function public.user_has_required_consents(uuid) from public;
grant execute on function public.user_has_required_consents(uuid) to authenticated;
grant execute on function public.user_has_required_consents(uuid) to service_role;

-- === original: 202602190407_krux_beta_part4_s066.sql ===
alter table public.privacy_requests
  add column if not exists response_expires_at timestamptz,
  add column if not exists response_content_type text,
  add column if not exists response_bytes bigint;

create table if not exists public.privacy_export_jobs (
  id uuid primary key default gen_random_uuid(),
  privacy_request_id uuid not null references public.privacy_requests(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status public.sync_job_status not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed', 'retry_scheduled')),
  storage_bucket text,
  storage_path text,
  signed_url text,
  signed_url_expires_at timestamptz,
  file_bytes bigint,
  record_count integer,
  retry_count integer not null default 0,
  next_retry_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (privacy_request_id)
);

create index if not exists idx_privacy_export_jobs_status_retry
  on public.privacy_export_jobs(status, next_retry_at, created_at);

create index if not exists idx_privacy_export_jobs_user_created
  on public.privacy_export_jobs(user_id, created_at desc);

drop trigger if exists trg_privacy_export_jobs_set_updated_at on public.privacy_export_jobs;
create trigger trg_privacy_export_jobs_set_updated_at
before update on public.privacy_export_jobs
for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('privacy-exports', 'privacy-exports', false, 104857600, array['application/json'])
on conflict (id)
do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- === original: 202602190408_krux_beta_part4_s067.sql ===
create or replace function public.build_privacy_export_payload(
  p_user_id uuid default auth.uid()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_is_service boolean := public.is_service_role();
  v_target_user uuid := coalesce(p_user_id, v_actor);
begin
  if v_target_user is null then
    raise exception 'Authentication required';
  end if;

  if not v_is_service and v_actor is distinct from v_target_user then
    raise exception 'Cannot export data for another user';
  end if;

  return jsonb_build_object(
    'schema_version', '2026-02',
    'generated_at', now(),
    'user_id', v_target_user,
    'profile', coalesce((
      select to_jsonb(p)
      from (
        select
          pr.id,
          pr.username,
          pr.display_name,
          pr.avatar_url,
          pr.bio,
          pr.home_gym_id,
          pr.is_public,
          pr.xp_total,
          pr.level,
          pr.rank_tier,
          pr.chain_days,
          pr.last_workout_at,
          pr.locale,
          pr.preferred_units,
          pr.created_at,
          pr.updated_at
        from public.profiles pr
        where pr.id = v_target_user
      ) p
    ), '{}'::jsonb),
    'gym_memberships', coalesce((
      select jsonb_agg(to_jsonb(gm) order by gm.created_at asc)
      from (
        select
          m.id,
          m.gym_id,
          m.role,
          m.membership_status,
          m.membership_plan_id,
          m.started_at,
          m.ends_at,
          m.created_at,
          m.updated_at
        from public.gym_memberships m
        where m.user_id = v_target_user
      ) gm
    ), '[]'::jsonb),
    'workouts', coalesce((
      select jsonb_agg(to_jsonb(w) order by w.started_at desc, w.created_at desc)
      from (
        select
          w.id,
          w.gym_id,
          w.title,
          w.workout_type,
          w.notes,
          w.started_at,
          w.ended_at,
          w.rpe,
          w.visibility,
          w.total_sets,
          w.total_volume_kg,
          w.is_pr,
          w.source,
          w.external_activity_id,
          w.created_at,
          w.updated_at
        from public.workouts w
        where w.user_id = v_target_user
      ) w
    ), '[]'::jsonb),
    'workout_exercises', coalesce((
      select jsonb_agg(to_jsonb(we) order by we.created_at asc)
      from (
        select
          e.id,
          e.workout_id,
          e.exercise_id,
          e.order_index,
          e.block_id,
          e.block_type,
          e.target_reps,
          e.target_weight_kg,
          e.notes,
          e.created_at,
          e.updated_at
        from public.workout_exercises e
        where exists (
          select 1
          from public.workouts w
          where w.id = e.workout_id
            and w.user_id = v_target_user
        )
      ) we
    ), '[]'::jsonb),
    'workout_sets', coalesce((
      select jsonb_agg(to_jsonb(ws) order by ws.created_at asc)
      from (
        select
          s.id,
          s.workout_exercise_id,
          s.set_index,
          s.reps,
          s.weight_kg,
          s.duration_seconds,
          s.distance_m,
          s.rpe,
          s.is_pr,
          s.created_at,
          s.updated_at
        from public.workout_sets s
        where exists (
          select 1
          from public.workout_exercises e
          join public.workouts w on w.id = e.workout_id
          where e.id = s.workout_exercise_id
            and w.user_id = v_target_user
        )
      ) ws
    ), '[]'::jsonb),
    'social_connections', coalesce((
      select jsonb_agg(to_jsonb(sc) order by sc.created_at asc)
      from (
        select
          c.id,
          c.follower_user_id,
          c.followed_user_id,
          c.status,
          c.created_at,
          c.updated_at
        from public.social_connections c
        where c.follower_user_id = v_target_user
           or c.followed_user_id = v_target_user
      ) sc
    ), '[]'::jsonb),
    'social_interactions', coalesce((
      select jsonb_agg(to_jsonb(si) order by si.created_at asc)
      from (
        select
          i.id,
          i.workout_id,
          i.actor_user_id,
          i.interaction_type,
          i.reaction_type,
          i.comment_text,
          i.parent_interaction_id,
          i.created_at,
          i.updated_at
        from public.social_interactions i
        where i.actor_user_id = v_target_user
      ) si
    ), '[]'::jsonb),
    'class_bookings', coalesce((
      select jsonb_agg(to_jsonb(cb) order by cb.booked_at desc)
      from (
        select
          b.id,
          b.class_id,
          b.status,
          b.booked_at,
          b.checked_in_at,
          b.source_channel,
          b.updated_at
        from public.class_bookings b
        where b.user_id = v_target_user
      ) cb
    ), '[]'::jsonb),
    'class_waitlist', coalesce((
      select jsonb_agg(to_jsonb(cw) order by cw.created_at desc)
      from (
        select
          w.id,
          w.class_id,
          w.position,
          w.status,
          w.notified_at,
          w.expires_at,
          w.promoted_at,
          w.created_at,
          w.updated_at
        from public.class_waitlist w
        where w.user_id = v_target_user
      ) cw
    ), '[]'::jsonb),
    'gym_checkins', coalesce((
      select jsonb_agg(to_jsonb(gc) order by gc.checked_in_at desc)
      from (
        select
          c.id,
          c.gym_id,
          c.class_id,
          c.checked_in_at,
          c.source_channel,
          c.metadata,
          c.created_at
        from public.gym_checkins c
        where c.user_id = v_target_user
      ) gc
    ), '[]'::jsonb),
    'access_logs', coalesce((
      select jsonb_agg(to_jsonb(al) order by al.created_at desc)
      from (
        select
          l.id,
          l.gym_id,
          l.event_type,
          l.result,
          l.reason,
          l.metadata,
          l.created_at
        from public.access_logs l
        where l.user_id = v_target_user
      ) al
    ), '[]'::jsonb),
    'notification_preferences', coalesce((
      select to_jsonb(np)
      from (
        select
          n.id,
          n.push_enabled,
          n.email_enabled,
          n.in_app_enabled,
          n.marketing_enabled,
          n.workout_reactions_enabled,
          n.comments_enabled,
          n.challenge_updates_enabled,
          n.class_reminders_enabled,
          n.quiet_hours_start,
          n.quiet_hours_end,
          n.timezone,
          n.created_at,
          n.updated_at
        from public.notification_preferences n
        where n.user_id = v_target_user
      ) np
    ), '{}'::jsonb),
    'push_notification_tokens', coalesce((
      select jsonb_agg(to_jsonb(pt) order by pt.created_at asc)
      from (
        select
          t.id,
          t.device_id,
          t.platform,
          t.is_active,
          t.last_seen_at,
          t.created_at,
          t.updated_at
        from public.push_notification_tokens t
        where t.user_id = v_target_user
      ) pt
    ), '[]'::jsonb),
    'device_connections', coalesce((
      select jsonb_agg(to_jsonb(dc) order by dc.created_at asc)
      from (
        select
          c.id,
          c.provider,
          c.status,
          c.provider_user_id,
          c.scopes,
          c.token_expires_at,
          c.last_synced_at,
          c.last_error,
          c.metadata,
          c.created_at,
          c.updated_at
        from public.device_connections c
        where c.user_id = v_target_user
      ) dc
    ), '[]'::jsonb),
    'external_activity_imports', coalesce((
      select jsonb_agg(to_jsonb(ea) order by ea.imported_at desc)
      from (
        select
          e.id,
          e.connection_id,
          e.provider,
          e.external_activity_id,
          e.activity_type,
          e.started_at,
          e.ended_at,
          e.duration_seconds,
          e.distance_m,
          e.calories,
          e.average_hr,
          e.max_hr,
          e.raw_data,
          e.mapped_workout_id,
          e.imported_at,
          e.created_at
        from public.external_activity_imports e
        where e.user_id = v_target_user
      ) ea
    ), '[]'::jsonb),
    'consents', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.granted_at desc, c.created_at desc)
      from (
        select
          c.id,
          c.consent_type,
          c.policy_version_id,
          c.granted,
          c.granted_at,
          c.revoked_at,
          c.source,
          c.locale,
          c.evidence,
          c.created_at
        from public.consents c
        where c.user_id = v_target_user
      ) c
    ), '[]'::jsonb),
    'privacy_requests', coalesce((
      select jsonb_agg(to_jsonb(pr) order by pr.submitted_at desc)
      from (
        select
          r.id,
          r.request_type,
          r.status,
          r.reason,
          r.submitted_at,
          r.due_at,
          r.triaged_at,
          r.in_progress_at,
          r.resolved_at,
          r.response_location,
          r.response_expires_at,
          r.response_content_type,
          r.response_bytes,
          r.sla_breached_at,
          r.notes,
          r.created_at,
          r.updated_at
        from public.privacy_requests r
        where r.user_id = v_target_user
      ) pr
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.queue_privacy_export_jobs(
  p_limit integer default 25
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 25), 200));
  v_count integer := 0;
begin
  if not public.is_service_role() then
    raise exception 'Service role required';
  end if;

  with candidates as (
    select
      pr.id as privacy_request_id,
      pr.user_id
    from public.privacy_requests pr
    where pr.request_type in ('access', 'export')
      and pr.status in ('submitted', 'triaged', 'in_progress', 'in_review')
      and pr.resolved_at is null
      and not exists (
        select 1
        from public.privacy_export_jobs j
        where j.privacy_request_id = pr.id
          and j.status in ('queued', 'running', 'retry_scheduled', 'succeeded')
      )
    order by pr.submitted_at asc
    limit v_limit
  )
  insert into public.privacy_export_jobs(
    privacy_request_id,
    user_id,
    status,
    next_retry_at
  )
  select
    c.privacy_request_id,
    c.user_id,
    'queued'::public.sync_job_status,
    now()
  from candidates c
  on conflict (privacy_request_id)
  do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.claim_privacy_export_jobs(
  p_limit integer default 5
)
returns setof public.privacy_export_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 5), 50));
begin
  if not public.is_service_role() then
    raise exception 'Service role required';
  end if;

  return query
  with candidates as (
    select j.id
    from public.privacy_export_jobs j
    join public.privacy_requests pr
      on pr.id = j.privacy_request_id
    where j.status in ('queued', 'retry_scheduled')
      and coalesce(j.next_retry_at, j.created_at) <= now()
      and pr.request_type in ('access', 'export')
      and public.is_privacy_request_open_status(pr.status)
    order by coalesce(j.next_retry_at, j.created_at) asc
    limit v_limit
    for update of j skip locked
  ),
  updated as (
    update public.privacy_export_jobs j
    set
      status = 'running',
      started_at = now(),
      finished_at = null,
      error_message = null,
      updated_at = now()
    from candidates c
    where j.id = c.id
    returning j.*
  )
  select *
  from updated;
end;
$$;

create or replace function public.complete_privacy_export_job(
  p_job_id uuid,
  p_storage_bucket text,
  p_storage_path text,
  p_signed_url text,
  p_signed_url_expires_at timestamptz,
  p_file_bytes bigint default null,
  p_record_count integer default null,
  p_content_type text default 'application/json'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.privacy_export_jobs%rowtype;
  v_request public.privacy_requests%rowtype;
  v_bucket text := nullif(btrim(p_storage_bucket), '');
  v_path text := nullif(btrim(p_storage_path), '');
  v_signed_url text := nullif(btrim(p_signed_url), '');
  v_content_type text := coalesce(nullif(btrim(p_content_type), ''), 'application/json');
begin
  if not public.is_service_role() then
    raise exception 'Service role required';
  end if;

  select *
  into v_job
  from public.privacy_export_jobs j
  where j.id = p_job_id
  for update;

  if v_job.id is null then
    raise exception 'Privacy export job not found';
  end if;

  if v_job.status <> 'running' then
    raise exception 'Privacy export job must be running before completion';
  end if;

  if v_bucket is null or v_path is null or v_signed_url is null then
    raise exception 'Storage bucket, path, and signed URL are required';
  end if;

  select *
  into v_request
  from public.privacy_requests pr
  where pr.id = v_job.privacy_request_id
  for update;

  if v_request.id is null then
    raise exception 'Privacy request not found for export job';
  end if;

  if v_request.status = 'submitted' then
    perform public.transition_privacy_request_status(
      v_request.id,
      'triaged',
      'Export queue promoted request'
    );
    v_request.status := 'triaged';
  end if;

  if v_request.status = 'triaged' then
    perform public.transition_privacy_request_status(
      v_request.id,
      'in_progress',
      'Export generation started'
    );
    v_request.status := 'in_progress';
  end if;

  if v_request.status in ('in_progress', 'in_review') then
    perform public.transition_privacy_request_status(
      v_request.id,
      'fulfilled',
      'Export package generated'
    );
  elsif v_request.status = 'rejected' then
    raise exception 'Cannot complete export for rejected privacy request';
  end if;

  update public.privacy_export_jobs j
  set
    status = 'succeeded',
    storage_bucket = v_bucket,
    storage_path = v_path,
    signed_url = v_signed_url,
    signed_url_expires_at = p_signed_url_expires_at,
    file_bytes = p_file_bytes,
    record_count = p_record_count,
    finished_at = now(),
    next_retry_at = null,
    error_message = null,
    updated_at = now()
  where j.id = v_job.id;

  update public.privacy_requests pr
  set
    response_location = v_signed_url,
    response_expires_at = p_signed_url_expires_at,
    response_content_type = v_content_type,
    response_bytes = p_file_bytes,
    updated_at = now()
  where pr.id = v_request.id;

  insert into public.event_outbox(event_type, aggregate_type, aggregate_id, payload)
  values (
    'privacy.export_ready',
    'privacy_request',
    v_request.id,
    jsonb_build_object(
      'request_id', v_request.id,
      'job_id', v_job.id,
      'user_id', v_job.user_id,
      'bucket', v_bucket,
      'path', v_path,
      'signed_url_expires_at', p_signed_url_expires_at,
      'file_bytes', p_file_bytes,
      'record_count', p_record_count
    )
  );

  perform public.append_audit_log(
    'privacy.export_ready',
    'privacy_export_jobs',
    v_job.id,
    'Privacy export package generated',
    jsonb_build_object(
      'request_id', v_request.id,
      'user_id', v_job.user_id,
      'bucket', v_bucket,
      'path', v_path,
      'signed_url_expires_at', p_signed_url_expires_at,
      'file_bytes', p_file_bytes,
      'record_count', p_record_count
    )
  );

  return v_request.id;
end;
$$;

create or replace function public.fail_privacy_export_job(
  p_job_id uuid,
  p_error text,
  p_retry_delay_seconds integer default 900,
  p_max_retries integer default 5
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.privacy_export_jobs%rowtype;
  v_request public.privacy_requests%rowtype;
  v_error text := coalesce(nullif(btrim(p_error), ''), 'Unknown export processing error');
  v_retry_delay integer := greatest(60, least(coalesce(p_retry_delay_seconds, 900), 86400));
  v_max_retries integer := greatest(1, least(coalesce(p_max_retries, 5), 20));
  v_retry_count integer;
  v_next_retry_at timestamptz;
  v_final_failure boolean := false;
begin
  if not public.is_service_role() then
    raise exception 'Service role required';
  end if;

  select *
  into v_job
  from public.privacy_export_jobs j
  where j.id = p_job_id
  for update;

  if v_job.id is null then
    raise exception 'Privacy export job not found';
  end if;

  v_retry_count := coalesce(v_job.retry_count, 0) + 1;
  v_final_failure := v_retry_count >= v_max_retries;

  if v_final_failure then
    update public.privacy_export_jobs j
    set
      status = 'failed',
      retry_count = v_retry_count,
      error_message = v_error,
      next_retry_at = null,
      finished_at = now(),
      updated_at = now()
    where j.id = v_job.id;

    select *
    into v_request
    from public.privacy_requests pr
    where pr.id = v_job.privacy_request_id
    for update;

    if v_request.id is not null and public.is_privacy_request_open_status(v_request.status) then
      if v_request.status = 'submitted' then
        perform public.transition_privacy_request_status(
          v_request.id,
          'triaged',
          'Export queue promoted request'
        );
        v_request.status := 'triaged';
      end if;

      if v_request.status = 'triaged' then
        perform public.transition_privacy_request_status(
          v_request.id,
          'in_progress',
          'Export generation started'
        );
        v_request.status := 'in_progress';
      end if;

      if v_request.status in ('in_progress', 'in_review') then
        perform public.transition_privacy_request_status(
          v_request.id,
          'rejected',
          'Export generation failed after max retries'
        );
      end if;
    end if;

    insert into public.event_outbox(event_type, aggregate_type, aggregate_id, payload)
    values (
      'privacy.export_failed',
      'privacy_request',
      v_job.privacy_request_id,
      jsonb_build_object(
        'request_id', v_job.privacy_request_id,
        'job_id', v_job.id,
        'user_id', v_job.user_id,
        'retry_count', v_retry_count,
        'max_retries', v_max_retries,
        'error', v_error
      )
    );

    perform public.append_audit_log(
      'privacy.export_failed',
      'privacy_export_jobs',
      v_job.id,
      'Privacy export failed after max retries',
      jsonb_build_object(
        'request_id', v_job.privacy_request_id,
        'user_id', v_job.user_id,
        'retry_count', v_retry_count,
        'max_retries', v_max_retries,
        'error', v_error
      )
    );

    return jsonb_build_object(
      'status', 'failed',
      'retryCount', v_retry_count,
      'finalFailure', true
    );
  end if;

  v_next_retry_at := now() + make_interval(secs => v_retry_delay);

  update public.privacy_export_jobs j
  set
    status = 'retry_scheduled',
    retry_count = v_retry_count,
    error_message = v_error,
    next_retry_at = v_next_retry_at,
    updated_at = now()
  where j.id = v_job.id;

  return jsonb_build_object(
    'status', 'retry_scheduled',
    'retryCount', v_retry_count,
    'nextRetryAt', v_next_retry_at,
    'finalFailure', false
  );
end;
$$;

-- === original: 202602190409_krux_beta_part4_s068.sql ===
alter table public.privacy_export_jobs enable row level security;

drop policy if exists privacy_export_jobs_select_self_or_service on public.privacy_export_jobs;
create policy privacy_export_jobs_select_self_or_service
on public.privacy_export_jobs for select to authenticated
using (user_id = auth.uid() or public.is_service_role());

drop policy if exists privacy_export_jobs_manage_service on public.privacy_export_jobs;
create policy privacy_export_jobs_manage_service
on public.privacy_export_jobs for all to authenticated
using (public.is_service_role())
with check (public.is_service_role());

revoke all on function public.build_privacy_export_payload(uuid) from public;
grant execute on function public.build_privacy_export_payload(uuid) to authenticated;
grant execute on function public.build_privacy_export_payload(uuid) to service_role;

revoke all on function public.queue_privacy_export_jobs(integer) from public;
grant execute on function public.queue_privacy_export_jobs(integer) to service_role;

revoke all on function public.claim_privacy_export_jobs(integer) from public;
grant execute on function public.claim_privacy_export_jobs(integer) to service_role;

revoke all on function public.complete_privacy_export_job(
  uuid,
  text,
  text,
  text,
  timestamptz,
  bigint,
  integer,
  text
) from public;
grant execute on function public.complete_privacy_export_job(
  uuid,
  text,
  text,
  text,
  timestamptz,
  bigint,
  integer,
  text
) to service_role;

revoke all on function public.fail_privacy_export_job(
  uuid,
  text,
  integer,
  integer
) from public;
grant execute on function public.fail_privacy_export_job(
  uuid,
  text,
  integer,
  integer
) to service_role;

-- === original: 202602190410_krux_beta_part4_s069.sql ===
create table if not exists public.legal_holds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  privacy_request_id uuid references public.privacy_requests(id) on delete set null,
  hold_type text not null check (
    hold_type in (
      'litigation',
      'fraud_investigation',
      'payment_dispute',
      'safety_incident',
      'regulatory_inquiry',
      'other'
    )
  ),
  reason text not null,
  is_active boolean not null default true,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  released_by uuid references public.profiles(id) on delete set null,
  released_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);

create index if not exists idx_legal_holds_user_active
  on public.legal_holds(user_id, is_active, starts_at desc);

create index if not exists idx_legal_holds_request
  on public.legal_holds(privacy_request_id);

drop trigger if exists trg_legal_holds_set_updated_at on public.legal_holds;
create trigger trg_legal_holds_set_updated_at
before update on public.legal_holds
for each row execute function public.set_updated_at();

create table if not exists public.privacy_delete_jobs (
  id uuid primary key default gen_random_uuid(),
  privacy_request_id uuid not null references public.privacy_requests(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status public.sync_job_status not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed', 'retry_scheduled')),
  anonymization_summary jsonb not null default '{}'::jsonb,
  retry_count integer not null default 0,
  next_retry_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (privacy_request_id)
);

create index if not exists idx_privacy_delete_jobs_status_retry
  on public.privacy_delete_jobs(status, next_retry_at, created_at);

create index if not exists idx_privacy_delete_jobs_user_created
  on public.privacy_delete_jobs(user_id, created_at desc);

drop trigger if exists trg_privacy_delete_jobs_set_updated_at on public.privacy_delete_jobs;
create trigger trg_privacy_delete_jobs_set_updated_at
before update on public.privacy_delete_jobs
for each row execute function public.set_updated_at();

create or replace function public.can_manage_privacy_user(
  p_target_user_id uuid,
  p_actor_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_service_role()
    or (
      p_actor_user_id is not null
      and p_actor_user_id = p_target_user_id
    )
    or exists (
      select 1
      from public.gym_memberships gm_actor
      join public.gym_memberships gm_target
        on gm_target.gym_id = gm_actor.gym_id
       and gm_target.user_id = p_target_user_id
       and gm_target.membership_status in ('trial', 'active')
      where gm_actor.user_id = p_actor_user_id
        and gm_actor.membership_status in ('trial', 'active')
        and gm_actor.role in ('leader', 'officer', 'coach')
    );
$$;

create or replace function public.can_staff_manage_privacy_user(
  p_target_user_id uuid,
  p_actor_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_service_role()
    or exists (
      select 1
      from public.gym_memberships gm_actor
      join public.gym_memberships gm_target
        on gm_target.gym_id = gm_actor.gym_id
       and gm_target.user_id = p_target_user_id
       and gm_target.membership_status in ('trial', 'active')
      where gm_actor.user_id = p_actor_user_id
        and gm_actor.membership_status in ('trial', 'active')
        and gm_actor.role in ('leader', 'officer', 'coach')
    );
$$;

create or replace function public.has_active_legal_hold(
  p_user_id uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_target_user uuid := coalesce(p_user_id, v_actor);
begin
  if v_target_user is null then
    raise exception 'Authentication required';
  end if;

  if not public.can_manage_privacy_user(v_target_user, v_actor) then
    raise exception 'Cannot inspect legal hold status for this user';
  end if;

  return exists (
    select 1
    from public.legal_holds h
    where h.user_id = v_target_user
      and h.is_active
      and h.starts_at <= now()
      and (h.ends_at is null or h.ends_at > now())
  );
end;
$$;

create or replace function public.apply_user_anonymization(
  p_user_id uuid,
  p_privacy_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := p_user_id;
  v_request_id uuid := p_privacy_request_id;
  v_now timestamptz := now();
  v_anonymized_username text;
  v_count integer := 0;
  v_summary jsonb := '{}'::jsonb;
begin
  if not public.is_service_role() then
    raise exception 'Service role required';
  end if;

  if v_user_id is null then
    raise exception 'User id is required';
  end if;

  if public.has_active_legal_hold(v_user_id) then
    raise exception 'Cannot anonymize user with an active legal hold';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_user_id
    for update
  ) then
    raise exception 'Profile not found for user %', v_user_id;
  end if;

  v_anonymized_username := left('deleted_' || replace(v_user_id::text, '-', ''), 24);

  update public.profiles p
  set
    username = v_anonymized_username,
    display_name = 'Deleted User',
    avatar_url = null,
    bio = null,
    home_gym_id = null,
    is_public = false,
    xp_total = 0,
    level = 1,
    rank_tier = 'initiate',
    chain_days = 0,
    last_workout_at = null,
    locale = null,
    preferred_units = 'metric',
    updated_at = v_now
  where p.id = v_user_id;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('profiles_updated', v_count);

  delete from public.social_connections sc
  where sc.follower_user_id = v_user_id
     or sc.followed_user_id = v_user_id;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('social_connections_deleted', v_count);

  delete from public.user_blocks ub
  where ub.blocker_user_id = v_user_id
     or ub.blocked_user_id = v_user_id;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('user_blocks_deleted', v_count);

  delete from public.user_reports ur
  where ur.reporter_user_id = v_user_id;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('user_reports_deleted', v_count);

  delete from public.social_interactions si
  where si.actor_user_id = v_user_id;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('social_interactions_deleted', v_count);

  delete from public.feed_events fe
  where fe.user_id = v_user_id;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('feed_events_deleted', v_count);

  delete from public.workouts w
  where w.user_id = v_user_id;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('workouts_deleted', v_count);

  delete from public.challenge_participants cp
  where cp.user_id = v_user_id;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('challenge_participants_deleted', v_count);

  delete from public.leaderboard_entries le
  where le.user_id = v_user_id;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('leaderboard_entries_deleted', v_count);

  delete from public.class_waitlist cw
  where cw.user_id = v_user_id;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('class_waitlist_deleted', v_count);

  delete from public.class_bookings cb
  where cb.user_id = v_user_id;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('class_bookings_deleted', v_count);

  delete from public.gym_checkins gc
  where gc.user_id = v_user_id;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('gym_checkins_deleted', v_count);

  update public.access_logs al
  set user_id = null
  where al.user_id = v_user_id;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('access_logs_anonymized', v_count);

  update public.payment_transactions pt
  set user_id = null,
      updated_at = v_now
  where pt.user_id = v_user_id;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('payment_transactions_anonymized', v_count);

  update public.notification_preferences np
  set
    push_enabled = false,
    email_enabled = false,
    in_app_enabled = false,
    marketing_enabled = false,
    workout_reactions_enabled = false,
    comments_enabled = false,
    challenge_updates_enabled = false,
    class_reminders_enabled = false,
    quiet_hours_start = null,
    quiet_hours_end = null,
    timezone = 'UTC',
    updated_at = v_now
  where np.user_id = v_user_id;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('notification_preferences_anonymized', v_count);

  delete from public.push_notification_tokens pnt
  where pnt.user_id = v_user_id;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('push_tokens_deleted', v_count);

  delete from public.device_connections dc
  where dc.user_id = v_user_id;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('device_connections_deleted', v_count);

  update public.waiver_acceptances wa
  set
    ip_address = null,
    user_agent = null,
    signature_data = '{}'::jsonb
  where wa.user_id = v_user_id;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('waiver_acceptances_anonymized', v_count);

  update public.contract_acceptances ca
  set
    ip_address = null,
    user_agent = null,
    signature_data = '{}'::jsonb
  where ca.user_id = v_user_id;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('contract_acceptances_anonymized', v_count);

  update public.privacy_requests pr
  set
    reason = null,
    notes = case when pr.id = v_request_id then pr.notes else null end,
    response_location = null,
    response_expires_at = null,
    response_content_type = null,
    response_bytes = null,
    updated_at = v_now
  where pr.user_id = v_user_id;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('privacy_requests_redacted', v_count);

  update public.privacy_export_jobs pej
  set
    signed_url = null,
    signed_url_expires_at = v_now,
    updated_at = v_now
  where pej.user_id = v_user_id
    and pej.signed_url is not null;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('privacy_export_links_revoked', v_count);

  v_summary := v_summary || jsonb_build_object(
    'user_id', v_user_id,
    'privacy_request_id', v_request_id,
    'anonymized_at', v_now,
    'anonymized_username', v_anonymized_username
  );

  insert into public.event_outbox(event_type, aggregate_type, aggregate_id, payload)
  values (
    'privacy.user_anonymized',
    'profile',
    v_user_id,
    v_summary
  );

  perform public.append_audit_log(
    'privacy.user_anonymized',
    'profiles',
    v_user_id,
    'User profile and related data anonymized',
    v_summary
  );

  return v_summary;
end;
$$;

create or replace function public.queue_privacy_delete_jobs(
  p_limit integer default 25
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 25), 200));
  v_count integer := 0;
begin
  if not public.is_service_role() then
    raise exception 'Service role required';
  end if;

  with candidates as (
    select
      pr.id as privacy_request_id,
      pr.user_id
    from public.privacy_requests pr
    where pr.request_type = 'delete'
      and pr.status in ('submitted', 'triaged', 'in_progress', 'in_review')
      and pr.resolved_at is null
      and not exists (
        select 1
        from public.privacy_delete_jobs j
        where j.privacy_request_id = pr.id
          and j.status in ('queued', 'running', 'retry_scheduled', 'succeeded')
      )
    order by pr.submitted_at asc
    limit v_limit
  )
  insert into public.privacy_delete_jobs(
    privacy_request_id,
    user_id,
    status,
    next_retry_at
  )
  select
    c.privacy_request_id,
    c.user_id,
    'queued'::public.sync_job_status,
    now()
  from candidates c
  on conflict (privacy_request_id)
  do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.claim_privacy_delete_jobs(
  p_limit integer default 5
)
returns setof public.privacy_delete_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 5), 50));
begin
  if not public.is_service_role() then
    raise exception 'Service role required';
  end if;

  return query
  with candidates as (
    select j.id
    from public.privacy_delete_jobs j
    join public.privacy_requests pr
      on pr.id = j.privacy_request_id
    where j.status in ('queued', 'retry_scheduled')
      and coalesce(j.next_retry_at, j.created_at) <= now()
      and pr.request_type = 'delete'
      and public.is_privacy_request_open_status(pr.status)
    order by coalesce(j.next_retry_at, j.created_at) asc
    limit v_limit
    for update of j skip locked
  ),
  updated as (
    update public.privacy_delete_jobs j
    set
      status = 'running',
      started_at = now(),
      finished_at = null,
      error_message = null,
      updated_at = now()
    from candidates c
    where j.id = c.id
    returning j.*
  )
  select *
  from updated;
end;
$$;

create or replace function public.complete_privacy_delete_job(
  p_job_id uuid,
  p_anonymization_summary jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.privacy_delete_jobs%rowtype;
  v_request public.privacy_requests%rowtype;
  v_summary jsonb := coalesce(p_anonymization_summary, '{}'::jsonb);
begin
  if not public.is_service_role() then
    raise exception 'Service role required';
  end if;

  if jsonb_typeof(v_summary) is distinct from 'object' then
    raise exception 'Anonymization summary must be a JSON object';
  end if;

  select *
  into v_job
  from public.privacy_delete_jobs j
  where j.id = p_job_id
  for update;

  if v_job.id is null then
    raise exception 'Privacy delete job not found';
  end if;

  if v_job.status <> 'running' then
    raise exception 'Privacy delete job must be running before completion';
  end if;

  if public.has_active_legal_hold(v_job.user_id) then
    raise exception 'Cannot complete delete job while legal hold is active';
  end if;

  select *
  into v_request
  from public.privacy_requests pr
  where pr.id = v_job.privacy_request_id
  for update;

  if v_request.id is null then
    raise exception 'Privacy request not found for delete job';
  end if;

  if v_request.status = 'submitted' then
    perform public.transition_privacy_request_status(
      v_request.id,
      'triaged',
      'Delete queue promoted request'
    );
    v_request.status := 'triaged';
  end if;

  if v_request.status = 'triaged' then
    perform public.transition_privacy_request_status(
      v_request.id,
      'in_progress',
      'Delete/anonymization processing started'
    );
    v_request.status := 'in_progress';
  end if;

  if v_request.status in ('in_progress', 'in_review') then
    perform public.transition_privacy_request_status(
      v_request.id,
      'fulfilled',
      'Delete/anonymization completed'
    );
  elsif v_request.status = 'rejected' then
    raise exception 'Cannot complete delete for rejected privacy request';
  end if;

  update public.privacy_delete_jobs j
  set
    status = 'succeeded',
    anonymization_summary = v_summary,
    finished_at = now(),
    next_retry_at = null,
    error_message = null,
    updated_at = now()
  where j.id = v_job.id;

  update public.privacy_requests pr
  set
    response_location = null,
    response_expires_at = null,
    response_content_type = 'application/json',
    response_bytes = null,
    updated_at = now()
  where pr.id = v_request.id;

  insert into public.event_outbox(event_type, aggregate_type, aggregate_id, payload)
  values (
    'privacy.delete_completed',
    'privacy_request',
    v_request.id,
    jsonb_build_object(
      'request_id', v_request.id,
      'job_id', v_job.id,
      'user_id', v_job.user_id,
      'anonymization_summary', v_summary
    )
  );

  perform public.append_audit_log(
    'privacy.delete_completed',
    'privacy_delete_jobs',
    v_job.id,
    'Privacy delete/anonymization completed',
    jsonb_build_object(
      'request_id', v_request.id,
      'user_id', v_job.user_id,
      'anonymization_summary', v_summary
    )
  );

  return v_request.id;
end;
$$;

create or replace function public.fail_privacy_delete_job(
  p_job_id uuid,
  p_error text,
  p_retry_delay_seconds integer default 900,
  p_max_retries integer default 5,
  p_force_final boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.privacy_delete_jobs%rowtype;
  v_request public.privacy_requests%rowtype;
  v_error text := coalesce(nullif(btrim(p_error), ''), 'Unknown delete processing error');
  v_retry_delay integer := greatest(60, least(coalesce(p_retry_delay_seconds, 900), 86400));
  v_max_retries integer := greatest(1, least(coalesce(p_max_retries, 5), 20));
  v_retry_count integer;
  v_next_retry_at timestamptz;
  v_final_failure boolean := false;
begin
  if not public.is_service_role() then
    raise exception 'Service role required';
  end if;

  select *
  into v_job
  from public.privacy_delete_jobs j
  where j.id = p_job_id
  for update;

  if v_job.id is null then
    raise exception 'Privacy delete job not found';
  end if;

  v_retry_count := coalesce(v_job.retry_count, 0) + 1;
  v_final_failure := coalesce(p_force_final, false) or v_retry_count >= v_max_retries;

  if v_final_failure then
    update public.privacy_delete_jobs j
    set
      status = 'failed',
      retry_count = v_retry_count,
      error_message = v_error,
      next_retry_at = null,
      finished_at = now(),
      updated_at = now()
    where j.id = v_job.id;

    select *
    into v_request
    from public.privacy_requests pr
    where pr.id = v_job.privacy_request_id
    for update;

    if v_request.id is not null and public.is_privacy_request_open_status(v_request.status) then
      if v_request.status = 'submitted' then
        perform public.transition_privacy_request_status(
          v_request.id,
          'triaged',
          'Delete queue promoted request'
        );
        v_request.status := 'triaged';
      end if;

      if v_request.status = 'triaged' then
        perform public.transition_privacy_request_status(
          v_request.id,
          'in_progress',
          'Delete/anonymization processing started'
        );
        v_request.status := 'in_progress';
      end if;

      if v_request.status in ('in_progress', 'in_review') then
        perform public.transition_privacy_request_status(
          v_request.id,
          'rejected',
          'Delete/anonymization failed after max retries'
        );
      end if;
    end if;

    insert into public.event_outbox(event_type, aggregate_type, aggregate_id, payload)
    values (
      'privacy.delete_failed',
      'privacy_request',
      v_job.privacy_request_id,
      jsonb_build_object(
        'request_id', v_job.privacy_request_id,
        'job_id', v_job.id,
        'user_id', v_job.user_id,
        'retry_count', v_retry_count,
        'max_retries', v_max_retries,
        'final_failure', true,
        'error', v_error
      )
    );

    perform public.append_audit_log(
      'privacy.delete_failed',
      'privacy_delete_jobs',
      v_job.id,
      'Privacy delete/anonymization failed after max retries',
      jsonb_build_object(
        'request_id', v_job.privacy_request_id,
        'user_id', v_job.user_id,
        'retry_count', v_retry_count,
        'max_retries', v_max_retries,
        'final_failure', true,
        'error', v_error
      )
    );

    return jsonb_build_object(
      'status', 'failed',
      'retryCount', v_retry_count,
      'finalFailure', true
    );
  end if;

  v_next_retry_at := now() + make_interval(secs => v_retry_delay);

  update public.privacy_delete_jobs j
  set
    status = 'retry_scheduled',
    retry_count = v_retry_count,
    error_message = v_error,
    next_retry_at = v_next_retry_at,
    updated_at = now()
  where j.id = v_job.id;

  return jsonb_build_object(
    'status', 'retry_scheduled',
    'retryCount', v_retry_count,
    'nextRetryAt', v_next_retry_at,
    'finalFailure', false
  );
end;
$$;

alter table public.legal_holds enable row level security;
alter table public.privacy_delete_jobs enable row level security;

drop policy if exists legal_holds_select_self_staff_or_service on public.legal_holds;
create policy legal_holds_select_self_staff_or_service
on public.legal_holds for select to authenticated
using (public.can_manage_privacy_user(user_id, auth.uid()));

drop policy if exists legal_holds_insert_staff_or_service on public.legal_holds;
create policy legal_holds_insert_staff_or_service
on public.legal_holds for insert to authenticated
with check (public.can_staff_manage_privacy_user(user_id, auth.uid()));

drop policy if exists legal_holds_update_staff_or_service on public.legal_holds;
create policy legal_holds_update_staff_or_service
on public.legal_holds for update to authenticated
using (public.can_staff_manage_privacy_user(user_id, auth.uid()))
with check (public.can_staff_manage_privacy_user(user_id, auth.uid()));

drop policy if exists legal_holds_delete_service_only on public.legal_holds;
create policy legal_holds_delete_service_only
on public.legal_holds for delete to authenticated
using (public.is_service_role());

drop policy if exists privacy_delete_jobs_select_self_or_service on public.privacy_delete_jobs;
create policy privacy_delete_jobs_select_self_or_service
on public.privacy_delete_jobs for select to authenticated
using (user_id = auth.uid() or public.is_service_role());

drop policy if exists privacy_delete_jobs_manage_service on public.privacy_delete_jobs;
create policy privacy_delete_jobs_manage_service
on public.privacy_delete_jobs for all to authenticated
using (public.is_service_role())
with check (public.is_service_role());

revoke all on function public.has_active_legal_hold(uuid) from public;
grant execute on function public.has_active_legal_hold(uuid) to authenticated;
grant execute on function public.has_active_legal_hold(uuid) to service_role;

revoke all on function public.apply_user_anonymization(uuid, uuid) from public;
grant execute on function public.apply_user_anonymization(uuid, uuid) to service_role;

revoke all on function public.queue_privacy_delete_jobs(integer) from public;
grant execute on function public.queue_privacy_delete_jobs(integer) to service_role;

revoke all on function public.claim_privacy_delete_jobs(integer) from public;
grant execute on function public.claim_privacy_delete_jobs(integer) to service_role;

revoke all on function public.complete_privacy_delete_job(uuid, jsonb) from public;
grant execute on function public.complete_privacy_delete_job(uuid, jsonb) to service_role;

revoke all on function public.fail_privacy_delete_job(
  uuid,
  text,
  integer,
  integer,
  boolean
) from public;
grant execute on function public.fail_privacy_delete_job(
  uuid,
  text,
  integer,
  integer,
  boolean
) to service_role;

-- === original: 202602190411_krux_beta_part4_s070.sql ===
create extension if not exists pgcrypto with schema extensions;

alter table public.audit_logs
  add column if not exists integrity_seq bigint,
  add column if not exists prev_entry_hash text,
  add column if not exists entry_hash text,
  add column if not exists integrity_version smallint not null default 1;

create index if not exists idx_audit_logs_action_time
  on public.audit_logs(action, created_at desc);

create unique index if not exists idx_audit_logs_integrity_seq
  on public.audit_logs(integrity_seq)
  where integrity_seq is not null;

create index if not exists idx_audit_logs_security_event_outbox
  on public.audit_logs((metadata->>'event_outbox_id'))
  where action = 'security.event_outbox';

create or replace function public.audit_log_compute_hash(
  p_integrity_seq bigint,
  p_prev_entry_hash text,
  p_actor_user_id uuid,
  p_actor_role text,
  p_action text,
  p_target_table text,
  p_target_id uuid,
  p_reason text,
  p_ip_address text,
  p_user_agent text,
  p_metadata jsonb,
  p_created_at timestamptz
)
returns text
language sql
immutable
set search_path = public
as $$
  select encode(
    extensions.digest(
      concat_ws(
        '|',
        coalesce(p_integrity_seq::text, ''),
        coalesce(p_prev_entry_hash, ''),
        coalesce(p_actor_user_id::text, ''),
        coalesce(p_actor_role, ''),
        coalesce(p_action, ''),
        coalesce(p_target_table, ''),
        coalesce(p_target_id::text, ''),
        coalesce(p_reason, ''),
        coalesce(p_ip_address, ''),
        coalesce(p_user_agent, ''),
        coalesce(p_metadata::text, '{}'::text),
        coalesce(to_char(p_created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), '')
      ),
      'sha256'
    ),
    'hex'
  );
$$;

create or replace function public.assign_audit_log_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev record;
begin
  new.created_at := coalesce(new.created_at, now());
  new.metadata := coalesce(new.metadata, '{}'::jsonb);

  perform pg_advisory_xact_lock(884211, 16);

  select
    a.integrity_seq,
    a.entry_hash
  into v_prev
  from public.audit_logs a
  order by a.integrity_seq desc nulls last
  limit 1;

  new.integrity_seq := coalesce(v_prev.integrity_seq, 0) + 1;
  new.prev_entry_hash := v_prev.entry_hash;
  new.entry_hash := public.audit_log_compute_hash(
    new.integrity_seq,
    new.prev_entry_hash,
    new.actor_user_id,
    new.actor_role,
    new.action,
    new.target_table,
    new.target_id,
    new.reason,
    new.ip_address,
    new.user_agent,
    new.metadata,
    new.created_at
  );

  return new;
end;
$$;

create or replace function public.is_security_relevant_event_type(
  p_event_type text
)
returns boolean
language sql
immutable
as $$
  select
    p_event_type like 'privacy.%'
    or p_event_type like 'consent.%'
    or p_event_type like 'policy.%'
    or p_event_type in (
      'integration.sync_failed',
      'membership.status_changed'
    );
$$;

create or replace function public.audit_security_event_outbox_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload_checksum text;
begin
  if not public.is_security_relevant_event_type(new.event_type) then
    return new;
  end if;

  if exists (
    select 1
    from public.audit_logs a
    where a.action = 'security.event_outbox'
      and a.metadata->>'event_outbox_id' = new.id::text
  ) then
    return new;
  end if;

  v_payload_checksum := encode(extensions.digest(coalesce(new.payload::text, '{}'::text), 'sha256'), 'hex');

  perform public.append_audit_log(
    'security.event_outbox',
    'event_outbox',
    new.id,
    'Security-relevant domain event captured',
    jsonb_build_object(
      'event_outbox_id', new.id,
      'event_type', new.event_type,
      'aggregate_type', new.aggregate_type,
      'aggregate_id', new.aggregate_id,
      'payload_checksum', v_payload_checksum,
      'published', new.published,
      'created_at', new.created_at
    )
  );

  return new;
end;
$$;

create or replace function public.audit_log_integrity_drift(
  p_limit integer default 200
)
returns table (
  integrity_seq bigint,
  audit_log_id uuid,
  issue text,
  expected text,
  actual text
)
language sql
security definer
set search_path = public
as $$
  with ordered as (
    select
      a.id,
      a.integrity_seq,
      a.prev_entry_hash,
      a.entry_hash,
      lag(a.entry_hash) over (order by a.integrity_seq asc) as expected_prev_entry_hash,
      lag(a.integrity_seq) over (order by a.integrity_seq asc) as previous_integrity_seq,
      public.audit_log_compute_hash(
        a.integrity_seq,
        a.prev_entry_hash,
        a.actor_user_id,
        a.actor_role,
        a.action,
        a.target_table,
        a.target_id,
        a.reason,
        a.ip_address,
        a.user_agent,
        a.metadata,
        a.created_at
      ) as expected_entry_hash
    from public.audit_logs a
    where a.integrity_seq is not null
      and a.entry_hash is not null
  ),
  expanded as (
    select
      o.integrity_seq,
      o.id as audit_log_id,
      case
        when o.previous_integrity_seq is not null and o.integrity_seq <> o.previous_integrity_seq + 1
          then 'sequence_gap'
        when o.expected_prev_entry_hash is distinct from o.prev_entry_hash
          then 'previous_hash_mismatch'
        when o.expected_entry_hash is distinct from o.entry_hash
          then 'entry_hash_mismatch'
        else null
      end as issue,
      case
        when o.previous_integrity_seq is not null and o.integrity_seq <> o.previous_integrity_seq + 1
          then (o.previous_integrity_seq + 1)::text
        when o.expected_prev_entry_hash is distinct from o.prev_entry_hash
          then coalesce(o.expected_prev_entry_hash, '<null>')
        when o.expected_entry_hash is distinct from o.entry_hash
          then coalesce(o.expected_entry_hash, '<null>')
        else null
      end as expected,
      case
        when o.previous_integrity_seq is not null and o.integrity_seq <> o.previous_integrity_seq + 1
          then o.integrity_seq::text
        when o.expected_prev_entry_hash is distinct from o.prev_entry_hash
          then coalesce(o.prev_entry_hash, '<null>')
        when o.expected_entry_hash is distinct from o.entry_hash
          then coalesce(o.entry_hash, '<null>')
        else null
      end as actual
    from ordered o
  )
  select
    e.integrity_seq,
    e.audit_log_id,
    e.issue,
    e.expected,
    e.actual
  from expanded e
  where e.issue is not null
  order by e.integrity_seq asc
  limit greatest(1, least(coalesce(p_limit, 200), 5000));
$$;

create or replace function public.audit_log_integrity_summary(
  p_limit integer default 200
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 200), 5000));
  v_drift_count integer := 0;
  v_first_drift jsonb := null;
begin
  select count(*)
  into v_drift_count
  from public.audit_log_integrity_drift(v_limit);

  select to_jsonb(d)
  into v_first_drift
  from public.audit_log_integrity_drift(v_limit) d
  order by d.integrity_seq asc
  limit 1;

  return jsonb_build_object(
    'checked_rows', v_limit,
    'drift_count', v_drift_count,
    'healthy', v_drift_count = 0,
    'first_drift', v_first_drift
  );
end;
$$;

drop trigger if exists trg_audit_logs_assign_integrity on public.audit_logs;
drop trigger if exists trg_audit_logs_no_update on public.audit_logs;
drop trigger if exists trg_audit_logs_immutable on public.audit_logs;

-- Backfill integrity chain for existing rows.
do $$
declare
  v_prev_hash text := null;
  v_seq bigint := 0;
  v_row record;
begin
  perform pg_advisory_xact_lock(884211, 16);

  for v_row in
    select
      a.id,
      a.actor_user_id,
      a.actor_role,
      a.action,
      a.target_table,
      a.target_id,
      a.reason,
      a.ip_address,
      a.user_agent,
      a.metadata,
      a.created_at
    from public.audit_logs a
    order by a.created_at asc, a.id asc
  loop
    v_seq := v_seq + 1;

    update public.audit_logs a
    set
      integrity_seq = v_seq,
      prev_entry_hash = v_prev_hash,
      entry_hash = public.audit_log_compute_hash(
        v_seq,
        v_prev_hash,
        v_row.actor_user_id,
        v_row.actor_role,
        v_row.action,
        v_row.target_table,
        v_row.target_id,
        v_row.reason,
        v_row.ip_address,
        v_row.user_agent,
        coalesce(v_row.metadata, '{}'::jsonb),
        v_row.created_at
      ),
      integrity_version = 1
    where a.id = v_row.id;

    select a.entry_hash
    into v_prev_hash
    from public.audit_logs a
    where a.id = v_row.id;
  end loop;
end;
$$;

alter table public.audit_logs
  alter column integrity_seq set not null,
  alter column entry_hash set not null;

create trigger trg_audit_logs_assign_integrity
before insert on public.audit_logs
for each row execute function public.assign_audit_log_integrity();

create trigger trg_audit_logs_immutable
before update or delete on public.audit_logs
for each row execute function public.reject_mutation_immutable_table();

drop trigger if exists trg_event_outbox_audit_security_event on public.event_outbox;
create trigger trg_event_outbox_audit_security_event
after insert on public.event_outbox
for each row execute function public.audit_security_event_outbox_insert();

drop policy if exists audit_logs_insert_service_or_staff on public.audit_logs;
create policy audit_logs_insert_service_only
on public.audit_logs for insert to authenticated
with check (public.is_service_role());

revoke all on function public.audit_log_compute_hash(
  bigint,
  text,
  uuid,
  text,
  text,
  text,
  uuid,
  text,
  text,
  text,
  jsonb,
  timestamptz
) from public;
grant execute on function public.audit_log_compute_hash(
  bigint,
  text,
  uuid,
  text,
  text,
  text,
  uuid,
  text,
  text,
  text,
  jsonb,
  timestamptz
) to service_role;

revoke all on function public.is_security_relevant_event_type(text) from public;
grant execute on function public.is_security_relevant_event_type(text) to authenticated;
grant execute on function public.is_security_relevant_event_type(text) to service_role;

revoke all on function public.audit_log_integrity_drift(integer) from public;
grant execute on function public.audit_log_integrity_drift(integer) to authenticated;
grant execute on function public.audit_log_integrity_drift(integer) to service_role;

revoke all on function public.audit_log_integrity_summary(integer) from public;
grant execute on function public.audit_log_integrity_summary(integer) to authenticated;
grant execute on function public.audit_log_integrity_summary(integer) to service_role;

-- === original: 202602190412_krux_beta_part4_s071.sql ===
create table if not exists public.security_incidents (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid references public.gyms(id) on delete set null,
  title text not null,
  description text,
  severity text not null default 'high' check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'detected'
    check (status in ('detected', 'triaged', 'investigating', 'contained', 'notified', 'resolved', 'closed')),
  source text not null default 'internal_monitor',
  drill_mode boolean not null default true,
  requires_ftc_notice boolean not null default false,
  requires_gdpr_notice boolean not null default true,
  detected_at timestamptz not null default now(),
  ftc_notice_due_at timestamptz,
  gdpr_notice_due_at timestamptz,
  first_triaged_at timestamptz,
  investigation_started_at timestamptz,
  contained_at timestamptz,
  notified_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  affected_user_count integer not null default 0 check (affected_user_count >= 0),
  affected_gym_count integer not null default 0 check (affected_gym_count >= 0),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((not requires_ftc_notice) or ftc_notice_due_at is not null),
  check ((not requires_gdpr_notice) or gdpr_notice_due_at is not null),
  check (closed_at is null or resolved_at is not null)
);

create index if not exists idx_security_incidents_gym_status
  on public.security_incidents(gym_id, status, detected_at desc);

create index if not exists idx_security_incidents_deadline_ftc
  on public.security_incidents(ftc_notice_due_at)
  where requires_ftc_notice and status not in ('resolved', 'closed');

create index if not exists idx_security_incidents_deadline_gdpr
  on public.security_incidents(gdpr_notice_due_at)
  where requires_gdpr_notice and status not in ('resolved', 'closed');

create index if not exists idx_security_incidents_status_updated
  on public.security_incidents(status, updated_at desc);

drop trigger if exists trg_security_incidents_set_updated_at on public.security_incidents;
create trigger trg_security_incidents_set_updated_at
before update on public.security_incidents
for each row execute function public.set_updated_at();

create table if not exists public.incident_actions (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.security_incidents(id) on delete cascade,
  action_type text not null check (
    action_type in (
      'created',
      'status_changed',
      'deadline_recomputed',
      'escalation_triggered',
      'notification_queued',
      'notification_sent',
      'notification_failed',
      'note_added'
    )
  ),
  action_note text,
  metadata jsonb not null default '{}'::jsonb,
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor_role text,
  created_at timestamptz not null default now()
);

create index if not exists idx_incident_actions_incident_time
  on public.incident_actions(incident_id, created_at desc);

create index if not exists idx_incident_actions_type_time
  on public.incident_actions(action_type, created_at desc);

create table if not exists public.incident_notification_jobs (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.security_incidents(id) on delete cascade,
  channel text not null check (channel in ('email', 'webhook')),
  destination text not null,
  template_key text not null default 'security_incident_notice_v1',
  payload jsonb not null default '{}'::jsonb,
  delivery_mode text not null check (delivery_mode in ('drill', 'live')),
  provider text not null default 'stub',
  status public.sync_job_status not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed', 'retry_scheduled')),
  attempt_count integer not null default 0,
  next_attempt_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  last_error text,
  response_payload jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_incident_notification_jobs_status_retry
  on public.incident_notification_jobs(status, next_attempt_at, created_at);

create index if not exists idx_incident_notification_jobs_incident_created
  on public.incident_notification_jobs(incident_id, created_at desc);

drop trigger if exists trg_incident_notification_jobs_set_updated_at on public.incident_notification_jobs;
create trigger trg_incident_notification_jobs_set_updated_at
before update on public.incident_notification_jobs
for each row execute function public.set_updated_at();

create or replace function public.is_incident_open_status(
  p_status text
)
returns boolean
language sql
immutable
as $$
  select p_status in ('detected', 'triaged', 'investigating', 'contained', 'notified');
$$;

create or replace function public.compute_incident_notice_deadlines(
  p_detected_at timestamptz,
  p_requires_ftc_notice boolean,
  p_requires_gdpr_notice boolean,
  p_ftc_deadline_hours integer default 1440,
  p_gdpr_deadline_hours integer default 72
)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_detected_at timestamptz := p_detected_at;
  v_ftc_hours integer := greatest(1, least(coalesce(p_ftc_deadline_hours, 1440), 24 * 365));
  v_gdpr_hours integer := greatest(1, least(coalesce(p_gdpr_deadline_hours, 72), 24 * 365));
  v_ftc_due timestamptz := null;
  v_gdpr_due timestamptz := null;
begin
  if v_detected_at is null then
    raise exception 'Detected timestamp is required';
  end if;

  if coalesce(p_requires_ftc_notice, false) then
    v_ftc_due := v_detected_at + make_interval(hours => v_ftc_hours);
  end if;

  if coalesce(p_requires_gdpr_notice, false) then
    v_gdpr_due := v_detected_at + make_interval(hours => v_gdpr_hours);
  end if;

  return jsonb_build_object(
    'detected_at', v_detected_at,
    'ftc_notice_due_at', v_ftc_due,
    'gdpr_notice_due_at', v_gdpr_due,
    'ftc_deadline_hours', v_ftc_hours,
    'gdpr_deadline_hours', v_gdpr_hours
  );
end;
$$;

create or replace function public.can_view_security_incident(
  p_incident_id uuid,
  p_actor_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.security_incidents si
    where si.id = p_incident_id
      and (
        public.is_service_role()
        or (
          si.gym_id is not null
          and public.is_gym_staff(si.gym_id, p_actor_user_id)
        )
      )
  );
$$;

create or replace function public.create_security_incident(
  p_gym_id uuid,
  p_title text,
  p_description text default null,
  p_severity text default 'high',
  p_source text default 'internal_monitor',
  p_drill_mode boolean default true,
  p_requires_ftc_notice boolean default false,
  p_requires_gdpr_notice boolean default true,
  p_detected_at timestamptz default now(),
  p_ftc_deadline_hours integer default 1440,
  p_gdpr_deadline_hours integer default 72,
  p_affected_user_count integer default 0,
  p_affected_gym_count integer default 0,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_is_service boolean := public.is_service_role();
  v_title text := nullif(btrim(p_title), '');
  v_description text := nullif(btrim(p_description), '');
  v_severity text := lower(coalesce(nullif(btrim(p_severity), ''), 'high'));
  v_source text := coalesce(nullif(btrim(p_source), ''), 'internal_monitor');
  v_detected_at timestamptz := coalesce(p_detected_at, now());
  v_deadlines jsonb;
  v_ftc_due timestamptz;
  v_gdpr_due timestamptz;
  v_incident_id uuid;
  v_action_id uuid;
  v_actor_role text := coalesce(auth.jwt()->>'role', 'authenticated');
  v_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
begin
  if v_title is null then
    raise exception 'Incident title is required';
  end if;

  if jsonb_typeof(v_metadata) is distinct from 'object' then
    raise exception 'Incident metadata must be a JSON object';
  end if;

  if v_severity not in ('low', 'medium', 'high', 'critical') then
    raise exception 'Invalid incident severity';
  end if;

  if not v_is_service then
    if v_actor is null then
      raise exception 'Authentication required';
    end if;

    if p_gym_id is null or not public.is_gym_staff(p_gym_id, v_actor) then
      raise exception 'Gym staff access is required';
    end if;
  end if;

  v_deadlines := public.compute_incident_notice_deadlines(
    v_detected_at,
    coalesce(p_requires_ftc_notice, false),
    coalesce(p_requires_gdpr_notice, true),
    p_ftc_deadline_hours,
    p_gdpr_deadline_hours
  );

  v_ftc_due := (v_deadlines->>'ftc_notice_due_at')::timestamptz;
  v_gdpr_due := (v_deadlines->>'gdpr_notice_due_at')::timestamptz;

  insert into public.security_incidents(
    gym_id,
    title,
    description,
    severity,
    status,
    source,
    drill_mode,
    requires_ftc_notice,
    requires_gdpr_notice,
    detected_at,
    ftc_notice_due_at,
    gdpr_notice_due_at,
    affected_user_count,
    affected_gym_count,
    created_by,
    updated_by,
    metadata
  )
  values (
    p_gym_id,
    v_title,
    v_description,
    v_severity,
    'detected',
    v_source,
    coalesce(p_drill_mode, true),
    coalesce(p_requires_ftc_notice, false),
    coalesce(p_requires_gdpr_notice, true),
    v_detected_at,
    v_ftc_due,
    v_gdpr_due,
    greatest(0, coalesce(p_affected_user_count, 0)),
    greatest(0, coalesce(p_affected_gym_count, 0)),
    v_actor,
    v_actor,
    v_metadata
  )
  returning id into v_incident_id;

  insert into public.incident_actions(
    incident_id,
    action_type,
    action_note,
    metadata,
    actor_user_id,
    actor_role
  )
  values (
    v_incident_id,
    'created',
    'Incident created',
    jsonb_build_object(
      'severity', v_severity,
      'source', v_source,
      'detected_at', v_detected_at,
      'drill_mode', coalesce(p_drill_mode, true),
      'requires_ftc_notice', coalesce(p_requires_ftc_notice, false),
      'requires_gdpr_notice', coalesce(p_requires_gdpr_notice, true),
      'ftc_notice_due_at', v_ftc_due,
      'gdpr_notice_due_at', v_gdpr_due
    ),
    v_actor,
    v_actor_role
  )
  returning id into v_action_id;

  insert into public.event_outbox(event_type, aggregate_type, aggregate_id, payload)
  values (
    'incident.created',
    'security_incident',
    v_incident_id,
    jsonb_build_object(
      'incident_id', v_incident_id,
      'action_id', v_action_id,
      'gym_id', p_gym_id,
      'severity', v_severity,
      'status', 'detected',
      'drill_mode', coalesce(p_drill_mode, true),
      'detected_at', v_detected_at,
      'ftc_notice_due_at', v_ftc_due,
      'gdpr_notice_due_at', v_gdpr_due
    )
  );

  perform public.append_audit_log(
    'incident.created',
    'security_incidents',
    v_incident_id,
    'Security incident created',
    jsonb_build_object(
      'action_id', v_action_id,
      'severity', v_severity,
      'drill_mode', coalesce(p_drill_mode, true),
      'gym_id', p_gym_id,
      'detected_at', v_detected_at,
      'ftc_notice_due_at', v_ftc_due,
      'gdpr_notice_due_at', v_gdpr_due
    )
  );

  return v_incident_id;
end;
$$;

create or replace function public.transition_security_incident_status(
  p_incident_id uuid,
  p_next_status text,
  p_note text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_is_service boolean := public.is_service_role();
  v_incident public.security_incidents%rowtype;
  v_next_status text := lower(coalesce(nullif(btrim(p_next_status), ''), ''));
  v_note text := nullif(btrim(p_note), '');
  v_now timestamptz := now();
  v_action_id uuid;
  v_actor_role text := coalesce(auth.jwt()->>'role', 'authenticated');
  v_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
begin
  if v_next_status not in ('detected', 'triaged', 'investigating', 'contained', 'notified', 'resolved', 'closed') then
    raise exception 'Invalid incident status: %', v_next_status;
  end if;

  if jsonb_typeof(v_metadata) is distinct from 'object' then
    raise exception 'Incident transition metadata must be a JSON object';
  end if;

  select *
  into v_incident
  from public.security_incidents si
  where si.id = p_incident_id
  for update;

  if v_incident.id is null then
    raise exception 'Security incident not found';
  end if;

  if not v_is_service then
    if v_actor is null then
      raise exception 'Authentication required';
    end if;

    if v_incident.gym_id is null or not public.is_gym_staff(v_incident.gym_id, v_actor) then
      raise exception 'Gym staff access is required';
    end if;
  end if;

  if v_incident.status = v_next_status then
    return v_incident.id;
  end if;

  if not (
    (v_incident.status = 'detected' and v_next_status in ('triaged', 'closed'))
    or (v_incident.status = 'triaged' and v_next_status in ('investigating', 'contained', 'closed'))
    or (v_incident.status = 'investigating' and v_next_status in ('contained', 'notified', 'resolved', 'closed'))
    or (v_incident.status = 'contained' and v_next_status in ('notified', 'resolved', 'closed'))
    or (v_incident.status = 'notified' and v_next_status in ('resolved', 'closed'))
    or (v_incident.status = 'resolved' and v_next_status in ('closed'))
  ) then
    raise exception 'Invalid incident status transition: % -> %', v_incident.status, v_next_status;
  end if;

  update public.security_incidents si
  set
    status = v_next_status,
    first_triaged_at = case
      when v_next_status = 'triaged' then coalesce(si.first_triaged_at, v_now)
      else si.first_triaged_at
    end,
    investigation_started_at = case
      when v_next_status = 'investigating' then coalesce(si.investigation_started_at, v_now)
      else si.investigation_started_at
    end,
    contained_at = case
      when v_next_status = 'contained' then coalesce(si.contained_at, v_now)
      else si.contained_at
    end,
    notified_at = case
      when v_next_status = 'notified' then coalesce(si.notified_at, v_now)
      else si.notified_at
    end,
    resolved_at = case
      when v_next_status = 'resolved' then coalesce(si.resolved_at, v_now)
      else si.resolved_at
    end,
    closed_at = case
      when v_next_status = 'closed' then coalesce(si.closed_at, v_now)
      else si.closed_at
    end,
    updated_by = coalesce(v_actor, si.updated_by),
    updated_at = v_now
  where si.id = v_incident.id;

  insert into public.incident_actions(
    incident_id,
    action_type,
    action_note,
    metadata,
    actor_user_id,
    actor_role
  )
  values (
    v_incident.id,
    'status_changed',
    coalesce(v_note, 'Incident status transition'),
    v_metadata || jsonb_build_object(
      'previous_status', v_incident.status,
      'next_status', v_next_status,
      'transitioned_at', v_now
    ),
    v_actor,
    v_actor_role
  )
  returning id into v_action_id;

  insert into public.event_outbox(event_type, aggregate_type, aggregate_id, payload)
  values (
    'incident.status_changed',
    'security_incident',
    v_incident.id,
    jsonb_build_object(
      'incident_id', v_incident.id,
      'action_id', v_action_id,
      'previous_status', v_incident.status,
      'next_status', v_next_status,
      'at', v_now
    )
  );

  perform public.append_audit_log(
    'incident.status_changed',
    'security_incidents',
    v_incident.id,
    coalesce(v_note, 'Security incident status transitioned'),
    jsonb_build_object(
      'action_id', v_action_id,
      'previous_status', v_incident.status,
      'next_status', v_next_status,
      'transitioned_at', v_now
    )
  );

  return v_incident.id;
end;
$$;

create or replace function public.recompute_security_incident_deadlines(
  p_incident_id uuid,
  p_ftc_deadline_hours integer default 1440,
  p_gdpr_deadline_hours integer default 72,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_is_service boolean := public.is_service_role();
  v_incident public.security_incidents%rowtype;
  v_deadlines jsonb;
  v_ftc_due timestamptz;
  v_gdpr_due timestamptz;
  v_action_id uuid;
  v_actor_role text := coalesce(auth.jwt()->>'role', 'authenticated');
  v_note text := nullif(btrim(p_note), '');
begin
  select *
  into v_incident
  from public.security_incidents si
  where si.id = p_incident_id
  for update;

  if v_incident.id is null then
    raise exception 'Security incident not found';
  end if;

  if not v_is_service then
    if v_actor is null then
      raise exception 'Authentication required';
    end if;

    if v_incident.gym_id is null or not public.is_gym_staff(v_incident.gym_id, v_actor) then
      raise exception 'Gym staff access is required';
    end if;
  end if;

  v_deadlines := public.compute_incident_notice_deadlines(
    v_incident.detected_at,
    v_incident.requires_ftc_notice,
    v_incident.requires_gdpr_notice,
    p_ftc_deadline_hours,
    p_gdpr_deadline_hours
  );

  v_ftc_due := (v_deadlines->>'ftc_notice_due_at')::timestamptz;
  v_gdpr_due := (v_deadlines->>'gdpr_notice_due_at')::timestamptz;

  update public.security_incidents si
  set
    ftc_notice_due_at = v_ftc_due,
    gdpr_notice_due_at = v_gdpr_due,
    updated_by = coalesce(v_actor, si.updated_by),
    updated_at = now()
  where si.id = v_incident.id;

  insert into public.incident_actions(
    incident_id,
    action_type,
    action_note,
    metadata,
    actor_user_id,
    actor_role
  )
  values (
    v_incident.id,
    'deadline_recomputed',
    coalesce(v_note, 'Regulatory notice deadlines recomputed'),
    jsonb_build_object(
      'ftc_notice_due_at', v_ftc_due,
      'gdpr_notice_due_at', v_gdpr_due,
      'ftc_deadline_hours', (v_deadlines->>'ftc_deadline_hours')::integer,
      'gdpr_deadline_hours', (v_deadlines->>'gdpr_deadline_hours')::integer
    ),
    v_actor,
    v_actor_role
  )
  returning id into v_action_id;

  insert into public.event_outbox(event_type, aggregate_type, aggregate_id, payload)
  values (
    'incident.deadline_recomputed',
    'security_incident',
    v_incident.id,
    jsonb_build_object(
      'incident_id', v_incident.id,
      'action_id', v_action_id,
      'ftc_notice_due_at', v_ftc_due,
      'gdpr_notice_due_at', v_gdpr_due
    )
  );

  perform public.append_audit_log(
    'incident.deadline_recomputed',
    'security_incidents',
    v_incident.id,
    coalesce(v_note, 'Incident deadlines recomputed'),
    jsonb_build_object(
      'action_id', v_action_id,
      'ftc_notice_due_at', v_ftc_due,
      'gdpr_notice_due_at', v_gdpr_due
    )
  );

  return v_incident.id;
end;
$$;

create or replace function public.admin_list_security_incidents(
  p_gym_id uuid,
  p_limit integer default 50,
  p_status_filter text default null
)
returns table (
  id uuid,
  gym_id uuid,
  title text,
  severity text,
  status text,
  drill_mode boolean,
  detected_at timestamptz,
  requires_ftc_notice boolean,
  requires_gdpr_notice boolean,
  ftc_notice_due_at timestamptz,
  gdpr_notice_due_at timestamptz,
  next_deadline_at timestamptz,
  next_deadline_label text,
  seconds_to_next_deadline bigint,
  is_deadline_breached boolean,
  affected_user_count integer,
  affected_gym_count integer,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_is_service boolean := public.is_service_role();
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 200));
  v_status_filter text := lower(nullif(btrim(p_status_filter), ''));
begin
  if not v_is_service then
    if v_actor is null then
      raise exception 'Authentication required';
    end if;

    if p_gym_id is null then
      raise exception 'Gym id is required';
    end if;

    if not public.is_gym_staff(p_gym_id, v_actor) then
      raise exception 'Gym staff access is required';
    end if;
  end if;

  if v_status_filter is not null and v_status_filter not in (
    'detected', 'triaged', 'investigating', 'contained', 'notified', 'resolved', 'closed'
  ) then
    raise exception 'Invalid status filter';
  end if;

  return query
  with scoped as (
    select si.*
    from public.security_incidents si
    where (
      v_is_service
      and (p_gym_id is null or si.gym_id = p_gym_id)
    )
    or (
      not v_is_service
      and si.gym_id = p_gym_id
    )
  )
  select
    si.id,
    si.gym_id,
    si.title,
    si.severity,
    si.status,
    si.drill_mode,
    si.detected_at,
    si.requires_ftc_notice,
    si.requires_gdpr_notice,
    si.ftc_notice_due_at,
    si.gdpr_notice_due_at,
    d.next_deadline_at,
    case
      when d.next_deadline_at is null then null
      when si.requires_gdpr_notice and si.gdpr_notice_due_at = d.next_deadline_at then 'gdpr'
      when si.requires_ftc_notice and si.ftc_notice_due_at = d.next_deadline_at then 'ftc'
      else 'mixed'
    end as next_deadline_label,
    case
      when d.next_deadline_at is null then null
      else extract(epoch from (d.next_deadline_at - now()))::bigint
    end as seconds_to_next_deadline,
    case
      when d.next_deadline_at is null then false
      when si.status in ('resolved', 'closed') then false
      else d.next_deadline_at < now()
    end as is_deadline_breached,
    si.affected_user_count,
    si.affected_gym_count,
    si.updated_at
  from scoped si
  cross join lateral (
    select min(deadline_at) as next_deadline_at
    from (
      values
        (case when si.requires_ftc_notice then si.ftc_notice_due_at else null end),
        (case when si.requires_gdpr_notice then si.gdpr_notice_due_at else null end)
    ) as deadlines(deadline_at)
  ) d
  where v_status_filter is null or si.status = v_status_filter
  order by
    (case
      when d.next_deadline_at is null then 1
      when si.status in ('resolved', 'closed') then 1
      when d.next_deadline_at < now() then 0
      else 1
    end) asc,
    d.next_deadline_at asc nulls last,
    si.detected_at desc
  limit v_limit;
end;
$$;

create or replace function public.queue_incident_escalation_notifications(
  p_incident_id uuid,
  p_reason text default null,
  p_channels text[] default array['email'::text, 'webhook'::text],
  p_email_destination text default null,
  p_webhook_destination text default null,
  p_payload jsonb default '{}'::jsonb,
  p_force_live boolean default false,
  p_template_key text default 'security_incident_notice_v1'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_is_service boolean := public.is_service_role();
  v_incident public.security_incidents%rowtype;
  v_reason text := nullif(btrim(p_reason), '');
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_template_key text := coalesce(nullif(btrim(p_template_key), ''), 'security_incident_notice_v1');
  v_delivery_mode text;
  v_channels text[] := coalesce(p_channels, array['email'::text, 'webhook'::text]);
  v_channel text;
  v_destination text;
  v_count integer := 0;
  v_now timestamptz := now();
  v_action_id uuid;
  v_actor_role text := coalesce(auth.jwt()->>'role', 'authenticated');
begin
  if jsonb_typeof(v_payload) is distinct from 'object' then
    raise exception 'Escalation payload must be a JSON object';
  end if;

  select *
  into v_incident
  from public.security_incidents si
  where si.id = p_incident_id
  for update;

  if v_incident.id is null then
    raise exception 'Security incident not found';
  end if;

  if not v_is_service then
    if v_actor is null then
      raise exception 'Authentication required';
    end if;

    if v_incident.gym_id is null or not public.is_gym_staff(v_incident.gym_id, v_actor) then
      raise exception 'Gym staff access is required';
    end if;
  end if;

  if v_incident.status in ('resolved', 'closed') then
    raise exception 'Cannot queue escalation for resolved or closed incident';
  end if;

  v_delivery_mode := case
    when coalesce(p_force_live, false) then 'live'
    when v_incident.drill_mode then 'drill'
    else 'live'
  end;

  for v_channel in
    select distinct lower(btrim(raw_channel))
    from unnest(v_channels) as raw_channel
    where nullif(btrim(raw_channel), '') is not null
  loop
    if v_channel = 'email' then
      v_destination := coalesce(nullif(btrim(p_email_destination), ''), 'compliance-drill@kruxt.local');
    elsif v_channel = 'webhook' then
      v_destination := coalesce(nullif(btrim(p_webhook_destination), ''), 'https://example.invalid/kruxt/incident');
    else
      raise exception 'Unsupported incident notification channel: %', v_channel;
    end if;

    insert into public.incident_notification_jobs(
      incident_id,
      channel,
      destination,
      template_key,
      payload,
      delivery_mode,
      provider,
      status,
      next_attempt_at,
      created_by
    )
    values (
      v_incident.id,
      v_channel,
      v_destination,
      v_template_key,
      v_payload || jsonb_build_object(
        'incident_id', v_incident.id,
        'incident_title', v_incident.title,
        'incident_status', v_incident.status,
        'incident_severity', v_incident.severity,
        'reason', v_reason,
        'queued_at', v_now
      ),
      v_delivery_mode,
      'stub',
      'queued'::public.sync_job_status,
      v_now,
      v_actor
    );

    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'At least one escalation channel is required';
  end if;

  insert into public.incident_actions(
    incident_id,
    action_type,
    action_note,
    metadata,
    actor_user_id,
    actor_role
  )
  values (
    v_incident.id,
    'escalation_triggered',
    coalesce(v_reason, 'Incident escalation jobs queued'),
    jsonb_build_object(
      'job_count', v_count,
      'delivery_mode', v_delivery_mode,
      'channels', v_channels,
      'template_key', v_template_key,
      'queued_at', v_now
    ),
    v_actor,
    v_actor_role
  )
  returning id into v_action_id;

  insert into public.event_outbox(event_type, aggregate_type, aggregate_id, payload)
  values (
    'incident.escalation_triggered',
    'security_incident',
    v_incident.id,
    jsonb_build_object(
      'incident_id', v_incident.id,
      'action_id', v_action_id,
      'job_count', v_count,
      'delivery_mode', v_delivery_mode,
      'channels', v_channels,
      'queued_at', v_now
    )
  );

  perform public.append_audit_log(
    'incident.escalation_triggered',
    'security_incidents',
    v_incident.id,
    coalesce(v_reason, 'Incident escalation queued'),
    jsonb_build_object(
      'action_id', v_action_id,
      'job_count', v_count,
      'delivery_mode', v_delivery_mode,
      'channels', v_channels
    )
  );

  return v_count;
end;
$$;

create or replace function public.claim_incident_notification_jobs(
  p_limit integer default 20
)
returns setof public.incident_notification_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 20), 100));
begin
  if not public.is_service_role() then
    raise exception 'Service role required';
  end if;

  return query
  with candidates as (
    select j.id
    from public.incident_notification_jobs j
    where j.status in ('queued', 'retry_scheduled')
      and coalesce(j.next_attempt_at, j.created_at) <= now()
    order by coalesce(j.next_attempt_at, j.created_at) asc
    limit v_limit
    for update of j skip locked
  ),
  updated as (
    update public.incident_notification_jobs j
    set
      status = 'running',
      started_at = now(),
      finished_at = null,
      last_error = null,
      updated_at = now()
    from candidates c
    where j.id = c.id
    returning j.*
  )
  select *
  from updated;
end;
$$;

create or replace function public.complete_incident_notification_job(
  p_job_id uuid,
  p_response_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.incident_notification_jobs%rowtype;
  v_incident public.security_incidents%rowtype;
  v_response_payload jsonb := coalesce(p_response_payload, '{}'::jsonb);
  v_action_id uuid;
begin
  if not public.is_service_role() then
    raise exception 'Service role required';
  end if;

  if jsonb_typeof(v_response_payload) is distinct from 'object' then
    raise exception 'Notification response payload must be a JSON object';
  end if;

  select *
  into v_job
  from public.incident_notification_jobs j
  where j.id = p_job_id
  for update;

  if v_job.id is null then
    raise exception 'Incident notification job not found';
  end if;

  if v_job.status <> 'running' then
    raise exception 'Incident notification job must be running before completion';
  end if;

  select *
  into v_incident
  from public.security_incidents si
  where si.id = v_job.incident_id
  for update;

  if v_incident.id is null then
    raise exception 'Security incident not found for notification job';
  end if;

  update public.incident_notification_jobs j
  set
    status = 'succeeded',
    attempt_count = coalesce(j.attempt_count, 0) + 1,
    response_payload = v_response_payload,
    finished_at = now(),
    next_attempt_at = null,
    last_error = null,
    updated_at = now()
  where j.id = v_job.id;

  insert into public.incident_actions(
    incident_id,
    action_type,
    action_note,
    metadata,
    actor_user_id,
    actor_role
  )
  values (
    v_incident.id,
    'notification_sent',
    'Incident notification job succeeded',
    jsonb_build_object(
      'job_id', v_job.id,
      'channel', v_job.channel,
      'delivery_mode', v_job.delivery_mode,
      'provider', v_job.provider,
      'destination', v_job.destination,
      'response_payload', v_response_payload
    ),
    null,
    'service_role'
  )
  returning id into v_action_id;

  insert into public.event_outbox(event_type, aggregate_type, aggregate_id, payload)
  values (
    'incident.notification_delivered',
    'security_incident',
    v_incident.id,
    jsonb_build_object(
      'incident_id', v_incident.id,
      'action_id', v_action_id,
      'job_id', v_job.id,
      'channel', v_job.channel,
      'delivery_mode', v_job.delivery_mode,
      'provider', v_job.provider
    )
  );

  perform public.append_audit_log(
    'incident.notification_delivered',
    'incident_notification_jobs',
    v_job.id,
    'Incident notification job completed',
    jsonb_build_object(
      'incident_id', v_incident.id,
      'action_id', v_action_id,
      'channel', v_job.channel,
      'delivery_mode', v_job.delivery_mode,
      'provider', v_job.provider
    )
  );

  return v_incident.id;
end;
$$;

create or replace function public.fail_incident_notification_job(
  p_job_id uuid,
  p_error text,
  p_retry_delay_seconds integer default 900,
  p_max_retries integer default 5
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.incident_notification_jobs%rowtype;
  v_incident public.security_incidents%rowtype;
  v_error text := coalesce(nullif(btrim(p_error), ''), 'Unknown incident notification error');
  v_retry_delay integer := greatest(60, least(coalesce(p_retry_delay_seconds, 900), 86400));
  v_max_retries integer := greatest(1, least(coalesce(p_max_retries, 5), 20));
  v_attempt_count integer;
  v_next_retry_at timestamptz;
  v_final_failure boolean := false;
  v_action_id uuid;
begin
  if not public.is_service_role() then
    raise exception 'Service role required';
  end if;

  select *
  into v_job
  from public.incident_notification_jobs j
  where j.id = p_job_id
  for update;

  if v_job.id is null then
    raise exception 'Incident notification job not found';
  end if;

  select *
  into v_incident
  from public.security_incidents si
  where si.id = v_job.incident_id
  for update;

  if v_incident.id is null then
    raise exception 'Security incident not found for notification job';
  end if;

  v_attempt_count := coalesce(v_job.attempt_count, 0) + 1;
  v_final_failure := v_attempt_count >= v_max_retries;

  if v_final_failure then
    update public.incident_notification_jobs j
    set
      status = 'failed',
      attempt_count = v_attempt_count,
      last_error = v_error,
      next_attempt_at = null,
      finished_at = now(),
      updated_at = now()
    where j.id = v_job.id;

    insert into public.incident_actions(
      incident_id,
      action_type,
      action_note,
      metadata,
      actor_user_id,
      actor_role
    )
    values (
      v_incident.id,
      'notification_failed',
      'Incident notification failed after max retries',
      jsonb_build_object(
        'job_id', v_job.id,
        'channel', v_job.channel,
        'delivery_mode', v_job.delivery_mode,
        'attempt_count', v_attempt_count,
        'max_retries', v_max_retries,
        'error', v_error,
        'final_failure', true
      ),
      null,
      'service_role'
    )
    returning id into v_action_id;

    insert into public.event_outbox(event_type, aggregate_type, aggregate_id, payload)
    values (
      'incident.notification_failed',
      'security_incident',
      v_incident.id,
      jsonb_build_object(
        'incident_id', v_incident.id,
        'action_id', v_action_id,
        'job_id', v_job.id,
        'channel', v_job.channel,
        'delivery_mode', v_job.delivery_mode,
        'attempt_count', v_attempt_count,
        'max_retries', v_max_retries,
        'error', v_error,
        'final_failure', true
      )
    );

    perform public.append_audit_log(
      'incident.notification_failed',
      'incident_notification_jobs',
      v_job.id,
      'Incident notification failed after max retries',
      jsonb_build_object(
        'incident_id', v_incident.id,
        'action_id', v_action_id,
        'channel', v_job.channel,
        'delivery_mode', v_job.delivery_mode,
        'attempt_count', v_attempt_count,
        'max_retries', v_max_retries,
        'error', v_error,
        'final_failure', true
      )
    );

    return jsonb_build_object(
      'status', 'failed',
      'attemptCount', v_attempt_count,
      'finalFailure', true
    );
  end if;

  v_next_retry_at := now() + make_interval(secs => v_retry_delay);

  update public.incident_notification_jobs j
  set
    status = 'retry_scheduled',
    attempt_count = v_attempt_count,
    last_error = v_error,
    next_attempt_at = v_next_retry_at,
    updated_at = now()
  where j.id = v_job.id;

  return jsonb_build_object(
    'status', 'retry_scheduled',
    'attemptCount', v_attempt_count,
    'nextRetryAt', v_next_retry_at,
    'finalFailure', false
  );
end;
$$;

alter table public.security_incidents enable row level security;
alter table public.incident_actions enable row level security;
alter table public.incident_notification_jobs enable row level security;

drop policy if exists security_incidents_select_service_or_staff on public.security_incidents;
create policy security_incidents_select_service_or_staff
on public.security_incidents for select to authenticated
using (
  public.is_service_role()
  or (
    gym_id is not null
    and public.is_gym_staff(gym_id, auth.uid())
  )
);

drop policy if exists security_incidents_manage_service on public.security_incidents;
create policy security_incidents_manage_service
on public.security_incidents for all to authenticated
using (public.is_service_role())
with check (public.is_service_role());

drop policy if exists incident_actions_select_service_or_staff on public.incident_actions;
create policy incident_actions_select_service_or_staff
on public.incident_actions for select to authenticated
using (public.can_view_security_incident(incident_id, auth.uid()));

drop policy if exists incident_actions_manage_service on public.incident_actions;
create policy incident_actions_manage_service
on public.incident_actions for all to authenticated
using (public.is_service_role())
with check (public.is_service_role());

drop policy if exists incident_notification_jobs_select_service on public.incident_notification_jobs;
create policy incident_notification_jobs_select_service
on public.incident_notification_jobs for select to authenticated
using (public.is_service_role());

drop policy if exists incident_notification_jobs_manage_service on public.incident_notification_jobs;
create policy incident_notification_jobs_manage_service
on public.incident_notification_jobs for all to authenticated
using (public.is_service_role())
with check (public.is_service_role());

drop trigger if exists trg_incident_actions_immutable on public.incident_actions;
create trigger trg_incident_actions_immutable
before update or delete on public.incident_actions
for each row execute function public.reject_mutation_immutable_table();

revoke all on function public.is_incident_open_status(text) from public;
grant execute on function public.is_incident_open_status(text) to authenticated;
grant execute on function public.is_incident_open_status(text) to service_role;

revoke all on function public.compute_incident_notice_deadlines(
  timestamptz,
  boolean,
  boolean,
  integer,
  integer
) from public;
grant execute on function public.compute_incident_notice_deadlines(
  timestamptz,
  boolean,
  boolean,
  integer,
  integer
) to authenticated;
grant execute on function public.compute_incident_notice_deadlines(
  timestamptz,
  boolean,
  boolean,
  integer,
  integer
) to service_role;

revoke all on function public.can_view_security_incident(uuid, uuid) from public;
grant execute on function public.can_view_security_incident(uuid, uuid) to authenticated;
grant execute on function public.can_view_security_incident(uuid, uuid) to service_role;

revoke all on function public.create_security_incident(
  uuid,
  text,
  text,
  text,
  text,
  boolean,
  boolean,
  boolean,
  timestamptz,
  integer,
  integer,
  integer,
  integer,
  jsonb
) from public;
grant execute on function public.create_security_incident(
  uuid,
  text,
  text,
  text,
  text,
  boolean,
  boolean,
  boolean,
  timestamptz,
  integer,
  integer,
  integer,
  integer,
  jsonb
) to authenticated;
grant execute on function public.create_security_incident(
  uuid,
  text,
  text,
  text,
  text,
  boolean,
  boolean,
  boolean,
  timestamptz,
  integer,
  integer,
  integer,
  integer,
  jsonb
) to service_role;

revoke all on function public.transition_security_incident_status(
  uuid,
  text,
  text,
  jsonb
) from public;
grant execute on function public.transition_security_incident_status(
  uuid,
  text,
  text,
  jsonb
) to authenticated;
grant execute on function public.transition_security_incident_status(
  uuid,
  text,
  text,
  jsonb
) to service_role;

revoke all on function public.recompute_security_incident_deadlines(
  uuid,
  integer,
  integer,
  text
) from public;
grant execute on function public.recompute_security_incident_deadlines(
  uuid,
  integer,
  integer,
  text
) to authenticated;
grant execute on function public.recompute_security_incident_deadlines(
  uuid,
  integer,
  integer,
  text
) to service_role;

revoke all on function public.admin_list_security_incidents(uuid, integer, text) from public;
grant execute on function public.admin_list_security_incidents(uuid, integer, text) to authenticated;
grant execute on function public.admin_list_security_incidents(uuid, integer, text) to service_role;

revoke all on function public.queue_incident_escalation_notifications(
  uuid,
  text,
  text[],
  text,
  text,
  jsonb,
  boolean,
  text
) from public;
grant execute on function public.queue_incident_escalation_notifications(
  uuid,
  text,
  text[],
  text,
  text,
  jsonb,
  boolean,
  text
) to authenticated;
grant execute on function public.queue_incident_escalation_notifications(
  uuid,
  text,
  text[],
  text,
  text,
  jsonb,
  boolean,
  text
) to service_role;

revoke all on function public.claim_incident_notification_jobs(integer) from public;
grant execute on function public.claim_incident_notification_jobs(integer) to service_role;

revoke all on function public.complete_incident_notification_job(uuid, jsonb) from public;
grant execute on function public.complete_incident_notification_job(uuid, jsonb) to service_role;

revoke all on function public.fail_incident_notification_job(
  uuid,
  text,
  integer,
  integer
) from public;
grant execute on function public.fail_incident_notification_job(
  uuid,
  text,
  integer,
  integer
) to service_role;

-- === original: 202602190413_krux_beta_part4_s072.sql ===
create table if not exists public.legal_copy_keys (
  copy_key text primary key check (copy_key ~ '^[a-z0-9._-]+$'),
  default_text text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.legal_copy_translations (
  id uuid primary key default gen_random_uuid(),
  copy_key text not null references public.legal_copy_keys(copy_key) on delete cascade,
  locale text not null,
  translated_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(copy_key, locale),
  check (locale ~ '^[a-z]{2}(-[A-Z]{2})?$')
);

create index if not exists idx_legal_copy_translations_locale
  on public.legal_copy_translations(locale, copy_key);

drop trigger if exists trg_legal_copy_keys_set_updated_at on public.legal_copy_keys;
create trigger trg_legal_copy_keys_set_updated_at
before update on public.legal_copy_keys
for each row execute function public.set_updated_at();

drop trigger if exists trg_legal_copy_translations_set_updated_at on public.legal_copy_translations;
create trigger trg_legal_copy_translations_set_updated_at
before update on public.legal_copy_translations
for each row execute function public.set_updated_at();

create or replace function public.normalize_legal_locale(
  p_locale text default null
)
returns text
language plpgsql
immutable
as $$
declare
  v_raw text := replace(coalesce(nullif(btrim(p_locale), ''), 'en-US'), '_', '-');
  v_lang text := lower(split_part(v_raw, '-', 1));
  v_region text := upper(nullif(split_part(v_raw, '-', 2), ''));
  v_candidate text;
begin
  if v_lang = '' then
    return 'en-US';
  end if;

  if v_region is not null then
    v_candidate := v_lang || '-' || v_region;
    if v_candidate in ('en-US', 'it-IT', 'fr-FR', 'de-DE', 'es-ES') then
      return v_candidate;
    end if;
  end if;

  case v_lang
    when 'en' then return 'en-US';
    when 'it' then return 'it-IT';
    when 'fr' then return 'fr-FR';
    when 'de' then return 'de-DE';
    when 'es' then return 'es-ES';
    else return 'en-US';
  end case;
end;
$$;

create or replace function public.legal_locale_fallback_chain(
  p_locale text default null
)
returns text[]
language plpgsql
immutable
as $$
declare
  v_primary text := public.normalize_legal_locale(p_locale);
begin
  if v_primary = 'en-US' then
    return array['en-US'];
  end if;

  return array[v_primary, 'en-US'];
end;
$$;

create or replace function public.resolve_legal_copy(
  p_copy_key text,
  p_locale text default null
)
returns table (
  copy_key text,
  requested_locale text,
  resolved_locale text,
  localized_text text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_copy_key text := nullif(btrim(p_copy_key), '');
  v_requested_locale text := public.normalize_legal_locale(p_locale);
  v_fallback_chain text[] := public.legal_locale_fallback_chain(p_locale);
  v_default_text text;
  v_translation record;
begin
  if v_copy_key is null then
    raise exception 'Legal copy key is required';
  end if;

  select k.default_text
  into v_default_text
  from public.legal_copy_keys k
  where k.copy_key = v_copy_key;

  if v_default_text is null then
    raise exception 'Unknown legal copy key: %', v_copy_key;
  end if;

  select
    t.locale,
    t.translated_text
  into v_translation
  from public.legal_copy_translations t
  where t.copy_key = v_copy_key
    and t.locale = any(v_fallback_chain)
  order by array_position(v_fallback_chain, t.locale)
  limit 1;

  copy_key := v_copy_key;
  requested_locale := v_requested_locale;
  resolved_locale := coalesce(v_translation.locale, 'en-US');
  localized_text := coalesce(v_translation.translated_text, v_default_text);

  return next;
end;
$$;

create or replace function public.list_legal_copy_bundle(
  p_locale text default null,
  p_prefix text default null
)
returns table (
  copy_key text,
  requested_locale text,
  resolved_locale text,
  localized_text text,
  fallback_rank integer
)
language sql
security definer
set search_path = public
as $$
  with locale_ctx as (
    select
      public.normalize_legal_locale(p_locale) as requested_locale,
      public.legal_locale_fallback_chain(p_locale) as fallback_chain
  ),
  filtered_keys as (
    select
      k.copy_key,
      k.default_text
    from public.legal_copy_keys k
    where p_prefix is null
      or k.copy_key like p_prefix || '%'
  )
  select
    fk.copy_key,
    lc.requested_locale,
    coalesce(tr.locale, 'en-US') as resolved_locale,
    coalesce(tr.translated_text, fk.default_text) as localized_text,
    coalesce(array_position(lc.fallback_chain, tr.locale), cardinality(lc.fallback_chain) + 1) as fallback_rank
  from filtered_keys fk
  cross join locale_ctx lc
  left join lateral (
    select
      t.locale,
      t.translated_text
    from public.legal_copy_translations t
    where t.copy_key = fk.copy_key
      and t.locale = any(lc.fallback_chain)
    order by array_position(lc.fallback_chain, t.locale)
    limit 1
  ) tr on true
  order by fk.copy_key asc;
$$;

alter table public.legal_copy_keys enable row level security;
alter table public.legal_copy_translations enable row level security;

drop policy if exists legal_copy_keys_select_authenticated on public.legal_copy_keys;
create policy legal_copy_keys_select_authenticated
on public.legal_copy_keys for select to authenticated
using (true);

drop policy if exists legal_copy_keys_manage_service on public.legal_copy_keys;
create policy legal_copy_keys_manage_service
on public.legal_copy_keys for all to authenticated
using (public.is_service_role())
with check (public.is_service_role());

drop policy if exists legal_copy_translations_select_authenticated on public.legal_copy_translations;
create policy legal_copy_translations_select_authenticated
on public.legal_copy_translations for select to authenticated
using (true);

drop policy if exists legal_copy_translations_manage_service on public.legal_copy_translations;
create policy legal_copy_translations_manage_service
on public.legal_copy_translations for all to authenticated
using (public.is_service_role())
with check (public.is_service_role());

insert into public.legal_copy_keys(copy_key, default_text, description)
values
  ('legal.flow.phase2.authenticate_user', 'Authenticate user', 'Phase 2 onboarding checklist item'),
  ('legal.flow.phase2.ensure_profile_exists', 'Ensure profile exists', 'Phase 2 onboarding checklist item'),
  ('legal.flow.phase2.capture_baseline_consents', 'Capture baseline consents', 'Phase 2 onboarding checklist item'),
  ('legal.flow.phase2.create_or_join_gym', 'Create or join gym', 'Phase 2 onboarding checklist item'),
  ('legal.flow.phase2.set_home_gym', 'Set home gym', 'Phase 2 onboarding checklist item'),
  ('legal.flow.phase2.load_guild_snapshot', 'Load guild hall snapshot', 'Phase 2 onboarding checklist item'),
  ('legal.flow.phase3.validate_workout_payload', 'Validate workout payload', 'Phase 3 checklist item'),
  ('legal.flow.phase3.validate_required_consents', 'Validate required legal consents', 'Phase 3 checklist item'),
  ('legal.flow.phase3.call_log_workout_atomic', 'Call log_workout_atomic RPC', 'Phase 3 checklist item'),
  ('legal.flow.phase3.confirm_proof_feed_event', 'Confirm proof feed event', 'Phase 3 checklist item'),
  ('legal.flow.phase3.confirm_progress_update', 'Confirm XP/rank/chain progress update', 'Phase 3 checklist item'),
  ('legal.flow.phase8.submit_requests', 'Submit access/export/delete requests from profile settings', 'Phase 8 privacy checklist item'),
  ('legal.flow.phase8.load_request_timeline', 'Load request timeline with status and due date', 'Phase 8 privacy checklist item'),
  ('legal.flow.phase8.load_export_receipts', 'Load downloadable export receipts with expiring links', 'Phase 8 privacy checklist item'),
  ('legal.flow.phase8.highlight_overdue_requests', 'Highlight overdue open requests for support follow-up', 'Phase 8 privacy checklist item'),
  ('legal.flow.admin.phase8.load_open_requests', 'Load open privacy requests for gym members', 'Phase 8 admin checklist item'),
  ('legal.flow.admin.phase8.highlight_overdue', 'Highlight overdue and SLA-breached requests', 'Phase 8 admin checklist item'),
  ('legal.flow.admin.phase8.transition_status_notes', 'Transition request status with auditable notes', 'Phase 8 admin checklist item'),
  ('legal.error.reconsent_required_action', 'Legal re-consent is required before this action can continue.', 'Legal error copy'),
  ('legal.error.reconsent_required_workout', 'Legal re-consent is required before workout logging can continue.', 'Legal error copy'),
  ('legal.error.policy_baseline_missing', 'Missing active baseline policies for terms, privacy, or health data processing.', 'Policy baseline validation error'),
  ('legal.error.baseline_consent_required', 'Terms, privacy, and health-data processing consent are required to continue.', 'Baseline consent validation error'),
  ('legal.timestamp.not_available', 'Not available', 'Fallback for unavailable legal timestamp')
on conflict (copy_key)
do update set
  default_text = excluded.default_text,
  description = excluded.description,
  updated_at = now();

insert into public.legal_copy_translations(copy_key, locale, translated_text)
values
  ('legal.flow.phase2.authenticate_user', 'it-IT', 'Autentica utente'),
  ('legal.flow.phase2.ensure_profile_exists', 'it-IT', 'Verifica che il profilo esista'),
  ('legal.flow.phase2.capture_baseline_consents', 'it-IT', 'Acquisisci i consensi di base'),
  ('legal.flow.phase2.create_or_join_gym', 'it-IT', 'Crea o unisciti a una palestra'),
  ('legal.flow.phase2.set_home_gym', 'it-IT', 'Imposta palestra principale'),
  ('legal.flow.phase2.load_guild_snapshot', 'it-IT', 'Carica snapshot della gilda'),
  ('legal.flow.phase3.validate_workout_payload', 'it-IT', 'Valida il payload del workout'),
  ('legal.flow.phase3.validate_required_consents', 'it-IT', 'Valida i consensi legali richiesti'),
  ('legal.flow.phase3.call_log_workout_atomic', 'it-IT', 'Chiama RPC log_workout_atomic'),
  ('legal.flow.phase3.confirm_proof_feed_event', 'it-IT', 'Conferma evento nel Proof Feed'),
  ('legal.flow.phase3.confirm_progress_update', 'it-IT', 'Conferma aggiornamento XP/rank/chain'),
  ('legal.flow.phase8.submit_requests', 'it-IT', 'Invia richieste access/export/delete dalle impostazioni profilo'),
  ('legal.flow.phase8.load_request_timeline', 'it-IT', 'Carica timeline richieste con stato e scadenza'),
  ('legal.flow.phase8.load_export_receipts', 'it-IT', 'Carica ricevute export scaricabili con link in scadenza'),
  ('legal.flow.phase8.highlight_overdue_requests', 'it-IT', 'Evidenzia richieste aperte scadute per follow-up supporto'),
  ('legal.flow.admin.phase8.load_open_requests', 'it-IT', 'Carica richieste privacy aperte dei membri palestra'),
  ('legal.flow.admin.phase8.highlight_overdue', 'it-IT', 'Evidenzia richieste scadute e con SLA violata'),
  ('legal.flow.admin.phase8.transition_status_notes', 'it-IT', 'Transiziona stato richiesta con note verificabili'),
  ('legal.error.reconsent_required_action', 'it-IT', 'È richiesto un nuovo consenso legale prima di continuare questa azione.'),
  ('legal.error.reconsent_required_workout', 'it-IT', 'È richiesto un nuovo consenso legale prima di registrare il workout.'),
  ('legal.error.policy_baseline_missing', 'it-IT', 'Mancano policy baseline attive per termini, privacy o trattamento dati salute.'),
  ('legal.error.baseline_consent_required', 'it-IT', 'Per continuare sono richiesti i consensi a termini, privacy e dati salute.'),
  ('legal.timestamp.not_available', 'it-IT', 'Non disponibile')
on conflict (copy_key, locale)
do update set
  translated_text = excluded.translated_text,
  updated_at = now();

revoke all on function public.normalize_legal_locale(text) from public;
grant execute on function public.normalize_legal_locale(text) to authenticated;
grant execute on function public.normalize_legal_locale(text) to service_role;

revoke all on function public.legal_locale_fallback_chain(text) from public;
grant execute on function public.legal_locale_fallback_chain(text) to authenticated;
grant execute on function public.legal_locale_fallback_chain(text) to service_role;

revoke all on function public.resolve_legal_copy(text, text) from public;
grant execute on function public.resolve_legal_copy(text, text) to authenticated;
grant execute on function public.resolve_legal_copy(text, text) to service_role;

revoke all on function public.list_legal_copy_bundle(text, text) from public;
grant execute on function public.list_legal_copy_bundle(text, text) to authenticated;
grant execute on function public.list_legal_copy_bundle(text, text) to service_role;

-- === original: 202602190414_krux_beta_part4_s073.sql ===
create or replace function public.admin_get_privacy_ops_metrics(
  p_gym_id uuid,
  p_window_days integer default 30
)
returns table (
  gym_id uuid,
  open_requests integer,
  overdue_requests integer,
  avg_completion_hours numeric(10,2),
  fulfilled_requests_window integer,
  rejected_requests_window integer,
  measured_window_days integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_days integer := greatest(1, least(coalesce(p_window_days, 30), 365));
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_gym_staff(p_gym_id, auth.uid()) then
    raise exception 'Gym staff access is required';
  end if;

  return query
  with gym_requests as (
    select
      pr.status,
      pr.submitted_at,
      pr.resolved_at,
      pr.due_at,
      pr.sla_breached_at
    from public.privacy_requests pr
    where exists (
      select 1
      from public.gym_memberships gm
      where gm.gym_id = p_gym_id
        and gm.user_id = pr.user_id
    )
  ),
  open_queue as (
    select
      count(*)::integer as open_requests,
      count(*) filter (
        where (gr.due_at is not null and gr.due_at < now())
          or gr.sla_breached_at is not null
      )::integer as overdue_requests
    from gym_requests gr
    where public.is_privacy_request_open_status(gr.status)
  ),
  completion_window as (
    select
      count(*) filter (where gr.status = 'fulfilled')::integer as fulfilled_requests_window,
      count(*) filter (where gr.status = 'rejected')::integer as rejected_requests_window,
      avg(extract(epoch from (gr.resolved_at - gr.submitted_at)) / 3600.0)
        filter (
          where gr.status in ('fulfilled', 'rejected')
            and gr.resolved_at is not null
            and gr.resolved_at >= gr.submitted_at
        ) as avg_completion_hours
    from gym_requests gr
    where gr.status in ('fulfilled', 'rejected')
      and gr.submitted_at >= now() - make_interval(days => v_window_days)
  )
  select
    p_gym_id,
    coalesce(oq.open_requests, 0),
    coalesce(oq.overdue_requests, 0),
    round(coalesce(cw.avg_completion_hours, 0)::numeric, 2),
    coalesce(cw.fulfilled_requests_window, 0),
    coalesce(cw.rejected_requests_window, 0),
    v_window_days
  from open_queue oq
  cross join completion_window cw;
end;
$$;

revoke all on function public.admin_get_privacy_ops_metrics(uuid, integer) from public;
grant execute on function public.admin_get_privacy_ops_metrics(uuid, integer) to authenticated;
grant execute on function public.admin_get_privacy_ops_metrics(uuid, integer) to service_role;

insert into public.legal_copy_keys(copy_key, default_text, description)
values
  ('legal.flow.admin.phase8.load_queue_filters', 'Apply queue filters (status/type/SLA/user)', 'Phase 8 admin checklist item'),
  ('legal.flow.admin.phase8.show_sla_badges', 'Render SLA badges (breached/at risk/on track)', 'Phase 8 admin checklist item'),
  ('legal.flow.admin.phase8.load_policy_versions', 'Load active policy versions and effective dates', 'Phase 8 admin checklist item'),
  ('legal.flow.admin.phase8.load_privacy_metrics', 'Load privacy ops metrics (open, overdue, avg completion)', 'Phase 8 admin checklist item'),
  ('legal.flow.admin.phase8.open_runbook', 'Open compliance runbook mapped to queue actions', 'Phase 8 admin checklist item')
on conflict (copy_key)
do update set
  default_text = excluded.default_text,
  description = excluded.description,
  updated_at = now();

insert into public.legal_copy_translations(copy_key, locale, translated_text)
values
  ('legal.flow.admin.phase8.load_queue_filters', 'it-IT', 'Applica filtri coda (stato/tipo/SLA/utente)'),
  ('legal.flow.admin.phase8.show_sla_badges', 'it-IT', 'Mostra badge SLA (violata/a rischio/in linea)'),
  ('legal.flow.admin.phase8.load_policy_versions', 'it-IT', 'Carica versioni policy attive e date di efficacia'),
  ('legal.flow.admin.phase8.load_privacy_metrics', 'it-IT', 'Carica metriche privacy ops (aperte/scadute/tempo medio)'),
  ('legal.flow.admin.phase8.open_runbook', 'it-IT', 'Apri runbook compliance collegato alle azioni coda')
on conflict (copy_key, locale)
do update set
  translated_text = excluded.translated_text,
  updated_at = now();

-- === original: 202602200001_krux_beta_part5_s001_customization_support.sql ===
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

-- === original: 202602200002_krux_beta_part5_s002_monetization_experiments.sql ===
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

-- === original: 202602200003_krux_beta_part5_s003_platform_billing.sql ===
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

-- === original: 202602200004_krux_beta_part5_s004_gym_ops_rbac_workforce.sql ===
-- KRUXT beta part 5 (s004)
-- Gym operations extension:
-- 1) Granular gym permissions (role matrix + per-user overrides)
-- 2) Staff shifts and worked-hours tracking foundations
-- 3) Gym CRM leads + daily analytics snapshots for decision dashboards

-- =====================================================
-- ENUMS
-- =====================================================

do $$ begin
  create type public.staff_shift_status as enum (
    'scheduled',
    'confirmed',
    'in_progress',
    'completed',
    'missed',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.staff_time_entry_status as enum ('open', 'submitted', 'approved', 'rejected');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.crm_lead_status as enum (
    'new',
    'contacted',
    'qualified',
    'trial_scheduled',
    'trial_completed',
    'won',
    'lost'
  );
exception
  when duplicate_object then null;
end $$;

-- =====================================================
-- RBAC TABLES
-- =====================================================

create table if not exists public.gym_permission_catalog (
  permission_key text primary key,
  category text not null,
  label text not null,
  description text,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (permission_key = lower(permission_key))
);

create table if not exists public.gym_role_permissions (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  role public.gym_role not null,
  permission_key text not null references public.gym_permission_catalog(permission_key) on delete cascade,
  is_allowed boolean not null default false,
  updated_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(gym_id, role, permission_key)
);

create table if not exists public.gym_user_permission_overrides (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  permission_key text not null references public.gym_permission_catalog(permission_key) on delete cascade,
  is_allowed boolean not null,
  reason text,
  updated_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(gym_id, user_id, permission_key)
);

-- =====================================================
-- WORKFORCE + ANALYTICS + CRM TABLES
-- =====================================================

create table if not exists public.staff_shifts (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  staff_user_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  title text not null default 'Shift',
  shift_role text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.staff_shift_status not null default 'scheduled',
  hourly_rate_cents integer check (hourly_rate_cents is null or hourly_rate_cents >= 0),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.staff_time_entries (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid references public.staff_shifts(id) on delete set null,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  staff_user_id uuid not null references public.profiles(id) on delete cascade,
  clock_in_at timestamptz not null,
  clock_out_at timestamptz,
  break_minutes integer not null default 0 check (break_minutes >= 0),
  worked_minutes integer generated always as (
    case
      when clock_out_at is null then null
      else greatest(0, floor(extract(epoch from (clock_out_at - clock_in_at)) / 60)::integer - break_minutes)
    end
  ) stored,
  status public.staff_time_entry_status not null default 'open',
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  source_channel text not null default 'admin_web',
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (clock_out_at is null or clock_out_at > clock_in_at)
);

create table if not exists public.gym_kpi_daily_snapshots (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  metric_date date not null,
  active_members integer not null default 0 check (active_members >= 0),
  new_memberships integer not null default 0 check (new_memberships >= 0),
  cancelled_memberships integer not null default 0 check (cancelled_memberships >= 0),
  checkins_count integer not null default 0 check (checkins_count >= 0),
  class_bookings_count integer not null default 0 check (class_bookings_count >= 0),
  class_attendance_count integer not null default 0 check (class_attendance_count >= 0),
  waitlist_promotions_count integer not null default 0 check (waitlist_promotions_count >= 0),
  revenue_cents integer not null default 0 check (revenue_cents >= 0),
  mrr_cents integer not null default 0 check (mrr_cents >= 0),
  average_class_fill_rate numeric(5,2) check (average_class_fill_rate is null or (average_class_fill_rate >= 0 and average_class_fill_rate <= 100)),
  average_chain_days numeric(6,2) check (average_chain_days is null or average_chain_days >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(gym_id, metric_date)
);

create table if not exists public.gym_crm_leads (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  owner_user_id uuid references public.profiles(id) on delete set null,
  full_name text not null,
  email text,
  phone text,
  source text not null default 'walk_in',
  status public.crm_lead_status not null default 'new',
  interested_services text[] not null default '{}'::text[],
  tags text[] not null default '{}'::text[],
  trial_starts_at timestamptz,
  trial_ends_at timestamptz,
  converted_membership_id uuid references public.gym_memberships(id) on delete set null,
  last_contacted_at timestamptz,
  next_follow_up_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gym_crm_lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.gym_crm_leads(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  activity_type text not null
    check (activity_type in (
      'note',
      'call',
      'email',
      'sms',
      'meeting',
      'trial_booked',
      'trial_completed',
      'status_change',
      'conversion'
    )),
  activity_at timestamptz not null default now(),
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- =====================================================
-- INDEXES
-- =====================================================

create index if not exists idx_gym_role_permissions_gym_role
  on public.gym_role_permissions(gym_id, role);
create index if not exists idx_gym_user_permission_overrides_gym_user
  on public.gym_user_permission_overrides(gym_id, user_id);
create index if not exists idx_staff_shifts_gym_time
  on public.staff_shifts(gym_id, starts_at desc);
create index if not exists idx_staff_shifts_user_time
  on public.staff_shifts(staff_user_id, starts_at desc);
create index if not exists idx_staff_time_entries_gym_time
  on public.staff_time_entries(gym_id, clock_in_at desc);
create index if not exists idx_staff_time_entries_user_time
  on public.staff_time_entries(staff_user_id, clock_in_at desc);
create index if not exists idx_gym_kpi_daily_snapshots_gym_date
  on public.gym_kpi_daily_snapshots(gym_id, metric_date desc);
create index if not exists idx_gym_crm_leads_gym_status_followup
  on public.gym_crm_leads(gym_id, status, next_follow_up_at);
create index if not exists idx_gym_crm_lead_activities_lead_time
  on public.gym_crm_lead_activities(lead_id, activity_at desc);

-- =====================================================
-- UPDATED_AT TRIGGERS
-- =====================================================

drop trigger if exists trg_gym_permission_catalog_set_updated_at on public.gym_permission_catalog;
create trigger trg_gym_permission_catalog_set_updated_at
before update on public.gym_permission_catalog
for each row execute function public.set_updated_at();

drop trigger if exists trg_gym_role_permissions_set_updated_at on public.gym_role_permissions;
create trigger trg_gym_role_permissions_set_updated_at
before update on public.gym_role_permissions
for each row execute function public.set_updated_at();

drop trigger if exists trg_gym_user_permission_overrides_set_updated_at on public.gym_user_permission_overrides;
create trigger trg_gym_user_permission_overrides_set_updated_at
before update on public.gym_user_permission_overrides
for each row execute function public.set_updated_at();

drop trigger if exists trg_staff_shifts_set_updated_at on public.staff_shifts;
create trigger trg_staff_shifts_set_updated_at
before update on public.staff_shifts
for each row execute function public.set_updated_at();

drop trigger if exists trg_staff_time_entries_set_updated_at on public.staff_time_entries;
create trigger trg_staff_time_entries_set_updated_at
before update on public.staff_time_entries
for each row execute function public.set_updated_at();

drop trigger if exists trg_gym_kpi_daily_snapshots_set_updated_at on public.gym_kpi_daily_snapshots;
create trigger trg_gym_kpi_daily_snapshots_set_updated_at
before update on public.gym_kpi_daily_snapshots
for each row execute function public.set_updated_at();

drop trigger if exists trg_gym_crm_leads_set_updated_at on public.gym_crm_leads;
create trigger trg_gym_crm_leads_set_updated_at
before update on public.gym_crm_leads
for each row execute function public.set_updated_at();

-- =====================================================
-- VALIDATION HELPERS
-- =====================================================

create or replace function public.validate_staff_shift_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.gym_memberships gm
    where gm.gym_id = new.gym_id
      and gm.user_id = new.staff_user_id
      and gm.membership_status in ('trial', 'active')
      and gm.role in ('leader', 'officer', 'coach')
  ) then
    raise exception 'staff_user_id must be active gym staff for this gym';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_staff_shifts_validate_staff on public.staff_shifts;
create trigger trg_staff_shifts_validate_staff
before insert or update on public.staff_shifts
for each row execute function public.validate_staff_shift_assignment();

create or replace function public.validate_staff_time_entry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shift record;
begin
  if not exists (
    select 1
    from public.gym_memberships gm
    where gm.gym_id = new.gym_id
      and gm.user_id = new.staff_user_id
      and gm.membership_status in ('trial', 'active')
      and gm.role in ('leader', 'officer', 'coach')
  ) then
    raise exception 'staff_user_id must be active gym staff for this gym';
  end if;

  if new.shift_id is not null then
    select s.gym_id, s.staff_user_id
    into v_shift
    from public.staff_shifts s
    where s.id = new.shift_id;

    if not found then
      raise exception 'shift_id is invalid';
    end if;

    if v_shift.gym_id <> new.gym_id then
      raise exception 'shift_id gym does not match gym_id';
    end if;

    if v_shift.staff_user_id <> new.staff_user_id then
      raise exception 'shift_id staff does not match staff_user_id';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_staff_time_entries_validate on public.staff_time_entries;
create trigger trg_staff_time_entries_validate
before insert or update on public.staff_time_entries
for each row execute function public.validate_staff_time_entry();

-- =====================================================
-- PERMISSION MODEL HELPERS
-- =====================================================

insert into public.gym_permission_catalog (permission_key, category, label, description)
values
  ('admin.members.manage', 'admin', 'Manage Members', 'Approve memberships and update member status.'),
  ('admin.roles.manage', 'admin', 'Manage Roles', 'Assign and revoke gym staff/member roles.'),
  ('gym.brand.manage', 'settings', 'Manage Branding', 'Edit gym logos, colors, and brand settings.'),
  ('gym.features.manage', 'settings', 'Manage Feature Flags', 'Enable/disable gym modules and rollout percentages.'),
  ('ops.classes.manage', 'ops', 'Manage Classes', 'Create/update classes and schedules.'),
  ('ops.waitlist.manage', 'ops', 'Manage Waitlist', 'Promote and reorder class waitlist entries.'),
  ('ops.checkins.manage', 'ops', 'Manage Check-ins', 'Record and override access/check-in events.'),
  ('ops.waivers.manage', 'ops', 'Manage Waivers/Contracts', 'Publish and maintain legal acceptance documents.'),
  ('programs.manage', 'ops', 'Manage Programs', 'Maintain PT programs and athlete plans.'),
  ('staff.shifts.manage', 'staff', 'Manage Staff Shifts', 'Create and manage shift schedules.'),
  ('staff.time_entries.manage', 'staff', 'Manage Staff Time Entries', 'Approve and adjust worked-hour logs.'),
  ('analytics.view', 'analytics', 'View Analytics', 'Access gym KPIs and business dashboards.'),
  ('crm.leads.manage', 'crm', 'Manage CRM Leads', 'Track, update, and convert lead records.'),
  ('crm.members.export', 'crm', 'Export CRM Data', 'Export member and lead datasets.'),
  ('support.manage', 'support', 'Manage Support Queue', 'Handle support tickets and escalation queues.'),
  ('integrations.manage', 'integrations', 'Manage Integrations', 'Connect and monitor third-party providers.'),
  ('billing.view', 'billing', 'View Billing', 'View billing status, invoices, and payment telemetry.'),
  ('billing.manage', 'billing', 'Manage Billing', 'Edit billing providers and charging settings.'),
  ('compliance.manage', 'compliance', 'Manage Compliance', 'Operate privacy/compliance workflows.')
on conflict (permission_key) do update
set
  category = excluded.category,
  label = excluded.label,
  description = excluded.description,
  is_active = true,
  updated_at = now();

create or replace function public.seed_default_gym_permissions(_gym_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.gym_role_permissions (gym_id, role, permission_key, is_allowed)
  select
    _gym_id,
    d.role,
    d.permission_key,
    d.is_allowed
  from (
    values
      ('leader'::public.gym_role, 'admin.members.manage', true),
      ('leader'::public.gym_role, 'admin.roles.manage', true),
      ('leader'::public.gym_role, 'gym.brand.manage', true),
      ('leader'::public.gym_role, 'gym.features.manage', true),
      ('leader'::public.gym_role, 'ops.classes.manage', true),
      ('leader'::public.gym_role, 'ops.waitlist.manage', true),
      ('leader'::public.gym_role, 'ops.checkins.manage', true),
      ('leader'::public.gym_role, 'ops.waivers.manage', true),
      ('leader'::public.gym_role, 'programs.manage', true),
      ('leader'::public.gym_role, 'staff.shifts.manage', true),
      ('leader'::public.gym_role, 'staff.time_entries.manage', true),
      ('leader'::public.gym_role, 'analytics.view', true),
      ('leader'::public.gym_role, 'crm.leads.manage', true),
      ('leader'::public.gym_role, 'crm.members.export', true),
      ('leader'::public.gym_role, 'support.manage', true),
      ('leader'::public.gym_role, 'integrations.manage', true),
      ('leader'::public.gym_role, 'billing.view', true),
      ('leader'::public.gym_role, 'billing.manage', true),
      ('leader'::public.gym_role, 'compliance.manage', true),
      ('officer'::public.gym_role, 'admin.members.manage', true),
      ('officer'::public.gym_role, 'admin.roles.manage', true),
      ('officer'::public.gym_role, 'gym.brand.manage', true),
      ('officer'::public.gym_role, 'gym.features.manage', true),
      ('officer'::public.gym_role, 'ops.classes.manage', true),
      ('officer'::public.gym_role, 'ops.waitlist.manage', true),
      ('officer'::public.gym_role, 'ops.checkins.manage', true),
      ('officer'::public.gym_role, 'ops.waivers.manage', true),
      ('officer'::public.gym_role, 'programs.manage', true),
      ('officer'::public.gym_role, 'staff.shifts.manage', true),
      ('officer'::public.gym_role, 'staff.time_entries.manage', true),
      ('officer'::public.gym_role, 'analytics.view', true),
      ('officer'::public.gym_role, 'crm.leads.manage', true),
      ('officer'::public.gym_role, 'crm.members.export', true),
      ('officer'::public.gym_role, 'support.manage', true),
      ('officer'::public.gym_role, 'integrations.manage', true),
      ('officer'::public.gym_role, 'billing.view', true),
      ('officer'::public.gym_role, 'billing.manage', false),
      ('officer'::public.gym_role, 'compliance.manage', true),
      ('coach'::public.gym_role, 'admin.members.manage', false),
      ('coach'::public.gym_role, 'admin.roles.manage', false),
      ('coach'::public.gym_role, 'gym.brand.manage', false),
      ('coach'::public.gym_role, 'gym.features.manage', false),
      ('coach'::public.gym_role, 'ops.classes.manage', true),
      ('coach'::public.gym_role, 'ops.waitlist.manage', true),
      ('coach'::public.gym_role, 'ops.checkins.manage', true),
      ('coach'::public.gym_role, 'ops.waivers.manage', false),
      ('coach'::public.gym_role, 'programs.manage', true),
      ('coach'::public.gym_role, 'staff.shifts.manage', false),
      ('coach'::public.gym_role, 'staff.time_entries.manage', false),
      ('coach'::public.gym_role, 'analytics.view', true),
      ('coach'::public.gym_role, 'crm.leads.manage', false),
      ('coach'::public.gym_role, 'crm.members.export', false),
      ('coach'::public.gym_role, 'support.manage', false),
      ('coach'::public.gym_role, 'integrations.manage', false),
      ('coach'::public.gym_role, 'billing.view', false),
      ('coach'::public.gym_role, 'billing.manage', false),
      ('coach'::public.gym_role, 'compliance.manage', false),
      ('member'::public.gym_role, 'admin.members.manage', false),
      ('member'::public.gym_role, 'admin.roles.manage', false),
      ('member'::public.gym_role, 'gym.brand.manage', false),
      ('member'::public.gym_role, 'gym.features.manage', false),
      ('member'::public.gym_role, 'ops.classes.manage', false),
      ('member'::public.gym_role, 'ops.waitlist.manage', false),
      ('member'::public.gym_role, 'ops.checkins.manage', false),
      ('member'::public.gym_role, 'ops.waivers.manage', false),
      ('member'::public.gym_role, 'programs.manage', false),
      ('member'::public.gym_role, 'staff.shifts.manage', false),
      ('member'::public.gym_role, 'staff.time_entries.manage', false),
      ('member'::public.gym_role, 'analytics.view', false),
      ('member'::public.gym_role, 'crm.leads.manage', false),
      ('member'::public.gym_role, 'crm.members.export', false),
      ('member'::public.gym_role, 'support.manage', false),
      ('member'::public.gym_role, 'integrations.manage', false),
      ('member'::public.gym_role, 'billing.view', false),
      ('member'::public.gym_role, 'billing.manage', false),
      ('member'::public.gym_role, 'compliance.manage', false)
  ) as d(role, permission_key, is_allowed)
  on conflict (gym_id, role, permission_key) do nothing;
end;
$$;

create or replace function public.seed_default_gym_permissions_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_default_gym_permissions(new.id);
  return new;
end;
$$;

drop trigger if exists trg_gyms_seed_default_permissions on public.gyms;
create trigger trg_gyms_seed_default_permissions
after insert on public.gyms
for each row execute function public.seed_default_gym_permissions_after_insert();

select public.seed_default_gym_permissions(g.id)
from public.gyms g;

create or replace function public.user_has_gym_permission(
  _gym_id uuid,
  _permission_key text,
  _viewer uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role public.gym_role;
  v_override boolean;
  v_role_allowed boolean;
begin
  if public.is_service_role() then
    return true;
  end if;

  if _viewer is null then
    return false;
  end if;

  if exists (
    select 1
    from public.gyms g
    where g.id = _gym_id
      and g.owner_user_id = _viewer
  ) then
    return true;
  end if;

  select gm.role
  into v_role
  from public.gym_memberships gm
  where gm.gym_id = _gym_id
    and gm.user_id = _viewer
    and gm.membership_status in ('trial', 'active')
  order by case gm.role
    when 'leader' then 1
    when 'officer' then 2
    when 'coach' then 3
    else 4
  end
  limit 1;

  if v_role is null then
    return false;
  end if;

  select guo.is_allowed
  into v_override
  from public.gym_user_permission_overrides guo
  where guo.gym_id = _gym_id
    and guo.user_id = _viewer
    and guo.permission_key = lower(_permission_key)
  limit 1;

  if v_override is not null then
    return v_override;
  end if;

  select grp.is_allowed
  into v_role_allowed
  from public.gym_role_permissions grp
  where grp.gym_id = _gym_id
    and grp.role = v_role
    and grp.permission_key = lower(_permission_key)
  limit 1;

  return coalesce(v_role_allowed, false);
end;
$$;

-- =====================================================
-- RLS
-- =====================================================

alter table public.gym_permission_catalog enable row level security;
alter table public.gym_role_permissions enable row level security;
alter table public.gym_user_permission_overrides enable row level security;
alter table public.staff_shifts enable row level security;
alter table public.staff_time_entries enable row level security;
alter table public.gym_kpi_daily_snapshots enable row level security;
alter table public.gym_crm_leads enable row level security;
alter table public.gym_crm_lead_activities enable row level security;

drop policy if exists gym_permission_catalog_select on public.gym_permission_catalog;
create policy gym_permission_catalog_select
on public.gym_permission_catalog for select to authenticated
using (is_active = true or public.is_service_role());

drop policy if exists gym_permission_catalog_manage on public.gym_permission_catalog;
create policy gym_permission_catalog_manage
on public.gym_permission_catalog for all to authenticated
using (public.is_service_role())
with check (public.is_service_role());

drop policy if exists gym_role_permissions_select on public.gym_role_permissions;
create policy gym_role_permissions_select
on public.gym_role_permissions for select to authenticated
using (
  public.is_service_role()
  or public.can_manage_gym_config(gym_id, auth.uid())
);

drop policy if exists gym_role_permissions_manage on public.gym_role_permissions;
create policy gym_role_permissions_manage
on public.gym_role_permissions for all to authenticated
using (
  public.is_service_role()
  or public.can_manage_gym_config(gym_id, auth.uid())
)
with check (
  public.is_service_role()
  or public.can_manage_gym_config(gym_id, auth.uid())
);

drop policy if exists gym_user_permission_overrides_select on public.gym_user_permission_overrides;
create policy gym_user_permission_overrides_select
on public.gym_user_permission_overrides for select to authenticated
using (
  public.is_service_role()
  or public.can_manage_gym_config(gym_id, auth.uid())
  or user_id = auth.uid()
);

drop policy if exists gym_user_permission_overrides_manage on public.gym_user_permission_overrides;
create policy gym_user_permission_overrides_manage
on public.gym_user_permission_overrides for all to authenticated
using (
  public.is_service_role()
  or public.can_manage_gym_config(gym_id, auth.uid())
)
with check (
  public.is_service_role()
  or public.can_manage_gym_config(gym_id, auth.uid())
);

drop policy if exists staff_shifts_select on public.staff_shifts;
create policy staff_shifts_select
on public.staff_shifts for select to authenticated
using (
  public.is_service_role()
  or staff_user_id = auth.uid()
  or public.user_has_gym_permission(gym_id, 'staff.shifts.manage', auth.uid())
);

drop policy if exists staff_shifts_insert on public.staff_shifts;
create policy staff_shifts_insert
on public.staff_shifts for insert to authenticated
with check (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'staff.shifts.manage', auth.uid())
);

drop policy if exists staff_shifts_update on public.staff_shifts;
create policy staff_shifts_update
on public.staff_shifts for update to authenticated
using (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'staff.shifts.manage', auth.uid())
)
with check (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'staff.shifts.manage', auth.uid())
);

drop policy if exists staff_shifts_delete on public.staff_shifts;
create policy staff_shifts_delete
on public.staff_shifts for delete to authenticated
using (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'staff.shifts.manage', auth.uid())
);

drop policy if exists staff_time_entries_select on public.staff_time_entries;
create policy staff_time_entries_select
on public.staff_time_entries for select to authenticated
using (
  public.is_service_role()
  or staff_user_id = auth.uid()
  or public.user_has_gym_permission(gym_id, 'staff.time_entries.manage', auth.uid())
);

drop policy if exists staff_time_entries_insert on public.staff_time_entries;
create policy staff_time_entries_insert
on public.staff_time_entries for insert to authenticated
with check (
  public.is_service_role()
  or staff_user_id = auth.uid()
  or public.user_has_gym_permission(gym_id, 'staff.time_entries.manage', auth.uid())
);

drop policy if exists staff_time_entries_update on public.staff_time_entries;
create policy staff_time_entries_update
on public.staff_time_entries for update to authenticated
using (
  public.is_service_role()
  or (
    staff_user_id = auth.uid()
    and status in ('open', 'submitted')
    and approved_at is null
  )
  or public.user_has_gym_permission(gym_id, 'staff.time_entries.manage', auth.uid())
)
with check (
  public.is_service_role()
  or staff_user_id = auth.uid()
  or public.user_has_gym_permission(gym_id, 'staff.time_entries.manage', auth.uid())
);

drop policy if exists staff_time_entries_delete on public.staff_time_entries;
create policy staff_time_entries_delete
on public.staff_time_entries for delete to authenticated
using (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'staff.time_entries.manage', auth.uid())
);

drop policy if exists gym_kpi_daily_snapshots_select on public.gym_kpi_daily_snapshots;
create policy gym_kpi_daily_snapshots_select
on public.gym_kpi_daily_snapshots for select to authenticated
using (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'analytics.view', auth.uid())
);

drop policy if exists gym_kpi_daily_snapshots_manage on public.gym_kpi_daily_snapshots;
create policy gym_kpi_daily_snapshots_manage
on public.gym_kpi_daily_snapshots for all to authenticated
using (public.is_service_role())
with check (public.is_service_role());

drop policy if exists gym_crm_leads_select on public.gym_crm_leads;
create policy gym_crm_leads_select
on public.gym_crm_leads for select to authenticated
using (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'crm.leads.manage', auth.uid())
);

drop policy if exists gym_crm_leads_manage on public.gym_crm_leads;
create policy gym_crm_leads_manage
on public.gym_crm_leads for all to authenticated
using (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'crm.leads.manage', auth.uid())
)
with check (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'crm.leads.manage', auth.uid())
);

drop policy if exists gym_crm_lead_activities_select on public.gym_crm_lead_activities;
create policy gym_crm_lead_activities_select
on public.gym_crm_lead_activities for select to authenticated
using (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'crm.leads.manage', auth.uid())
);

drop policy if exists gym_crm_lead_activities_manage on public.gym_crm_lead_activities;
create policy gym_crm_lead_activities_manage
on public.gym_crm_lead_activities for all to authenticated
using (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'crm.leads.manage', auth.uid())
)
with check (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'crm.leads.manage', auth.uid())
);

-- === original: 202602200005_krux_beta_part5_s005_platform_control_plane_governance.sql ===
-- KRUXT beta part 5 (s005)
-- Platform control plane + governance:
-- 1) Founder/operator control-plane roles and permissions
-- 2) Delegated, time-boxed gym support access grants and sessions
-- 3) Platform KPI snapshots and global feature override model
-- 4) Data-product governance primitives for compliant monetization

-- =====================================================
-- ENUMS
-- =====================================================

do $$ begin
  create type public.platform_operator_role as enum (
    'founder',
    'ops_admin',
    'support_admin',
    'compliance_admin',
    'analyst',
    'read_only'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.support_access_grant_status as enum (
    'requested',
    'approved',
    'denied',
    'revoked',
    'expired'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.support_access_session_status as enum ('active', 'ended', 'terminated');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.data_partner_status as enum ('prospect', 'active', 'suspended', 'terminated');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.data_product_access_level as enum ('aggregate_anonymous', 'pseudonymous');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.data_partner_grant_status as enum (
    'requested',
    'approved',
    'denied',
    'revoked',
    'expired'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.data_partner_export_status as enum (
    'queued',
    'running',
    'completed',
    'failed',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

-- =====================================================
-- PLATFORM OPERATOR RBAC TABLES
-- =====================================================

create table if not exists public.platform_permission_catalog (
  permission_key text primary key,
  category text not null,
  label text not null,
  description text,
  is_sensitive boolean not null default false,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (permission_key = lower(permission_key))
);

create table if not exists public.platform_role_permissions (
  id uuid primary key default gen_random_uuid(),
  role public.platform_operator_role not null,
  permission_key text not null references public.platform_permission_catalog(permission_key) on delete cascade,
  is_allowed boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(role, permission_key)
);

create table if not exists public.platform_operator_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role public.platform_operator_role not null default 'read_only',
  is_active boolean not null default true,
  mfa_required boolean not null default true,
  last_login_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_operator_permission_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.platform_operator_accounts(user_id) on delete cascade,
  permission_key text not null references public.platform_permission_catalog(permission_key) on delete cascade,
  is_allowed boolean not null,
  reason text,
  updated_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, permission_key)
);

-- =====================================================
-- DELEGATED GYM SUPPORT ACCESS (HIGH-SECURITY)
-- =====================================================

create table if not exists public.gym_support_access_grants (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  operator_user_id uuid not null references public.platform_operator_accounts(user_id) on delete cascade,
  requested_by_user_id uuid references public.profiles(id) on delete set null,
  approved_by_user_id uuid references public.profiles(id) on delete set null,
  status public.support_access_grant_status not null default 'requested',
  permission_scope text[] not null default '{}'::text[],
  reason text not null,
  note text,
  starts_at timestamptz,
  ends_at timestamptz,
  revoked_at timestamptz,
  revoked_by_user_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    ends_at is null
    or starts_at is null
    or ends_at > starts_at
  )
);

create table if not exists public.gym_support_access_sessions (
  id uuid primary key default gen_random_uuid(),
  grant_id uuid not null references public.gym_support_access_grants(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  operator_user_id uuid not null references public.platform_operator_accounts(user_id) on delete cascade,
  support_ticket_id uuid references public.support_tickets(id) on delete set null,
  session_status public.support_access_session_status not null default 'active',
  justification text not null,
  actions_summary jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  terminated_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);

-- =====================================================
-- PLATFORM CONTROL PLANE SNAPSHOTS + FLAGS
-- =====================================================

create table if not exists public.platform_kpi_daily_snapshots (
  id uuid primary key default gen_random_uuid(),
  metric_date date not null unique,
  total_users integer not null default 0 check (total_users >= 0),
  active_users_7d integer not null default 0 check (active_users_7d >= 0),
  active_gyms_7d integer not null default 0 check (active_gyms_7d >= 0),
  workouts_logged_count integer not null default 0 check (workouts_logged_count >= 0),
  proof_posts_count integer not null default 0 check (proof_posts_count >= 0),
  class_bookings_count integer not null default 0 check (class_bookings_count >= 0),
  support_tickets_open integer not null default 0 check (support_tickets_open >= 0),
  connected_devices_count integer not null default 0 check (connected_devices_count >= 0),
  mrr_cents integer not null default 0 check (mrr_cents >= 0),
  churn_rate_percent numeric(5,2) check (churn_rate_percent is null or (churn_rate_percent >= 0 and churn_rate_percent <= 100)),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_feature_overrides (
  id uuid primary key default gen_random_uuid(),
  feature_key text not null,
  target_scope text not null check (target_scope in ('global', 'region', 'segment')),
  target_value text not null default 'all',
  enabled boolean not null default true,
  rollout_percentage integer not null default 100 check (rollout_percentage between 0 and 100),
  note text,
  updated_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(feature_key, target_scope, target_value)
);

-- =====================================================
-- DATA MONETIZATION GOVERNANCE (COMPLIANCE-BY-DESIGN)
-- =====================================================

create table if not exists public.user_data_sharing_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  allow_aggregated_analytics boolean not null default true,
  allow_third_party_aggregated_sharing boolean not null default false,
  allow_pseudonymous_research boolean not null default false,
  source text not null default 'in_app',
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.data_partners (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  display_name text not null,
  contact_email text not null,
  country_code char(2),
  status public.data_partner_status not null default 'prospect',
  dpa_signed_at timestamptz,
  dpa_reference text,
  allowed_regions text[] not null default '{}'::text[],
  prohibited_data_categories text[] not null default '{}'::text[],
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.data_products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  access_level public.data_product_access_level not null default 'aggregate_anonymous',
  min_k_anonymity integer not null default 50 check (min_k_anonymity >= 10),
  requires_user_opt_in boolean not null default true,
  allowed_metrics text[] not null default '{}'::text[],
  retention_days integer check (retention_days is null or retention_days > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.data_partner_access_grants (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.data_partners(id) on delete cascade,
  product_id uuid not null references public.data_products(id) on delete cascade,
  status public.data_partner_grant_status not null default 'requested',
  legal_basis text not null,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  starts_at timestamptz,
  ends_at timestamptz,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at),
  unique(partner_id, product_id)
);

create table if not exists public.data_partner_exports (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.data_partners(id) on delete cascade,
  product_id uuid not null references public.data_products(id) on delete cascade,
  access_grant_id uuid references public.data_partner_access_grants(id) on delete set null,
  export_status public.data_partner_export_status not null default 'queued',
  requested_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  generated_by uuid references public.profiles(id) on delete set null,
  export_level public.data_product_access_level not null default 'aggregate_anonymous',
  rows_exported integer not null default 0 check (rows_exported >= 0),
  includes_personal_data boolean not null default false,
  output_uri text,
  checksum_sha256 text,
  generated_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (export_level = 'aggregate_anonymous' and includes_personal_data = false)
    or export_level = 'pseudonymous'
  )
);

-- =====================================================
-- INDEXES
-- =====================================================

create index if not exists idx_platform_role_permissions_role
  on public.platform_role_permissions(role);
create index if not exists idx_platform_operator_accounts_role_active
  on public.platform_operator_accounts(role, is_active);
create index if not exists idx_platform_operator_permission_overrides_user
  on public.platform_operator_permission_overrides(user_id);
create index if not exists idx_gym_support_access_grants_lookup
  on public.gym_support_access_grants(gym_id, operator_user_id, status, ends_at);
create index if not exists idx_gym_support_access_sessions_lookup
  on public.gym_support_access_sessions(gym_id, operator_user_id, session_status, started_at desc);
create index if not exists idx_platform_kpi_daily_snapshots_date
  on public.platform_kpi_daily_snapshots(metric_date desc);
create index if not exists idx_platform_feature_overrides_lookup
  on public.platform_feature_overrides(feature_key, target_scope, target_value);
create index if not exists idx_user_data_sharing_preferences_flags
  on public.user_data_sharing_preferences(allow_third_party_aggregated_sharing, allow_pseudonymous_research);
create index if not exists idx_data_partners_status
  on public.data_partners(status, created_at desc);
create index if not exists idx_data_products_access_level
  on public.data_products(access_level, requires_user_opt_in);
create index if not exists idx_data_partner_access_grants_status
  on public.data_partner_access_grants(status, starts_at, ends_at);
create index if not exists idx_data_partner_exports_status
  on public.data_partner_exports(export_status, created_at desc);

-- =====================================================
-- UPDATED_AT TRIGGERS
-- =====================================================

drop trigger if exists trg_platform_permission_catalog_set_updated_at on public.platform_permission_catalog;
create trigger trg_platform_permission_catalog_set_updated_at
before update on public.platform_permission_catalog
for each row execute function public.set_updated_at();

drop trigger if exists trg_platform_role_permissions_set_updated_at on public.platform_role_permissions;
create trigger trg_platform_role_permissions_set_updated_at
before update on public.platform_role_permissions
for each row execute function public.set_updated_at();

drop trigger if exists trg_platform_operator_accounts_set_updated_at on public.platform_operator_accounts;
create trigger trg_platform_operator_accounts_set_updated_at
before update on public.platform_operator_accounts
for each row execute function public.set_updated_at();

drop trigger if exists trg_platform_operator_permission_overrides_set_updated_at on public.platform_operator_permission_overrides;
create trigger trg_platform_operator_permission_overrides_set_updated_at
before update on public.platform_operator_permission_overrides
for each row execute function public.set_updated_at();

drop trigger if exists trg_gym_support_access_grants_set_updated_at on public.gym_support_access_grants;
create trigger trg_gym_support_access_grants_set_updated_at
before update on public.gym_support_access_grants
for each row execute function public.set_updated_at();

drop trigger if exists trg_gym_support_access_sessions_set_updated_at on public.gym_support_access_sessions;
create trigger trg_gym_support_access_sessions_set_updated_at
before update on public.gym_support_access_sessions
for each row execute function public.set_updated_at();

drop trigger if exists trg_platform_kpi_daily_snapshots_set_updated_at on public.platform_kpi_daily_snapshots;
create trigger trg_platform_kpi_daily_snapshots_set_updated_at
before update on public.platform_kpi_daily_snapshots
for each row execute function public.set_updated_at();

drop trigger if exists trg_platform_feature_overrides_set_updated_at on public.platform_feature_overrides;
create trigger trg_platform_feature_overrides_set_updated_at
before update on public.platform_feature_overrides
for each row execute function public.set_updated_at();

drop trigger if exists trg_user_data_sharing_preferences_set_updated_at on public.user_data_sharing_preferences;
create trigger trg_user_data_sharing_preferences_set_updated_at
before update on public.user_data_sharing_preferences
for each row execute function public.set_updated_at();

drop trigger if exists trg_data_partners_set_updated_at on public.data_partners;
create trigger trg_data_partners_set_updated_at
before update on public.data_partners
for each row execute function public.set_updated_at();

drop trigger if exists trg_data_products_set_updated_at on public.data_products;
create trigger trg_data_products_set_updated_at
before update on public.data_products
for each row execute function public.set_updated_at();

drop trigger if exists trg_data_partner_access_grants_set_updated_at on public.data_partner_access_grants;
create trigger trg_data_partner_access_grants_set_updated_at
before update on public.data_partner_access_grants
for each row execute function public.set_updated_at();

drop trigger if exists trg_data_partner_exports_set_updated_at on public.data_partner_exports;
create trigger trg_data_partner_exports_set_updated_at
before update on public.data_partner_exports
for each row execute function public.set_updated_at();

-- =====================================================
-- ACCESS HELPERS
-- =====================================================

insert into public.platform_permission_catalog (permission_key, category, label, description, is_sensitive)
values
  ('platform.overview.read', 'platform', 'Platform Overview Read', 'Read global cross-tenant KPI overview.', false),
  ('platform.operators.manage', 'platform', 'Operator Access Manage', 'Manage platform operator accounts and overrides.', true),
  ('platform.flags.manage', 'platform', 'Feature Override Manage', 'Manage global/segment feature overrides.', true),
  ('platform.support.access.request', 'support', 'Support Access Request', 'Request delegated access to gym-sensitive areas.', true),
  ('platform.support.access.approve', 'support', 'Support Access Approve', 'Approve/revoke delegated support access grants.', true),
  ('platform.support.sessions.manage', 'support', 'Support Session Manage', 'Start/end delegated support access sessions.', true),
  ('platform.analytics.read', 'analytics', 'Analytics Read', 'Read platform analytics and KPI snapshots.', false),
  ('platform.data_governance.manage', 'data', 'Data Governance Manage', 'Manage partners, products, grants, and exports.', true),
  ('platform.data_exports.approve', 'data', 'Data Export Approve', 'Approve data export jobs to external partners.', true),
  ('platform.compliance.read', 'compliance', 'Compliance Read', 'Read compliance/legal operational panels.', true)
on conflict (permission_key) do update
set
  category = excluded.category,
  label = excluded.label,
  description = excluded.description,
  is_sensitive = excluded.is_sensitive,
  is_active = true,
  updated_at = now();

insert into public.platform_role_permissions (role, permission_key, is_allowed)
select r.role, p.permission_key, r.is_allowed
from (
  values
    ('founder'::public.platform_operator_role, 'platform.overview.read', true),
    ('founder'::public.platform_operator_role, 'platform.operators.manage', true),
    ('founder'::public.platform_operator_role, 'platform.flags.manage', true),
    ('founder'::public.platform_operator_role, 'platform.support.access.request', true),
    ('founder'::public.platform_operator_role, 'platform.support.access.approve', true),
    ('founder'::public.platform_operator_role, 'platform.support.sessions.manage', true),
    ('founder'::public.platform_operator_role, 'platform.analytics.read', true),
    ('founder'::public.platform_operator_role, 'platform.data_governance.manage', true),
    ('founder'::public.platform_operator_role, 'platform.data_exports.approve', true),
    ('founder'::public.platform_operator_role, 'platform.compliance.read', true),
    ('ops_admin'::public.platform_operator_role, 'platform.overview.read', true),
    ('ops_admin'::public.platform_operator_role, 'platform.flags.manage', true),
    ('ops_admin'::public.platform_operator_role, 'platform.support.access.request', true),
    ('ops_admin'::public.platform_operator_role, 'platform.support.sessions.manage', true),
    ('ops_admin'::public.platform_operator_role, 'platform.analytics.read', true),
    ('ops_admin'::public.platform_operator_role, 'platform.compliance.read', true),
    ('support_admin'::public.platform_operator_role, 'platform.overview.read', true),
    ('support_admin'::public.platform_operator_role, 'platform.support.access.request', true),
    ('support_admin'::public.platform_operator_role, 'platform.support.access.approve', false),
    ('support_admin'::public.platform_operator_role, 'platform.support.sessions.manage', true),
    ('support_admin'::public.platform_operator_role, 'platform.analytics.read', true),
    ('compliance_admin'::public.platform_operator_role, 'platform.overview.read', true),
    ('compliance_admin'::public.platform_operator_role, 'platform.support.access.request', true),
    ('compliance_admin'::public.platform_operator_role, 'platform.support.access.approve', true),
    ('compliance_admin'::public.platform_operator_role, 'platform.analytics.read', true),
    ('compliance_admin'::public.platform_operator_role, 'platform.data_governance.manage', true),
    ('compliance_admin'::public.platform_operator_role, 'platform.data_exports.approve', true),
    ('compliance_admin'::public.platform_operator_role, 'platform.compliance.read', true),
    ('analyst'::public.platform_operator_role, 'platform.overview.read', true),
    ('analyst'::public.platform_operator_role, 'platform.analytics.read', true),
    ('read_only'::public.platform_operator_role, 'platform.overview.read', true)
) as r(role, permission_key, is_allowed)
join public.platform_permission_catalog p
  on p.permission_key = r.permission_key
on conflict (role, permission_key) do update
set
  is_allowed = excluded.is_allowed,
  updated_at = now();

create or replace function public.is_platform_operator(_viewer uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_operator_accounts poa
    where poa.user_id = _viewer
      and poa.is_active = true
  );
$$;

create or replace function public.platform_operator_has_permission(
  _permission_key text,
  _viewer uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role public.platform_operator_role;
  v_override boolean;
  v_allowed boolean;
begin
  if public.is_service_role() then
    return true;
  end if;

  if _viewer is null then
    return false;
  end if;

  select poa.role
  into v_role
  from public.platform_operator_accounts poa
  where poa.user_id = _viewer
    and poa.is_active = true
  limit 1;

  if v_role is null then
    return false;
  end if;

  select ppo.is_allowed
  into v_override
  from public.platform_operator_permission_overrides ppo
  where ppo.user_id = _viewer
    and ppo.permission_key = lower(_permission_key)
  limit 1;

  if v_override is not null then
    return v_override;
  end if;

  select prp.is_allowed
  into v_allowed
  from public.platform_role_permissions prp
  where prp.role = v_role
    and prp.permission_key = lower(_permission_key)
  limit 1;

  return coalesce(v_allowed, false);
end;
$$;

create or replace function public.platform_has_approved_gym_support_grant(
  _gym_id uuid,
  _operator_user_id uuid default auth.uid(),
  _required_scope text default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.gym_support_access_grants g
    where g.gym_id = _gym_id
      and g.operator_user_id = _operator_user_id
      and g.status = 'approved'
      and (g.starts_at is null or g.starts_at <= now())
      and (g.ends_at is null or g.ends_at >= now())
      and (
        _required_scope is null
        or _required_scope = any(g.permission_scope)
      )
  );
$$;

create or replace function public.get_platform_admin_overview()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_result jsonb;
begin
  if not public.platform_operator_has_permission('platform.overview.read', v_actor) then
    raise exception 'Access denied';
  end if;

  select jsonb_build_object(
    'generatedAt', now(),
    'totalUsers', (select count(*) from public.profiles),
    'totalGyms', (select count(*) from public.gyms),
    'workoutsLast7d', (
      select count(*)
      from public.workouts w
      where w.created_at >= now() - interval '7 day'
    ),
    'openSupportTickets', (
      select count(*)
      from public.support_tickets st
      where st.status in ('open', 'triaged', 'in_progress', 'waiting_approval')
    ),
    'activeDeviceConnections', (
      select count(*)
      from public.device_connections dc
      where dc.status = 'active'
    ),
    'latestKpiSnapshot', (
      select to_jsonb(pks.*)
      from public.platform_kpi_daily_snapshots pks
      order by pks.metric_date desc
      limit 1
    )
  )
  into v_result;

  return v_result;
end;
$$;

-- =====================================================
-- RLS
-- =====================================================

alter table public.platform_permission_catalog enable row level security;
alter table public.platform_role_permissions enable row level security;
alter table public.platform_operator_accounts enable row level security;
alter table public.platform_operator_permission_overrides enable row level security;
alter table public.gym_support_access_grants enable row level security;
alter table public.gym_support_access_sessions enable row level security;
alter table public.platform_kpi_daily_snapshots enable row level security;
alter table public.platform_feature_overrides enable row level security;
alter table public.user_data_sharing_preferences enable row level security;
alter table public.data_partners enable row level security;
alter table public.data_products enable row level security;
alter table public.data_partner_access_grants enable row level security;
alter table public.data_partner_exports enable row level security;

drop policy if exists platform_permission_catalog_select on public.platform_permission_catalog;
create policy platform_permission_catalog_select
on public.platform_permission_catalog for select to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.operators.manage', auth.uid())
  or (is_active and public.is_platform_operator(auth.uid()))
);

drop policy if exists platform_permission_catalog_manage on public.platform_permission_catalog;
create policy platform_permission_catalog_manage
on public.platform_permission_catalog for all to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.operators.manage', auth.uid())
)
with check (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.operators.manage', auth.uid())
);

drop policy if exists platform_role_permissions_select on public.platform_role_permissions;
create policy platform_role_permissions_select
on public.platform_role_permissions for select to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.operators.manage', auth.uid())
  or public.is_platform_operator(auth.uid())
);

drop policy if exists platform_role_permissions_manage on public.platform_role_permissions;
create policy platform_role_permissions_manage
on public.platform_role_permissions for all to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.operators.manage', auth.uid())
)
with check (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.operators.manage', auth.uid())
);

drop policy if exists platform_operator_accounts_select on public.platform_operator_accounts;
create policy platform_operator_accounts_select
on public.platform_operator_accounts for select to authenticated
using (
  public.is_service_role()
  or user_id = auth.uid()
  or public.platform_operator_has_permission('platform.operators.manage', auth.uid())
);

drop policy if exists platform_operator_accounts_manage on public.platform_operator_accounts;
create policy platform_operator_accounts_manage
on public.platform_operator_accounts for all to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.operators.manage', auth.uid())
)
with check (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.operators.manage', auth.uid())
);

drop policy if exists platform_operator_permission_overrides_select on public.platform_operator_permission_overrides;
create policy platform_operator_permission_overrides_select
on public.platform_operator_permission_overrides for select to authenticated
using (
  public.is_service_role()
  or user_id = auth.uid()
  or public.platform_operator_has_permission('platform.operators.manage', auth.uid())
);

drop policy if exists platform_operator_permission_overrides_manage on public.platform_operator_permission_overrides;
create policy platform_operator_permission_overrides_manage
on public.platform_operator_permission_overrides for all to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.operators.manage', auth.uid())
)
with check (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.operators.manage', auth.uid())
);

drop policy if exists gym_support_access_grants_select on public.gym_support_access_grants;
create policy gym_support_access_grants_select
on public.gym_support_access_grants for select to authenticated
using (
  public.is_service_role()
  or operator_user_id = auth.uid()
  or public.can_manage_gym_config(gym_id, auth.uid())
  or public.platform_operator_has_permission('platform.support.access.approve', auth.uid())
);

drop policy if exists gym_support_access_grants_insert on public.gym_support_access_grants;
create policy gym_support_access_grants_insert
on public.gym_support_access_grants for insert to authenticated
with check (
  public.is_service_role()
  or (
    operator_user_id = auth.uid()
    and public.platform_operator_has_permission('platform.support.access.request', auth.uid())
  )
);

drop policy if exists gym_support_access_grants_update on public.gym_support_access_grants;
create policy gym_support_access_grants_update
on public.gym_support_access_grants for update to authenticated
using (
  public.is_service_role()
  or public.can_manage_gym_config(gym_id, auth.uid())
  or public.platform_operator_has_permission('platform.support.access.approve', auth.uid())
)
with check (
  public.is_service_role()
  or public.can_manage_gym_config(gym_id, auth.uid())
  or public.platform_operator_has_permission('platform.support.access.approve', auth.uid())
);

drop policy if exists gym_support_access_sessions_select on public.gym_support_access_sessions;
create policy gym_support_access_sessions_select
on public.gym_support_access_sessions for select to authenticated
using (
  public.is_service_role()
  or operator_user_id = auth.uid()
  or public.can_manage_gym_config(gym_id, auth.uid())
  or public.platform_operator_has_permission('platform.support.sessions.manage', auth.uid())
);

drop policy if exists gym_support_access_sessions_insert on public.gym_support_access_sessions;
create policy gym_support_access_sessions_insert
on public.gym_support_access_sessions for insert to authenticated
with check (
  public.is_service_role()
  or (
    operator_user_id = auth.uid()
    and public.platform_operator_has_permission('platform.support.sessions.manage', auth.uid())
    and public.platform_has_approved_gym_support_grant(gym_id, auth.uid(), null)
  )
);

drop policy if exists gym_support_access_sessions_update on public.gym_support_access_sessions;
create policy gym_support_access_sessions_update
on public.gym_support_access_sessions for update to authenticated
using (
  public.is_service_role()
  or (
    operator_user_id = auth.uid()
    and public.platform_operator_has_permission('platform.support.sessions.manage', auth.uid())
  )
)
with check (
  public.is_service_role()
  or (
    operator_user_id = auth.uid()
    and public.platform_operator_has_permission('platform.support.sessions.manage', auth.uid())
  )
);

drop policy if exists platform_kpi_daily_snapshots_select on public.platform_kpi_daily_snapshots;
create policy platform_kpi_daily_snapshots_select
on public.platform_kpi_daily_snapshots for select to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.analytics.read', auth.uid())
);

drop policy if exists platform_kpi_daily_snapshots_manage on public.platform_kpi_daily_snapshots;
create policy platform_kpi_daily_snapshots_manage
on public.platform_kpi_daily_snapshots for all to authenticated
using (public.is_service_role())
with check (public.is_service_role());

drop policy if exists platform_feature_overrides_select on public.platform_feature_overrides;
create policy platform_feature_overrides_select
on public.platform_feature_overrides for select to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.flags.manage', auth.uid())
);

drop policy if exists platform_feature_overrides_manage on public.platform_feature_overrides;
create policy platform_feature_overrides_manage
on public.platform_feature_overrides for all to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.flags.manage', auth.uid())
)
with check (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.flags.manage', auth.uid())
);

drop policy if exists user_data_sharing_preferences_select on public.user_data_sharing_preferences;
create policy user_data_sharing_preferences_select
on public.user_data_sharing_preferences for select to authenticated
using (
  public.is_service_role()
  or user_id = auth.uid()
  or public.platform_operator_has_permission('platform.compliance.read', auth.uid())
);

drop policy if exists user_data_sharing_preferences_manage on public.user_data_sharing_preferences;
create policy user_data_sharing_preferences_manage
on public.user_data_sharing_preferences for all to authenticated
using (
  public.is_service_role()
  or user_id = auth.uid()
)
with check (
  public.is_service_role()
  or user_id = auth.uid()
);

drop policy if exists data_partners_select on public.data_partners;
create policy data_partners_select
on public.data_partners for select to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
  or public.platform_operator_has_permission('platform.data_exports.approve', auth.uid())
);

drop policy if exists data_partners_manage on public.data_partners;
create policy data_partners_manage
on public.data_partners for all to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
)
with check (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
);

drop policy if exists data_products_select on public.data_products;
create policy data_products_select
on public.data_products for select to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
  or public.platform_operator_has_permission('platform.analytics.read', auth.uid())
);

drop policy if exists data_products_manage on public.data_products;
create policy data_products_manage
on public.data_products for all to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
)
with check (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
);

drop policy if exists data_partner_access_grants_select on public.data_partner_access_grants;
create policy data_partner_access_grants_select
on public.data_partner_access_grants for select to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
  or public.platform_operator_has_permission('platform.data_exports.approve', auth.uid())
);

drop policy if exists data_partner_access_grants_manage on public.data_partner_access_grants;
create policy data_partner_access_grants_manage
on public.data_partner_access_grants for all to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
)
with check (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
);

drop policy if exists data_partner_exports_select on public.data_partner_exports;
create policy data_partner_exports_select
on public.data_partner_exports for select to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
  or public.platform_operator_has_permission('platform.data_exports.approve', auth.uid())
);

drop policy if exists data_partner_exports_insert on public.data_partner_exports;
create policy data_partner_exports_insert
on public.data_partner_exports for insert to authenticated
with check (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
);

drop policy if exists data_partner_exports_update on public.data_partner_exports;
create policy data_partner_exports_update
on public.data_partner_exports for update to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
  or public.platform_operator_has_permission('platform.data_exports.approve', auth.uid())
)
with check (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
  or public.platform_operator_has_permission('platform.data_exports.approve', auth.uid())
);

-- === original: 202602200006_krux_beta_part5_s006_account_security_foundations.sql ===
-- KRUXT beta part 5 (s006)
-- Account security foundations:
-- 1) User-managed security settings
-- 2) Trusted device registry
-- 3) Auth/security event trail

-- =====================================================
-- ENUMS
-- =====================================================

do $$ begin
  create type public.auth_event_type as enum (
    'login_success',
    'login_failed',
    'logout',
    'password_changed',
    'mfa_enabled',
    'mfa_disabled',
    'token_refreshed',
    'new_device_trusted',
    'trusted_device_revoked',
    'session_revoked'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.auth_event_risk_level as enum ('low', 'medium', 'high');
exception
  when duplicate_object then null;
end $$;

-- =====================================================
-- TABLES
-- =====================================================

create table if not exists public.user_security_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  mfa_required boolean not null default false,
  mfa_enabled boolean not null default false,
  passkey_enabled boolean not null default false,
  new_device_alerts boolean not null default true,
  login_alert_channel text not null default 'email' check (login_alert_channel in ('email', 'push', 'none')),
  session_timeout_minutes integer not null default 10080 check (session_timeout_minutes between 15 and 43200),
  allow_multi_device_sessions boolean not null default true,
  password_updated_at timestamptz,
  last_security_reviewed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_trusted_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_id text not null,
  platform text not null check (platform in ('ios', 'android', 'web', 'unknown')),
  device_name text,
  app_version text,
  os_version text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_ip inet,
  is_active boolean not null default true,
  revoked_at timestamptz,
  revoked_by_user_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, device_id)
);

create table if not exists public.user_auth_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type public.auth_event_type not null,
  risk_level public.auth_event_risk_level not null default 'low',
  device_id text,
  platform text,
  ip_address inet,
  user_agent text,
  success boolean not null default true,
  failure_reason text,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into public.user_security_settings (user_id)
select p.id
from public.profiles p
on conflict (user_id) do nothing;

-- =====================================================
-- INDEXES
-- =====================================================

create index if not exists idx_user_trusted_devices_user_active
  on public.user_trusted_devices(user_id, is_active, last_seen_at desc);
create index if not exists idx_user_auth_events_user_time
  on public.user_auth_events(user_id, occurred_at desc);
create index if not exists idx_user_auth_events_risk
  on public.user_auth_events(risk_level, occurred_at desc);

-- =====================================================
-- UPDATED_AT TRIGGERS
-- =====================================================

drop trigger if exists trg_user_security_settings_set_updated_at on public.user_security_settings;
create trigger trg_user_security_settings_set_updated_at
before update on public.user_security_settings
for each row execute function public.set_updated_at();

drop trigger if exists trg_user_trusted_devices_set_updated_at on public.user_trusted_devices;
create trigger trg_user_trusted_devices_set_updated_at
before update on public.user_trusted_devices
for each row execute function public.set_updated_at();

-- =====================================================
-- HELPERS
-- =====================================================

create or replace function public.ensure_user_security_settings(_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_security_settings (user_id)
  values (_user_id)
  on conflict (user_id) do nothing;
end;
$$;

create or replace function public.log_user_auth_event(
  p_event_type public.auth_event_type,
  p_risk_level public.auth_event_risk_level default 'low',
  p_device_id text default null,
  p_platform text default null,
  p_ip_address inet default null,
  p_user_agent text default null,
  p_success boolean default true,
  p_failure_reason text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.user_auth_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_event public.user_auth_events;
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  perform public.ensure_user_security_settings(v_actor);

  insert into public.user_auth_events (
    user_id,
    event_type,
    risk_level,
    device_id,
    platform,
    ip_address,
    user_agent,
    success,
    failure_reason,
    metadata
  )
  values (
    v_actor,
    p_event_type,
    p_risk_level,
    p_device_id,
    p_platform,
    p_ip_address,
    p_user_agent,
    p_success,
    p_failure_reason,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning *
  into v_event;

  return v_event;
end;
$$;

-- =====================================================
-- RLS
-- =====================================================

alter table public.user_security_settings enable row level security;
alter table public.user_trusted_devices enable row level security;
alter table public.user_auth_events enable row level security;

drop policy if exists user_security_settings_select on public.user_security_settings;
create policy user_security_settings_select
on public.user_security_settings for select to authenticated
using (
  public.is_service_role()
  or user_id = auth.uid()
);

drop policy if exists user_security_settings_manage on public.user_security_settings;
create policy user_security_settings_manage
on public.user_security_settings for all to authenticated
using (
  public.is_service_role()
  or user_id = auth.uid()
)
with check (
  public.is_service_role()
  or user_id = auth.uid()
);

drop policy if exists user_trusted_devices_select on public.user_trusted_devices;
create policy user_trusted_devices_select
on public.user_trusted_devices for select to authenticated
using (
  public.is_service_role()
  or user_id = auth.uid()
);

drop policy if exists user_trusted_devices_manage on public.user_trusted_devices;
create policy user_trusted_devices_manage
on public.user_trusted_devices for all to authenticated
using (
  public.is_service_role()
  or user_id = auth.uid()
)
with check (
  public.is_service_role()
  or user_id = auth.uid()
);

drop policy if exists user_auth_events_select on public.user_auth_events;
create policy user_auth_events_select
on public.user_auth_events for select to authenticated
using (
  public.is_service_role()
  or user_id = auth.uid()
);

drop policy if exists user_auth_events_insert on public.user_auth_events;
create policy user_auth_events_insert
on public.user_auth_events for insert to authenticated
with check (
  public.is_service_role()
  or user_id = auth.uid()
);

-- === original: 202602200007_krux_beta_part5_s007_addons_partner_dataops.sql ===
-- KRUXT beta part 5 (s007)
-- Growth/revenue module foundations:
-- 1) B2B2C add-ons (advanced analytics/workforce/automation)
-- 2) Partner ecosystem installs + revenue events
-- 3) Governed aggregate data-product operations

-- =====================================================
-- ENUMS
-- =====================================================

do $$ begin
  create type public.gym_addon_category as enum (
    'analytics',
    'workforce',
    'automation',
    'engagement',
    'integrations',
    'other'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.gym_addon_subscription_status as enum (
    'trialing',
    'active',
    'paused',
    'past_due',
    'canceled'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.gym_automation_run_status as enum (
    'queued',
    'running',
    'awaiting_approval',
    'succeeded',
    'failed',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.partner_app_status as enum ('draft', 'active', 'suspended', 'retired');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.partner_install_status as enum ('active', 'paused', 'revoked', 'error');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.partner_revenue_event_status as enum ('pending', 'recognized', 'invoiced', 'paid', 'void');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.data_aggregation_job_status as enum ('queued', 'running', 'completed', 'failed', 'cancelled');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.anonymization_check_status as enum ('passed', 'failed', 'waived');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.data_release_approval_status as enum ('pending', 'approved', 'rejected');
exception
  when duplicate_object then null;
end $$;

-- =====================================================
-- ADD-ON TABLES
-- =====================================================

create table if not exists public.gym_addon_catalog (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  category public.gym_addon_category not null,
  billing_scope public.billing_scope not null default 'b2b',
  default_price_cents integer not null default 0 check (default_price_cents >= 0),
  currency char(3) not null default 'EUR',
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gym_addon_subscriptions (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  addon_id uuid not null references public.gym_addon_catalog(id) on delete restrict,
  status public.gym_addon_subscription_status not null default 'trialing',
  starts_at timestamptz,
  ends_at timestamptz,
  trial_ends_at timestamptz,
  provider text not null default 'stripe',
  provider_subscription_id text,
  billing_reference text,
  config jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at),
  unique(gym_id, addon_id)
);

create table if not exists public.gym_advanced_analytics_views (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  name text not null,
  description text,
  visibility text not null default 'staff' check (visibility in ('owner_only', 'staff')),
  query_spec jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gym_automation_playbooks (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  addon_subscription_id uuid references public.gym_addon_subscriptions(id) on delete set null,
  name text not null,
  description text,
  trigger_type text not null,
  trigger_config jsonb not null default '{}'::jsonb,
  action_plan jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  requires_human_approval boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gym_automation_runs (
  id uuid primary key default gen_random_uuid(),
  playbook_id uuid not null references public.gym_automation_playbooks(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  run_status public.gym_automation_run_status not null default 'queued',
  triggered_by text not null default 'system',
  trigger_payload jsonb not null default '{}'::jsonb,
  planned_actions jsonb not null default '[]'::jsonb,
  executed_actions jsonb not null default '[]'::jsonb,
  requires_human_approval boolean not null default true,
  approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected', 'not_required')),
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================
-- PARTNER ECOSYSTEM TABLES
-- =====================================================

create table if not exists public.partner_marketplace_apps (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.data_partners(id) on delete cascade,
  app_code text not null unique,
  name text not null,
  description text,
  category text not null,
  status public.partner_app_status not null default 'draft',
  pricing_model text not null default 'subscription'
    check (pricing_model in ('subscription', 'usage', 'revshare', 'hybrid')),
  revenue_share_bps integer check (revenue_share_bps is null or (revenue_share_bps >= 0 and revenue_share_bps <= 10000)),
  install_url text,
  docs_url text,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gym_partner_app_installs (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  partner_app_id uuid not null references public.partner_marketplace_apps(id) on delete cascade,
  install_status public.partner_install_status not null default 'active',
  external_account_id text,
  billing_reference text,
  installed_by uuid references public.profiles(id) on delete set null,
  installed_at timestamptz not null default now(),
  last_sync_at timestamptz,
  last_error text,
  config jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(gym_id, partner_app_id)
);

create table if not exists public.partner_revenue_events (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid references public.gyms(id) on delete set null,
  partner_id uuid not null references public.data_partners(id) on delete cascade,
  partner_app_id uuid references public.partner_marketplace_apps(id) on delete set null,
  event_type text not null check (event_type in ('subscription_fee', 'usage_fee', 'revshare_credit', 'referral_bonus')),
  event_status public.partner_revenue_event_status not null default 'pending',
  period_start date,
  period_end date,
  gross_amount_cents integer not null default 0 check (gross_amount_cents >= 0),
  platform_amount_cents integer not null default 0 check (platform_amount_cents >= 0),
  partner_amount_cents integer not null default 0 check (partner_amount_cents >= 0),
  currency char(3) not null default 'EUR',
  source_reference text,
  recognized_at timestamptz,
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    gross_amount_cents = platform_amount_cents + partner_amount_cents
    or gross_amount_cents = 0
  )
);

create unique index if not exists uq_partner_revenue_events_source
  on public.partner_revenue_events(partner_app_id, source_reference, event_type)
  where source_reference is not null;

-- =====================================================
-- DATA OPS TABLES
-- =====================================================

create table if not exists public.data_aggregation_jobs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.data_products(id) on delete cascade,
  requested_by uuid references public.profiles(id) on delete set null,
  job_status public.data_aggregation_job_status not null default 'queued',
  source_window_start timestamptz,
  source_window_end timestamptz,
  aggregation_spec jsonb not null default '{}'::jsonb,
  output_summary jsonb not null default '{}'::jsonb,
  total_source_rows integer not null default 0 check (total_source_rows >= 0),
  output_row_count integer not null default 0 check (output_row_count >= 0),
  k_anonymity_floor integer not null default 50 check (k_anonymity_floor >= 10),
  min_group_size_observed integer,
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    source_window_end is null
    or source_window_start is null
    or source_window_end > source_window_start
  )
);

create table if not exists public.data_anonymization_checks (
  id uuid primary key default gen_random_uuid(),
  aggregation_job_id uuid not null references public.data_aggregation_jobs(id) on delete cascade,
  check_type text not null check (check_type in ('k_anonymity', 'l_diversity', 't_closeness', 'small_cell_suppression', 'manual_review')),
  status public.anonymization_check_status not null default 'passed',
  threshold_value numeric,
  observed_value numeric,
  details jsonb not null default '{}'::jsonb,
  checked_by uuid references public.profiles(id) on delete set null,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(aggregation_job_id, check_type)
);

create table if not exists public.data_release_approvals (
  id uuid primary key default gen_random_uuid(),
  export_id uuid not null references public.data_partner_exports(id) on delete cascade,
  required_approval_type text not null check (required_approval_type in ('compliance', 'security', 'business')),
  status public.data_release_approval_status not null default 'pending',
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(export_id, required_approval_type)
);

-- =====================================================
-- INDEXES
-- =====================================================

create index if not exists idx_gym_addon_subscriptions_gym_status
  on public.gym_addon_subscriptions(gym_id, status, ends_at);
create index if not exists idx_gym_advanced_analytics_views_gym
  on public.gym_advanced_analytics_views(gym_id, visibility);
create index if not exists idx_gym_automation_playbooks_gym_active
  on public.gym_automation_playbooks(gym_id, is_active);
create index if not exists idx_gym_automation_runs_gym_status
  on public.gym_automation_runs(gym_id, run_status, created_at desc);
create index if not exists idx_partner_marketplace_apps_status
  on public.partner_marketplace_apps(status, is_active);
create index if not exists idx_gym_partner_app_installs_gym_status
  on public.gym_partner_app_installs(gym_id, install_status);
create index if not exists idx_partner_revenue_events_status_time
  on public.partner_revenue_events(event_status, created_at desc);
create index if not exists idx_data_aggregation_jobs_status_time
  on public.data_aggregation_jobs(job_status, created_at desc);
create index if not exists idx_data_release_approvals_export_status
  on public.data_release_approvals(export_id, status);

-- =====================================================
-- UPDATED_AT TRIGGERS
-- =====================================================

drop trigger if exists trg_gym_addon_catalog_set_updated_at on public.gym_addon_catalog;
create trigger trg_gym_addon_catalog_set_updated_at
before update on public.gym_addon_catalog
for each row execute function public.set_updated_at();

drop trigger if exists trg_gym_addon_subscriptions_set_updated_at on public.gym_addon_subscriptions;
create trigger trg_gym_addon_subscriptions_set_updated_at
before update on public.gym_addon_subscriptions
for each row execute function public.set_updated_at();

drop trigger if exists trg_gym_advanced_analytics_views_set_updated_at on public.gym_advanced_analytics_views;
create trigger trg_gym_advanced_analytics_views_set_updated_at
before update on public.gym_advanced_analytics_views
for each row execute function public.set_updated_at();

drop trigger if exists trg_gym_automation_playbooks_set_updated_at on public.gym_automation_playbooks;
create trigger trg_gym_automation_playbooks_set_updated_at
before update on public.gym_automation_playbooks
for each row execute function public.set_updated_at();

drop trigger if exists trg_gym_automation_runs_set_updated_at on public.gym_automation_runs;
create trigger trg_gym_automation_runs_set_updated_at
before update on public.gym_automation_runs
for each row execute function public.set_updated_at();

drop trigger if exists trg_partner_marketplace_apps_set_updated_at on public.partner_marketplace_apps;
create trigger trg_partner_marketplace_apps_set_updated_at
before update on public.partner_marketplace_apps
for each row execute function public.set_updated_at();

drop trigger if exists trg_gym_partner_app_installs_set_updated_at on public.gym_partner_app_installs;
create trigger trg_gym_partner_app_installs_set_updated_at
before update on public.gym_partner_app_installs
for each row execute function public.set_updated_at();

drop trigger if exists trg_partner_revenue_events_set_updated_at on public.partner_revenue_events;
create trigger trg_partner_revenue_events_set_updated_at
before update on public.partner_revenue_events
for each row execute function public.set_updated_at();

drop trigger if exists trg_data_aggregation_jobs_set_updated_at on public.data_aggregation_jobs;
create trigger trg_data_aggregation_jobs_set_updated_at
before update on public.data_aggregation_jobs
for each row execute function public.set_updated_at();

drop trigger if exists trg_data_release_approvals_set_updated_at on public.data_release_approvals;
create trigger trg_data_release_approvals_set_updated_at
before update on public.data_release_approvals
for each row execute function public.set_updated_at();

-- =====================================================
-- PERMISSION SEED
-- =====================================================

insert into public.gym_permission_catalog (permission_key, category, label, description)
values
  ('addons.manage', 'billing', 'Manage Add-ons', 'Activate and configure gym add-on subscriptions.'),
  ('automation.manage', 'ops', 'Manage Automation', 'Create and run gym automation playbooks.'),
  ('analytics.advanced.view', 'analytics', 'View Advanced Analytics', 'Access advanced analytics dashboards and saved views.'),
  ('workforce.advanced.manage', 'staff', 'Manage Advanced Workforce', 'Operate shift/time-entry advanced workflows.'),
  ('partner.apps.manage', 'integrations', 'Manage Partner Apps', 'Install and configure partner marketplace apps.')
on conflict (permission_key) do update
set
  category = excluded.category,
  label = excluded.label,
  description = excluded.description,
  is_active = true,
  updated_at = now();

-- =====================================================
-- RLS
-- =====================================================

alter table public.gym_addon_catalog enable row level security;
alter table public.gym_addon_subscriptions enable row level security;
alter table public.gym_advanced_analytics_views enable row level security;
alter table public.gym_automation_playbooks enable row level security;
alter table public.gym_automation_runs enable row level security;
alter table public.partner_marketplace_apps enable row level security;
alter table public.gym_partner_app_installs enable row level security;
alter table public.partner_revenue_events enable row level security;
alter table public.data_aggregation_jobs enable row level security;
alter table public.data_anonymization_checks enable row level security;
alter table public.data_release_approvals enable row level security;

drop policy if exists gym_addon_catalog_select on public.gym_addon_catalog;
create policy gym_addon_catalog_select
on public.gym_addon_catalog for select to authenticated
using (is_active = true or public.is_service_role());

drop policy if exists gym_addon_catalog_manage on public.gym_addon_catalog;
create policy gym_addon_catalog_manage
on public.gym_addon_catalog for all to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
)
with check (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
);

drop policy if exists gym_addon_subscriptions_select on public.gym_addon_subscriptions;
create policy gym_addon_subscriptions_select
on public.gym_addon_subscriptions for select to authenticated
using (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'billing.view', auth.uid())
  or public.user_has_gym_permission(gym_id, 'addons.manage', auth.uid())
);

drop policy if exists gym_addon_subscriptions_manage on public.gym_addon_subscriptions;
create policy gym_addon_subscriptions_manage
on public.gym_addon_subscriptions for all to authenticated
using (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'addons.manage', auth.uid())
)
with check (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'addons.manage', auth.uid())
);

drop policy if exists gym_advanced_analytics_views_select on public.gym_advanced_analytics_views;
create policy gym_advanced_analytics_views_select
on public.gym_advanced_analytics_views for select to authenticated
using (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'analytics.view', auth.uid())
  or public.user_has_gym_permission(gym_id, 'analytics.advanced.view', auth.uid())
);

drop policy if exists gym_advanced_analytics_views_manage on public.gym_advanced_analytics_views;
create policy gym_advanced_analytics_views_manage
on public.gym_advanced_analytics_views for all to authenticated
using (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'analytics.advanced.view', auth.uid())
)
with check (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'analytics.advanced.view', auth.uid())
);

drop policy if exists gym_automation_playbooks_select on public.gym_automation_playbooks;
create policy gym_automation_playbooks_select
on public.gym_automation_playbooks for select to authenticated
using (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'automation.manage', auth.uid())
);

drop policy if exists gym_automation_playbooks_manage on public.gym_automation_playbooks;
create policy gym_automation_playbooks_manage
on public.gym_automation_playbooks for all to authenticated
using (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'automation.manage', auth.uid())
)
with check (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'automation.manage', auth.uid())
);

drop policy if exists gym_automation_runs_select on public.gym_automation_runs;
create policy gym_automation_runs_select
on public.gym_automation_runs for select to authenticated
using (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'automation.manage', auth.uid())
);

drop policy if exists gym_automation_runs_manage on public.gym_automation_runs;
create policy gym_automation_runs_manage
on public.gym_automation_runs for all to authenticated
using (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'automation.manage', auth.uid())
)
with check (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'automation.manage', auth.uid())
);

drop policy if exists partner_marketplace_apps_select on public.partner_marketplace_apps;
create policy partner_marketplace_apps_select
on public.partner_marketplace_apps for select to authenticated
using (is_active = true or public.is_service_role());

drop policy if exists partner_marketplace_apps_manage on public.partner_marketplace_apps;
create policy partner_marketplace_apps_manage
on public.partner_marketplace_apps for all to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
)
with check (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
);

drop policy if exists gym_partner_app_installs_select on public.gym_partner_app_installs;
create policy gym_partner_app_installs_select
on public.gym_partner_app_installs for select to authenticated
using (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'integrations.manage', auth.uid())
  or public.user_has_gym_permission(gym_id, 'partner.apps.manage', auth.uid())
);

drop policy if exists gym_partner_app_installs_manage on public.gym_partner_app_installs;
create policy gym_partner_app_installs_manage
on public.gym_partner_app_installs for all to authenticated
using (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'partner.apps.manage', auth.uid())
  or public.user_has_gym_permission(gym_id, 'integrations.manage', auth.uid())
)
with check (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'partner.apps.manage', auth.uid())
  or public.user_has_gym_permission(gym_id, 'integrations.manage', auth.uid())
);

drop policy if exists partner_revenue_events_select on public.partner_revenue_events;
create policy partner_revenue_events_select
on public.partner_revenue_events for select to authenticated
using (
  public.is_service_role()
  or (gym_id is not null and public.user_has_gym_permission(gym_id, 'billing.view', auth.uid()))
  or public.platform_operator_has_permission('platform.analytics.read', auth.uid())
);

drop policy if exists partner_revenue_events_manage on public.partner_revenue_events;
create policy partner_revenue_events_manage
on public.partner_revenue_events for all to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
)
with check (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
);

drop policy if exists data_aggregation_jobs_select on public.data_aggregation_jobs;
create policy data_aggregation_jobs_select
on public.data_aggregation_jobs for select to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.analytics.read', auth.uid())
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
);

drop policy if exists data_aggregation_jobs_manage on public.data_aggregation_jobs;
create policy data_aggregation_jobs_manage
on public.data_aggregation_jobs for all to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
)
with check (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
);

drop policy if exists data_anonymization_checks_select on public.data_anonymization_checks;
create policy data_anonymization_checks_select
on public.data_anonymization_checks for select to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
  or public.platform_operator_has_permission('platform.data_exports.approve', auth.uid())
);

drop policy if exists data_anonymization_checks_manage on public.data_anonymization_checks;
create policy data_anonymization_checks_manage
on public.data_anonymization_checks for all to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
)
with check (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
);

drop policy if exists data_release_approvals_select on public.data_release_approvals;
create policy data_release_approvals_select
on public.data_release_approvals for select to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
  or public.platform_operator_has_permission('platform.data_exports.approve', auth.uid())
);

drop policy if exists data_release_approvals_manage on public.data_release_approvals;
create policy data_release_approvals_manage
on public.data_release_approvals for all to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_exports.approve', auth.uid())
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
)
with check (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_exports.approve', auth.uid())
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
);
