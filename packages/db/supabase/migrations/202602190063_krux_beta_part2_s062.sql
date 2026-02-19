create trigger trg_consents_set_updated_at before update on public.consents
for each row execute function public.set_updated_at();
