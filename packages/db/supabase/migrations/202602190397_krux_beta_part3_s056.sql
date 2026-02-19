create policy device_sync_jobs_select_self_or_gym_staff
on public.device_sync_jobs for select to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.gym_memberships gm
    where gm.user_id = device_sync_jobs.user_id
      and gm.membership_status in ('trial', 'active')
      and public.is_gym_staff(gm.gym_id, auth.uid())
  )
);
