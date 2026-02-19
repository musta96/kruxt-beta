create trigger trg_leaderboards_set_updated_at before update on public.leaderboards
for each row execute function public.set_updated_at();
