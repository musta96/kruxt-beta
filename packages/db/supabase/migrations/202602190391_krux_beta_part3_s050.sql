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
