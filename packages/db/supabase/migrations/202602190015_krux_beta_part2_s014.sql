create trigger trg_exercises_set_updated_at before update on public.exercises
for each row execute function public.set_updated_at();
