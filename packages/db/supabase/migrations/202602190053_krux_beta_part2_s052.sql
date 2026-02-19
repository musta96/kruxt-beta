create trigger trg_dunning_events_set_updated_at before update on public.dunning_events
for each row execute function public.set_updated_at();
