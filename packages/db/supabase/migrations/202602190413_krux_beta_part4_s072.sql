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
