-- KRUXT RLS smoke test
-- Execute in a migrated database.

do $$
declare
  v_missing integer;
begin
  -- ensure expected tables have RLS enabled
  with expected(table_name) as (
    values
      ('feature_flags'),
      ('profiles'),
      ('gyms'),
      ('workouts'),
      ('social_interactions'),
      ('gym_memberships'),
      ('class_waitlist'),
      ('challenges'),
      ('challenge_participants'),
      ('leaderboards'),
      ('leaderboard_entries'),
      ('device_connections'),
      ('device_sync_cursors'),
      ('privacy_requests'),
      ('privacy_export_jobs'),
      ('legal_holds'),
      ('privacy_delete_jobs'),
      ('security_incidents'),
      ('incident_actions'),
      ('incident_notification_jobs'),
      ('legal_copy_keys'),
      ('legal_copy_translations'),
      ('audit_logs'),
      ('push_notification_tokens')
  )
  select count(*) into v_missing
  from expected e
  left join pg_tables t
    on t.schemaname = 'public' and t.tablename = e.table_name
  left join pg_class c
    on c.relname = e.table_name
  left join pg_namespace n
    on n.oid = c.relnamespace and n.nspname = 'public'
  where c.relrowsecurity is distinct from true;

  if v_missing > 0 then
    raise exception 'RLS is not enabled on % expected table(s)', v_missing;
  end if;

  -- ensure policy count sanity
  select count(*) into v_missing
  from pg_policies
  where schemaname = 'public';

  if v_missing < 40 then
    raise exception 'Policy count too low: % (expected >= 40)', v_missing;
  end if;
end
$$;
