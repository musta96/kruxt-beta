create trigger trg_seed_notification_preferences
after insert on public.profiles
for each row execute function public.seed_notification_preferences();
