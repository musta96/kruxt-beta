create policy waiver_acceptances_select_self_or_staff
on public.waiver_acceptances for select to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.waivers w
    where w.id = waiver_acceptances.waiver_id
      and public.is_gym_staff(w.gym_id, auth.uid())
  )
);
