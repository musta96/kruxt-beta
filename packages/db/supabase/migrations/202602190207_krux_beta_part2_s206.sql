create policy leaderboards_manage_service_or_staff
on public.leaderboards for all to authenticated
using (
  public.is_service_role()
  or (scope_gym_id is not null and public.is_gym_staff(scope_gym_id, auth.uid()))
)
with check (
  public.is_service_role()
  or (scope_gym_id is not null and public.is_gym_staff(scope_gym_id, auth.uid()))
);
