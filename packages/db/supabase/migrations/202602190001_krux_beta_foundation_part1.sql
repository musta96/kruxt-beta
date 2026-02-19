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
