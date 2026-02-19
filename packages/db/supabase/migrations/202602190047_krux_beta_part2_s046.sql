create trigger trg_invoices_set_updated_at before update on public.invoices
for each row execute function public.set_updated_at();
