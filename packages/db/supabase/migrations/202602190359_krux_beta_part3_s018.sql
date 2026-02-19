create trigger trg_push_notification_tokens_set_updated_at before update on public.push_notification_tokens
for each row execute function public.set_updated_at();
