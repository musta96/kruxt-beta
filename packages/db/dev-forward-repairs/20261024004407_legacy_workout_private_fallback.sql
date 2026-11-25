-- DEV-specific repair. Not part of either automatic migration chain.
-- The reviewed function fingerprint prevents replacing an unexpected revision.
set local lock_timeout = '2s';
set local statement_timeout = '10s';
do $repair$
declare
  target regprocedure := to_regprocedure('public.log_workout_atomic(jsonb,jsonb)');
  before_sql text;
  after_sql text;
  before_hash text;
  old_expression constant text := $old$coalesce((p_workout->>'visibility')::public.workout_visibility, 'public')$old$;
  new_expression constant text := $new$coalesce((p_workout->>'visibility')::public.workout_visibility, 'private')$new$;
begin
  if target is null then raise exception 'Expected DEV workout RPC is absent'; end if;
  before_sql := pg_get_functiondef(target);
  before_hash := encode(sha256(convert_to(before_sql, 'UTF8')), 'hex');
  if before_hash = 'd0966585137debea0ee5d685d23c6d5d1c05a929ee9862d957a5c313b7b90963' then
    return;
  end if;
  if before_hash <> '8d98619104af4e1326fdb032d16b938ed9813589a906c0a0dd9df520d43fb719'
    or (length(before_sql) - length(replace(before_sql, old_expression, ''))) <> length(old_expression) then
    raise exception 'Workout RPC differs from reviewed DEV revision; repair refused';
  end if;
  after_sql := replace(before_sql, old_expression, new_expression);
  if encode(sha256(convert_to(after_sql, 'UTF8')), 'hex') <> 'd0966585137debea0ee5d685d23c6d5d1c05a929ee9862d957a5c313b7b90963' then
    raise exception 'Unexpected workout RPC repair output';
  end if;
  execute after_sql;
  if pg_get_functiondef(target) <> after_sql then
    raise exception 'Workout RPC repair verification failed';
  end if;
end
$repair$;
