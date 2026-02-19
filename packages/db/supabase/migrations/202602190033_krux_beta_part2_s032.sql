create trigger trg_gym_memberships_set_updated_at before update on public.gym_memberships
for each row execute function public.set_updated_at();
