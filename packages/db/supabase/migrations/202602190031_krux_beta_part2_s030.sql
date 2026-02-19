create trigger trg_gym_membership_plans_set_updated_at before update on public.gym_membership_plans
for each row execute function public.set_updated_at();
