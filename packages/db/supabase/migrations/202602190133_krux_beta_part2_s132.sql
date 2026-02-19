create policy gyms_update_staff_or_owner
on public.gyms for update to authenticated
using (public.is_gym_staff(id, auth.uid()) or owner_user_id = auth.uid())
with check (public.is_gym_staff(id, auth.uid()) or owner_user_id = auth.uid());
