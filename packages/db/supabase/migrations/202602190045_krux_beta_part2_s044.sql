create trigger trg_member_subscriptions_set_updated_at before update on public.member_subscriptions
for each row execute function public.set_updated_at();
