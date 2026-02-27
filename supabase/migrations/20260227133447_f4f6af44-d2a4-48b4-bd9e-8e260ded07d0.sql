drop policy if exists gyms_update_staff_or_owner on public.gyms;

create policy gyms_update_staff_or_owner
on public.gyms for update to authenticated
using (
  public.can_manage_gym_config(id, auth.uid())
  or public.is_platform_founder(auth.uid())
)
with check (
  public.can_manage_gym_config(id, auth.uid())
  or public.is_platform_founder(auth.uid())
);