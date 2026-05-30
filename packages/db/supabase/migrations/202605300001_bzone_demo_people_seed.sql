-- Guarded BZone UAT/demo people seed. These are non-login personas used only
-- for admin assignment flows; real UAT accounts still come from /join signup.

create or replace function public.seed_bzone_demo_people(p_gym_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_owner_user_id constant uuid := 'b0000000-0000-4000-8000-000000000001';
  v_pt_user_id constant uuid := 'b0000000-0000-4000-8000-000000000002';
  v_active_member_user_id constant uuid := 'b0000000-0000-4000-8000-000000000003';
  v_pending_member_user_id constant uuid := 'b0000000-0000-4000-8000-000000000004';
  v_action_medium_plan_id uuid;
  v_fit_plan_id uuid;
  v_auth_users_count integer := 0;
  v_profiles_count integer := 0;
  v_memberships_count integer := 0;
  v_join_requests_count integer := 0;
  v_staff_shifts_count integer := 0;
  v_workout_plans_count integer := 0;
  v_classes_assigned_count integer := 0;
begin
  if v_actor_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (select 1 from public.gyms g where g.id = p_gym_id) then
    raise exception 'Gym not found';
  end if;

  if not (
    public.is_gym_staff(p_gym_id, v_actor_user_id)
    or public.platform_operator_has_permission('platform.gyms.manage', v_actor_user_id)
  ) then
    raise exception 'Gym staff or platform operator access is required';
  end if;

  select id
  into v_action_medium_plan_id
  from public.gym_membership_plans
  where gym_id = p_gym_id
    and lower(name) = 'action medium'
  limit 1;

  select id
  into v_fit_plan_id
  from public.gym_membership_plans
  where gym_id = p_gym_id
    and lower(name) = 'fit'
  limit 1;

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  values
    (
      '00000000-0000-0000-0000-000000000000',
      v_owner_user_id,
      'authenticated',
      'authenticated',
      'demo.owner+bzone@kruxt.test',
      null,
      now(),
      '{"provider":"email","providers":["email"],"demo_persona":true}'::jsonb,
      '{"display_name":"BZone Demo Owner","demo_persona":true}'::jsonb,
      now(),
      now()
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      v_pt_user_id,
      'authenticated',
      'authenticated',
      'demo.pt+bzone@kruxt.test',
      null,
      now(),
      '{"provider":"email","providers":["email"],"demo_persona":true}'::jsonb,
      '{"display_name":"BZone Demo PT","demo_persona":true}'::jsonb,
      now(),
      now()
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      v_active_member_user_id,
      'authenticated',
      'authenticated',
      'demo.member.active+bzone@kruxt.test',
      null,
      now(),
      '{"provider":"email","providers":["email"],"demo_persona":true}'::jsonb,
      '{"display_name":"BZone Demo Active Member","demo_persona":true}'::jsonb,
      now(),
      now()
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      v_pending_member_user_id,
      'authenticated',
      'authenticated',
      'demo.member.pending+bzone@kruxt.test',
      null,
      now(),
      '{"provider":"email","providers":["email"],"demo_persona":true}'::jsonb,
      '{"display_name":"BZone Demo Pending Member","demo_persona":true}'::jsonb,
      now(),
      now()
    )
  on conflict (id) do update
    set email = excluded.email,
        raw_app_meta_data = coalesce(auth.users.raw_app_meta_data, '{}'::jsonb) || excluded.raw_app_meta_data,
        raw_user_meta_data = excluded.raw_user_meta_data,
        updated_at = now();
  get diagnostics v_auth_users_count = row_count;

  insert into public.profiles (
    id,
    username,
    display_name,
    bio,
    home_gym_id,
    is_public,
    locale,
    preferred_units
  )
  values
    (
      v_owner_user_id,
      'bzone-demo-owner',
      'BZone Demo Owner',
      'Demo persona for KRUXT BZone admin UAT. Not a real member account.',
      p_gym_id,
      false,
      'it-IT',
      'metric'
    ),
    (
      v_pt_user_id,
      'bzone-demo-pt',
      'BZone Demo PT',
      'Demo personal trainer for assignment, class coach, and shift testing.',
      p_gym_id,
      false,
      'it-IT',
      'metric'
    ),
    (
      v_active_member_user_id,
      'bzone-demo-active',
      'BZone Demo Active Member',
      'Demo active member for PT and workout-plan testing.',
      p_gym_id,
      false,
      'it-IT',
      'metric'
    ),
    (
      v_pending_member_user_id,
      'bzone-demo-pending',
      'BZone Demo Pending Member',
      'Demo pending member for join-approval testing.',
      p_gym_id,
      false,
      'it-IT',
      'metric'
    )
  on conflict (id) do update
    set username = excluded.username,
        display_name = excluded.display_name,
        bio = excluded.bio,
        home_gym_id = excluded.home_gym_id,
        is_public = excluded.is_public,
        locale = excluded.locale,
        preferred_units = excluded.preferred_units,
        updated_at = now();
  get diagnostics v_profiles_count = row_count;

  insert into public.gym_memberships (
    gym_id,
    user_id,
    role,
    membership_status,
    membership_plan_id,
    started_at,
    coach_user_id
  )
  values
    (p_gym_id, v_owner_user_id, 'leader', 'active', null, now(), null),
    (p_gym_id, v_pt_user_id, 'coach', 'active', null, now(), null),
    (p_gym_id, v_active_member_user_id, 'member', 'active', v_action_medium_plan_id, now(), v_pt_user_id),
    (p_gym_id, v_pending_member_user_id, 'member', 'pending', v_fit_plan_id, null, v_pt_user_id)
  on conflict (gym_id, user_id) do update
    set role = excluded.role,
        membership_status = excluded.membership_status,
        membership_plan_id = coalesce(excluded.membership_plan_id, public.gym_memberships.membership_plan_id),
        started_at = coalesce(public.gym_memberships.started_at, excluded.started_at),
        coach_user_id = excluded.coach_user_id,
        updated_at = now();
  get diagnostics v_memberships_count = row_count;

  update public.gym_join_requests
  set requested_membership_plan_id = coalesce(v_fit_plan_id, requested_membership_plan_id),
      source = 'staff_created',
      status = 'pending',
      note = 'Demo pending member created by BZone seed.',
      staff_note = 'Demo data for KRUXT UAT.',
      updated_at = now()
  where gym_id = p_gym_id
    and user_id = v_pending_member_user_id
    and status = 'pending';
  get diagnostics v_join_requests_count = row_count;

  if v_join_requests_count = 0 then
    insert into public.gym_join_requests (
      gym_id,
      user_id,
      requested_membership_plan_id,
      source,
      status,
      note,
      staff_note
    )
    values (
      p_gym_id,
      v_pending_member_user_id,
      v_fit_plan_id,
      'staff_created',
      'pending',
      'Demo pending member created by BZone seed.',
      'Demo data for KRUXT UAT.'
    );
    v_join_requests_count := 1;
  end if;

  if not exists (
    select 1
    from public.staff_shifts ss
    where ss.gym_id = p_gym_id
      and ss.staff_user_id = v_pt_user_id
      and ss.metadata->>'seed' = 'bzone-demo'
  ) then
    insert into public.staff_shifts (
      gym_id,
      staff_user_id,
      created_by,
      title,
      shift_role,
      starts_at,
      ends_at,
      status,
      notes,
      metadata
    )
    values
      (
        p_gym_id,
        v_pt_user_id,
        v_actor_user_id,
        'Demo PT floor shift',
        'Personal trainer',
        date_trunc('day', now()) + interval '1 day' + interval '9 hours',
        date_trunc('day', now()) + interval '1 day' + interval '14 hours',
        'scheduled',
        'BZone demo shift for UAT.',
        '{"seed":"bzone-demo"}'::jsonb
      ),
      (
        p_gym_id,
        v_pt_user_id,
        v_actor_user_id,
        'Demo evening coaching',
        'Coach',
        date_trunc('day', now()) + interval '2 days' + interval '17 hours',
        date_trunc('day', now()) + interval '2 days' + interval '21 hours',
        'scheduled',
        'BZone demo shift for class coverage.',
        '{"seed":"bzone-demo"}'::jsonb
      );
    get diagnostics v_staff_shifts_count = row_count;
  end if;

  if not exists (
    select 1
    from public.gym_member_workout_plans gwp
    where gwp.gym_id = p_gym_id
      and gwp.member_user_id = v_active_member_user_id
      and gwp.title = 'BZone Demo - Action Medium Starter'
  ) then
    insert into public.gym_member_workout_plans (
      gym_id,
      member_user_id,
      coach_user_id,
      title,
      goal,
      status,
      starts_at,
      plan_json,
      created_by
    )
    values (
      p_gym_id,
      v_active_member_user_id,
      v_pt_user_id,
      'BZone Demo - Action Medium Starter',
      'Build consistent strength, cardio confidence, and weekly adherence.',
      'active',
      current_date,
      '{
        "days": [
          {
            "label": "Day 1",
            "focus": "Full-body strength",
            "blocks": [
              {"exercise": "Goblet squat", "sets": 3, "reps": "10"},
              {"exercise": "Machine chest press", "sets": 3, "reps": "10"},
              {"exercise": "Lat pulldown", "sets": 3, "reps": "12"}
            ]
          },
          {
            "label": "Day 2",
            "focus": "Cardio and mobility",
            "blocks": [
              {"exercise": "Bike", "duration": "20 min"},
              {"exercise": "Core circuit", "sets": 3, "duration": "8 min"}
            ]
          }
        ]
      }'::jsonb,
      v_actor_user_id
    );
    get diagnostics v_workout_plans_count = row_count;
  end if;

  update public.gym_classes
  set coach_user_id = v_pt_user_id,
      updated_at = now()
  where gym_id = p_gym_id
    and coach_user_id is null
    and starts_at >= now();
  get diagnostics v_classes_assigned_count = row_count;

  return jsonb_build_object(
    'authUsersUpserted', v_auth_users_count,
    'profilesUpserted', v_profiles_count,
    'membershipsUpserted', v_memberships_count,
    'joinRequestsUpserted', v_join_requests_count,
    'staffShiftsCreated', v_staff_shifts_count,
    'workoutPlansCreated', v_workout_plans_count,
    'classesAssigned', v_classes_assigned_count
  );
end;
$$;

revoke all on function public.seed_bzone_demo_people(uuid) from public;
grant execute on function public.seed_bzone_demo_people(uuid) to authenticated;
