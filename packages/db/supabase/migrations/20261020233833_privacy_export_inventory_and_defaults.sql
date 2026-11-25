set lock_timeout = '5s';

-- Expired exports cannot be downloaded/re-signed through the owner Storage policy.
drop policy if exists privacy_export_owner_select on storage.objects;
create policy privacy_export_owner_select on storage.objects for select to authenticated
using (
  bucket_id = 'privacy-exports'
  and exists (
    select 1 from public.privacy_export_jobs j
    where j.user_id = auth.uid() and j.storage_bucket = bucket_id
      and j.storage_path = name and j.status = 'succeeded'
      and j.signed_url_expires_at > now()
  )
);

-- Only newly created records change defaults; existing sharing choices remain intact.
alter table public.profiles alter column is_public set default false;
alter table public.workouts alter column visibility set default 'private';

alter function public.log_workout_atomic(jsonb, jsonb) rename to log_workout_atomic_legacy;
revoke all on function public.log_workout_atomic_legacy(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.log_workout_atomic_legacy(jsonb, jsonb) to service_role;

create function public.log_workout_atomic(p_workout jsonb, p_exercises jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  if p_workout->>'visibility' is null then
    p_workout := coalesce(p_workout, '{}'::jsonb) || jsonb_build_object('visibility', 'private');
  end if;
  return public.log_workout_atomic_legacy(p_workout, p_exercises);
end;
$$;
revoke all on function public.log_workout_atomic(jsonb, jsonb) from public, anon;
grant execute on function public.log_workout_atomic(jsonb, jsonb) to authenticated, service_role;

alter function public.build_privacy_export_payload(uuid) rename to build_privacy_export_payload_legacy;
revoke all on function public.build_privacy_export_payload_legacy(uuid) from public, anon, authenticated;
grant execute on function public.build_privacy_export_payload_legacy(uuid) to service_role;

create function public.build_privacy_export_payload(p_user_id uuid default auth.uid())
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_subject uuid := coalesce(p_user_id, auth.uid());
  v_payload jsonb;
begin
  -- The existing builder enforces subject ownership before any added lookup.
  v_payload := public.build_privacy_export_payload_legacy(v_subject);
  return v_payload || jsonb_build_object(
    'schema_version', '2026-10',
    'support_tickets', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.created_at, t.id)
      from (
        select id, ticket_number, channel, category, priority, status, subject,
          description, reporter_email, affected_surface, created_at, updated_at,
          resolved_at, closed_at
        from public.support_tickets where reporter_user_id = v_subject
      ) t
    ), '[]'::jsonb),
    'support_ticket_messages', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.created_at, m.id)
      from (
        select stm.id, stm.ticket_id, stm.actor_type, stm.body, stm.created_at,
          case when jsonb_typeof(stm.attachments) = 'array'
            then jsonb_array_length(stm.attachments) else 0 end as attachment_count
        from public.support_ticket_messages stm
        join public.support_tickets st on st.id = stm.ticket_id
        where st.reporter_user_id = v_subject and not stm.is_internal
      ) m
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.build_privacy_export_payload(uuid) from public, anon;
grant execute on function public.build_privacy_export_payload(uuid) to authenticated, service_role;

-- Repair legacy export projections against the actual schema.
create or replace function public.build_privacy_export_payload_legacy(
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
      select jsonb_agg(to_jsonb(ws) order by ws.completed_at asc)
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
          s.completed_at
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
          c.note,
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


