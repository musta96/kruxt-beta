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
