create trigger trg_feature_flags_set_updated_at before update on public.feature_flags
for each row execute function public.set_updated_at();
