create trigger trg_profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
