create trigger trg_social_interactions_set_updated_at before update on public.social_interactions
for each row execute function public.set_updated_at();
