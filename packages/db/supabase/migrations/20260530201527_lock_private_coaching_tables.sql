-- Sensitive coaching data is exposed through audited SECURITY DEFINER RPCs only.
-- Direct table access stays closed for anon/authenticated clients.

drop policy if exists coach_plan_templates_select on public.coach_plan_templates;
drop policy if exists coach_plan_templates_insert on public.coach_plan_templates;
drop policy if exists coach_plan_templates_update on public.coach_plan_templates;
drop policy if exists coach_plan_templates_delete on public.coach_plan_templates;

drop policy if exists coach_athlete_notes_select on public.coach_athlete_notes;
drop policy if exists coach_athlete_notes_manage on public.coach_athlete_notes;

drop policy if exists coach_athlete_messages_select on public.coach_athlete_messages;
drop policy if exists coach_athlete_messages_insert on public.coach_athlete_messages;
drop policy if exists coach_athlete_messages_update on public.coach_athlete_messages;

drop policy if exists coach_sessions_select on public.coach_sessions;
drop policy if exists coach_sessions_manage on public.coach_sessions;

drop policy if exists gym_workout_plan_exercise_swaps_select on public.gym_workout_plan_exercise_swaps;
drop policy if exists gym_workout_plan_exercise_swaps_insert on public.gym_workout_plan_exercise_swaps;

drop policy if exists coach_athlete_goals_select on public.coach_athlete_goals;
drop policy if exists coach_athlete_goals_manage on public.coach_athlete_goals;

drop policy if exists coach_athlete_progress_photos_select on public.coach_athlete_progress_photos;
drop policy if exists coach_athlete_progress_photos_manage on public.coach_athlete_progress_photos;

revoke all on table public.coach_plan_templates from anon;
revoke all on table public.coach_plan_templates from authenticated;
revoke all on table public.coach_plan_templates from public;

revoke all on table public.coach_athlete_notes from anon;
revoke all on table public.coach_athlete_notes from authenticated;
revoke all on table public.coach_athlete_notes from public;

revoke all on table public.coach_athlete_messages from anon;
revoke all on table public.coach_athlete_messages from authenticated;
revoke all on table public.coach_athlete_messages from public;

revoke all on table public.coach_sessions from anon;
revoke all on table public.coach_sessions from authenticated;
revoke all on table public.coach_sessions from public;

revoke all on table public.gym_workout_plan_exercise_swaps from anon;
revoke all on table public.gym_workout_plan_exercise_swaps from authenticated;
revoke all on table public.gym_workout_plan_exercise_swaps from public;

revoke all on table public.coach_athlete_goals from anon;
revoke all on table public.coach_athlete_goals from authenticated;
revoke all on table public.coach_athlete_goals from public;

revoke all on table public.coach_athlete_progress_photos from anon;
revoke all on table public.coach_athlete_progress_photos from authenticated;
revoke all on table public.coach_athlete_progress_photos from public;

grant select, insert, update, delete on table public.coach_plan_templates to service_role;
grant select, insert, update, delete on table public.coach_athlete_notes to service_role;
grant select, insert, update, delete on table public.coach_athlete_messages to service_role;
grant select, insert, update, delete on table public.coach_sessions to service_role;
grant select, insert, update, delete on table public.gym_workout_plan_exercise_swaps to service_role;
grant select, insert, update, delete on table public.coach_athlete_goals to service_role;
grant select, insert, update, delete on table public.coach_athlete_progress_photos to service_role;
