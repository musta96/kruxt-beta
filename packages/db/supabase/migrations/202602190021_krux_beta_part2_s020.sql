create trigger trg_workout_exercises_set_updated_at before update on public.workout_exercises
for each row execute function public.set_updated_at();
