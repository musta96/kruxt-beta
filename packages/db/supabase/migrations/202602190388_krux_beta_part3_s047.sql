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
