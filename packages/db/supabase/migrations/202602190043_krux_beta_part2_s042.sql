create trigger trg_contracts_set_updated_at before update on public.contracts
for each row execute function public.set_updated_at();
