create trigger trg_workout_sets_refresh_totals_insupd
after insert or update on public.workout_sets
for each row execute function public.refresh_workout_totals_from_set_trigger();
