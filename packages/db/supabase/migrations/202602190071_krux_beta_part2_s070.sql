create trigger trg_workout_progress
after insert on public.workouts
for each row execute function public.apply_workout_progress_trigger();
