create trigger trg_gym_classes_set_updated_at before update on public.gym_classes
for each row execute function public.set_updated_at();
