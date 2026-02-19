create trigger trg_refunds_set_updated_at before update on public.refunds
for each row execute function public.set_updated_at();
