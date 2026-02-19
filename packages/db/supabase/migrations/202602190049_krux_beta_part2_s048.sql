create trigger trg_payment_transactions_set_updated_at before update on public.payment_transactions
for each row execute function public.set_updated_at();
