create trigger trg_challenges_set_updated_at before update on public.challenges
for each row execute function public.set_updated_at();
