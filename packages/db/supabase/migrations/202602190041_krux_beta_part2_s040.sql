create trigger trg_waivers_set_updated_at before update on public.waivers
for each row execute function public.set_updated_at();
