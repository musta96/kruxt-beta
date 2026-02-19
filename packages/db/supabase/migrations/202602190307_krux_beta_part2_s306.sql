create policy user_reports_select_reporter_or_staff
on public.user_reports for select to authenticated
using (
  reporter_user_id = auth.uid()
  or public.is_service_role()
  or exists (
    select 1
    from public.gym_memberships gm
    where gm.user_id = auth.uid()
      and gm.role in ('leader','officer')
      and gm.membership_status in ('trial','active')
  )
);
