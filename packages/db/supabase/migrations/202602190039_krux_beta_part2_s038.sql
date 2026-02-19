create trigger trg_class_waitlist_set_updated_at before update on public.class_waitlist
for each row execute function public.set_updated_at();
