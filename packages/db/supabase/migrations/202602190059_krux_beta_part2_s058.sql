create trigger trg_notification_preferences_set_updated_at before update on public.notification_preferences
for each row execute function public.set_updated_at();
