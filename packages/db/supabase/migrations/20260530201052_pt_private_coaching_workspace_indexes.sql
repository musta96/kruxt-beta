-- Keep foreign-key lookups in the private coaching workspace cheap.
-- Supabase advisors flag each FK column that lacks a direct supporting index.

create index if not exists idx_coach_plan_templates_coach_fk
  on public.coach_plan_templates(coach_user_id);

create index if not exists idx_coach_plan_templates_created_by_fk
  on public.coach_plan_templates(created_by)
  where created_by is not null;

create index if not exists idx_coach_athlete_notes_coach_fk
  on public.coach_athlete_notes(coach_user_id);

create index if not exists idx_coach_athlete_notes_member_fk
  on public.coach_athlete_notes(member_user_id);

create index if not exists idx_coach_athlete_notes_created_by_fk
  on public.coach_athlete_notes(created_by)
  where created_by is not null;

create index if not exists idx_coach_athlete_messages_coach_fk
  on public.coach_athlete_messages(coach_user_id);

create index if not exists idx_coach_athlete_messages_member_fk
  on public.coach_athlete_messages(member_user_id);

create index if not exists idx_coach_athlete_messages_sender_fk
  on public.coach_athlete_messages(sender_user_id);

create index if not exists idx_coach_sessions_coach_fk
  on public.coach_sessions(coach_user_id);

create index if not exists idx_coach_sessions_member_fk
  on public.coach_sessions(member_user_id);

create index if not exists idx_coach_sessions_created_by_fk
  on public.coach_sessions(created_by)
  where created_by is not null;

create index if not exists idx_gym_workout_plan_exercise_swaps_coach_fk
  on public.gym_workout_plan_exercise_swaps(coach_user_id);

create index if not exists idx_gym_workout_plan_exercise_swaps_member_fk
  on public.gym_workout_plan_exercise_swaps(member_user_id);

create index if not exists idx_gym_workout_plan_exercise_swaps_created_by_fk
  on public.gym_workout_plan_exercise_swaps(created_by)
  where created_by is not null;

create index if not exists idx_coach_athlete_goals_coach_fk
  on public.coach_athlete_goals(coach_user_id);

create index if not exists idx_coach_athlete_goals_member_fk
  on public.coach_athlete_goals(member_user_id);

create index if not exists idx_coach_athlete_goals_created_by_fk
  on public.coach_athlete_goals(created_by)
  where created_by is not null;

create index if not exists idx_coach_athlete_progress_photos_coach_fk
  on public.coach_athlete_progress_photos(coach_user_id);

create index if not exists idx_coach_athlete_progress_photos_member_fk
  on public.coach_athlete_progress_photos(member_user_id);

create index if not exists idx_coach_athlete_progress_photos_created_by_fk
  on public.coach_athlete_progress_photos(created_by)
  where created_by is not null;
