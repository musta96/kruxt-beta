-- DISPOSABLE CONTRACT PROTOTYPE ONLY. Not a deployment migration or legal approval.
-- Existing runtime gates, policies and consent evidence are deliberately untouched.
begin;
do $$ begin
  if current_setting('kruxt.disposable_processing_contract', true) is distinct from 'on' then
    raise exception 'Processing prototype requires an explicitly disposable contract database';
  end if;
end $$;

create schema consent_v2;
revoke all on schema consent_v2 from public, anon, authenticated;
grant usage on schema consent_v2 to authenticated, service_role;

create table consent_v2.configuration (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false
);
insert into consent_v2.configuration default values;

create table consent_v2.policy_scopes (
  id uuid primary key default gen_random_uuid(),
  decision_key text not null check (decision_key in (
    'terms_agreement', 'privacy_acknowledgment', 'private_training',
    'coach_access', 'provider_import', 'public_sharing'
  )),
  scope_key text not null check (length(scope_key) between 1 and 128),
  policy_version_id uuid not null references public.policy_version_tracking(id),
  is_enabled boolean not null default false,
  check (case
    when decision_key in ('terms_agreement', 'privacy_acknowledgment') then scope_key = 'account'
    when decision_key = 'private_training' then scope_key = 'self'
    when decision_key = 'coach_access' then scope_key ~ '^(gym|coach):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    when decision_key = 'provider_import' then scope_key ~ '^[a-z][a-z0-9_]{0,63}$'
    when decision_key = 'public_sharing' then scope_key in ('public', 'followers')
      or scope_key ~ '^gym:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    else false end)
);
create unique index one_enabled_policy_scope_v2
  on consent_v2.policy_scopes(decision_key, scope_key) where is_enabled;

create table consent_v2.decisions (
  id uuid primary key default gen_random_uuid(),
  sequence bigint generated always as identity unique,
  user_id uuid not null references auth.users(id),
  request_id uuid not null check (request_id <> '00000000-0000-0000-0000-000000000000'),
  policy_scope_id uuid not null references consent_v2.policy_scopes(id),
  action text not null check (action in ('accept', 'acknowledge', 'grant', 'decline', 'withdraw')),
  policy_checksum text,
  recorded_at timestamptz not null default clock_timestamp(),
  unique(user_id, request_id)
);
create index decisions_v2_subject_order on consent_v2.decisions(user_id, sequence desc);

alter table consent_v2.configuration enable row level security;
alter table consent_v2.policy_scopes enable row level security;
alter table consent_v2.decisions enable row level security;
revoke all on all tables in schema consent_v2 from public, anon, authenticated, service_role;
revoke all on all sequences in schema consent_v2 from public, anon, authenticated, service_role;
grant select on consent_v2.decisions to authenticated;
grant select on all tables in schema consent_v2 to service_role;
grant insert, update on consent_v2.configuration, consent_v2.policy_scopes to service_role;
create policy decisions_v2_select_self on consent_v2.decisions for select to authenticated
  using (user_id = (select auth.uid()));

create function consent_v2.protect_scope() returns trigger
language plpgsql set search_path = pg_catalog, public, consent_v2 as $$
declare v_type public.policy_type;
begin
  if tg_op = 'DELETE' then raise exception using errcode = '42501', message = 'Scope evidence is immutable'; end if;
  if tg_op = 'UPDATE' and (to_jsonb(new) - 'is_enabled') is distinct from (to_jsonb(old) - 'is_enabled') then
    raise exception using errcode = '42501', message = 'Create a new scope version instead';
  end if;
  v_type := case new.decision_key when 'terms_agreement' then 'terms'::public.policy_type
    when 'privacy_acknowledgment' then 'privacy'::public.policy_type else 'health_data'::public.policy_type end;
  if not exists (select 1 from public.policy_version_tracking p where p.id = new.policy_version_id and p.policy_type = v_type) then
    raise exception using errcode = '22023', message = 'Scope policy type mismatch';
  end if;
  return new;
end $$;
revoke all on function consent_v2.protect_scope() from public, anon, authenticated, service_role;
create trigger processing_scope_immutable before insert or update or delete on consent_v2.policy_scopes
  for each row execute function consent_v2.protect_scope();

create function consent_v2.protect_decision() returns trigger
language plpgsql set search_path = pg_catalog as $$ begin
  raise exception using errcode = '42501', message = 'Decision evidence is append-only';
end $$;
revoke all on function consent_v2.protect_decision() from public, anon, authenticated, service_role;
create trigger processing_decision_immutable before update or delete on consent_v2.decisions
  for each row execute function consent_v2.protect_decision();

-- Private helper: callers never supply an actor to a public API.
create function consent_v2.scope_allowed(p_actor uuid, p_scope_id uuid) returns boolean
language plpgsql stable set search_path = pg_catalog, public, consent_v2 as $$
declare
  v_scope consent_v2.policy_scopes%rowtype;
  v_latest record;
  v_type public.policy_type;
  v_expected text;
  v_account_scope uuid;
  v_key text;
begin
  if p_actor is null or not exists (select 1 from consent_v2.configuration where singleton and enabled)
    or not exists (select 1 from public.profiles p where p.id = p_actor and p.activation_status = 'active') then
    return false;
  end if;
  select * into v_scope from consent_v2.policy_scopes where id = p_scope_id and is_enabled;
  if not found then return false; end if;
  v_type := case v_scope.decision_key when 'terms_agreement' then 'terms'::public.policy_type
    when 'privacy_acknowledgment' then 'privacy'::public.policy_type else 'health_data'::public.policy_type end;
  v_expected := case v_scope.decision_key when 'terms_agreement' then 'accept'
    when 'privacy_acknowledgment' then 'acknowledge' else 'grant' end;
  if not public.policy_version_has_content_binding(v_scope.policy_version_id)
    or public.current_policy_version_id(v_type) is distinct from v_scope.policy_version_id then return false; end if;
  select d.policy_scope_id, d.action into v_latest
    from consent_v2.decisions d join consent_v2.policy_scopes s on s.id = d.policy_scope_id
    where d.user_id = p_actor and s.decision_key = v_scope.decision_key and s.scope_key = v_scope.scope_key
    order by d.sequence desc limit 1;
  if v_latest.policy_scope_id is distinct from v_scope.id or v_latest.action is distinct from v_expected then return false; end if;
  if v_expected = 'grant' then
    foreach v_key in array array['terms_agreement', 'privacy_acknowledgment'] loop
      select id into v_account_scope from consent_v2.policy_scopes
        where decision_key = v_key and scope_key = 'account' and is_enabled;
      if v_account_scope is null or not consent_v2.scope_allowed(p_actor, v_account_scope) then return false; end if;
    end loop;
  end if;
  return true;
end $$;
revoke all on function consent_v2.scope_allowed(uuid, uuid) from public, anon, authenticated, service_role;

create function public.my_policy_scope_allowed_v2(p_scope_id uuid) returns boolean
language plpgsql stable security definer set search_path = pg_catalog, public, consent_v2 as $$
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  return consent_v2.scope_allowed(auth.uid(), p_scope_id);
end $$;
revoke all on function public.my_policy_scope_allowed_v2(uuid) from public, anon, authenticated, service_role;
grant execute on function public.my_policy_scope_allowed_v2(uuid) to authenticated;

create function public.my_account_policy_ready_v2() returns boolean
language plpgsql stable security definer set search_path = pg_catalog, public, consent_v2 as $$
declare v_scope uuid; v_key text;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  foreach v_key in array array['terms_agreement', 'privacy_acknowledgment'] loop
    select id into v_scope from consent_v2.policy_scopes where decision_key = v_key and scope_key = 'account' and is_enabled;
    if v_scope is null or not consent_v2.scope_allowed(auth.uid(), v_scope) then return false; end if;
  end loop;
  return true;
end $$;
revoke all on function public.my_account_policy_ready_v2() from public, anon, authenticated, service_role;
grant execute on function public.my_account_policy_ready_v2() to authenticated;

create function public.record_my_policy_decision_v2(p_scope_id uuid, p_action text, p_request_id uuid) returns uuid
language plpgsql security definer set search_path = pg_catalog, public, consent_v2 as $$
declare
  v_actor uuid := auth.uid();
  v_scope consent_v2.policy_scopes%rowtype;
  v_previous consent_v2.decisions%rowtype;
  v_expected text;
  v_type public.policy_type;
  v_checksum text;
  v_id uuid;
begin
  if v_actor is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  if p_scope_id is null or p_request_id is null or p_request_id = '00000000-0000-0000-0000-000000000000'
    or p_action is null or p_action not in ('accept', 'acknowledge', 'grant', 'decline', 'withdraw') then
    raise exception using errcode = '22023', message = 'Valid explicit decision and request reference required';
  end if;
  -- One subject's decisions serialize across purposes, versions and retries.
  perform pg_advisory_xact_lock(hashtextextended('processing-v2:' || v_actor::text, 0));
  select * into v_previous from consent_v2.decisions where user_id = v_actor and request_id = p_request_id;
  if found then
    if v_previous.policy_scope_id <> p_scope_id or v_previous.action <> p_action then
      raise exception using errcode = '22023', message = 'Request reference already used for a different decision';
    end if;
    return v_previous.id;
  end if;
  select * into v_scope from consent_v2.policy_scopes where id = p_scope_id for share;
  if not found then raise exception using errcode = '22023', message = 'Unknown policy scope'; end if;
  v_expected := case v_scope.decision_key when 'terms_agreement' then 'accept'
    when 'privacy_acknowledgment' then 'acknowledge' else 'grant' end;
  if p_action not in (v_expected, 'decline', 'withdraw') then
    raise exception using errcode = '22023', message = 'Decision does not match the policy scope';
  end if;
  if p_action = v_expected then
    perform 1 from consent_v2.configuration where singleton and enabled for share;
    if not found or not v_scope.is_enabled then
      raise exception using errcode = '42501', message = 'Processing permissions are not enabled';
    end if;
    perform 1 from public.profiles where id = v_actor and activation_status = 'active' for share;
    if not found then raise exception using errcode = '42501', message = 'Active account required'; end if;
    v_type := case v_scope.decision_key when 'terms_agreement' then 'terms'::public.policy_type
      when 'privacy_acknowledgment' then 'privacy'::public.policy_type else 'health_data'::public.policy_type end;
    perform 1 from public.policy_version_tracking where id = v_scope.policy_version_id for share;
    if not public.policy_version_has_content_binding(v_scope.policy_version_id)
      or public.current_policy_version_id(v_type) is distinct from v_scope.policy_version_id then
      raise exception using errcode = '22023', message = 'Policy scope changed or is unavailable for review';
    end if;
    if v_expected = 'grant' and not public.my_account_policy_ready_v2() then
      raise exception using errcode = '42501', message = 'Account policy review required';
    end if;
  end if;
  select checksum into v_checksum from public.policy_version_tracking where id = v_scope.policy_version_id;
  insert into consent_v2.decisions(user_id, request_id, policy_scope_id, action, policy_checksum)
    values (v_actor, p_request_id, p_scope_id, p_action, v_checksum) returning id into v_id;
  perform public.append_audit_log('processing.decision_recorded_v2', 'consent_v2.decisions', v_id,
    'Explicit subject policy decision', jsonb_build_object(
      'policy_scope_id', v_scope.id, 'decision_key', v_scope.decision_key,
      'scope_key', v_scope.scope_key, 'action', p_action, 'request_id', p_request_id));
  return v_id;
end $$;
revoke all on function public.record_my_policy_decision_v2(uuid, text, uuid) from public, anon, authenticated, service_role;
grant execute on function public.record_my_policy_decision_v2(uuid, text, uuid) to authenticated;
commit;
