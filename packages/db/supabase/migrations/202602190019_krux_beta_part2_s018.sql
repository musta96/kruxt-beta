create trigger trg_workouts_set_updated_at before update on public.workouts
for each row execute function public.set_updated_at();
