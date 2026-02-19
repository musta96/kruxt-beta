create policy class_bookings_select_self_or_staff
on public.class_bookings for select to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.gym_classes gc
    where gc.id = class_bookings.class_id
      and public.is_gym_staff(gc.gym_id, auth.uid())
  )
);
