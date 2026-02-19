create trigger trg_workout_sets_detect_pr
after insert or update of reps, weight_kg, is_pr
on public.workout_sets
for each row execute function public.apply_workout_pr_trigger();
