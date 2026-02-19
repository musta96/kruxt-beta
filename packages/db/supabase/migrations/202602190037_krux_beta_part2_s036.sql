create trigger trg_class_bookings_set_updated_at before update on public.class_bookings
for each row execute function public.set_updated_at();
