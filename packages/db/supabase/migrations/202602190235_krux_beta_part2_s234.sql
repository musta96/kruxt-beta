create policy class_waitlist_update_self_or_staff
on public.class_waitlist for update to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.gym_classes gc
    where gc.id = class_waitlist.class_id
      and public.is_gym_staff(gc.gym_id, auth.uid())
  )
)
with check (
  user_id = auth.uid()
  or exists (
    select 1
    from public.gym_classes gc
    where gc.id = class_waitlist.class_id
      and public.is_gym_staff(gc.gym_id, auth.uid())
  )
);
