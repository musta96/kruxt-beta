create policy audit_logs_insert_service_or_staff
on public.audit_logs for insert to authenticated
with check (
  public.is_service_role()
  or exists (
    select 1
    from public.gym_memberships gm
    where gm.user_id = auth.uid()
      and gm.role in ('leader','officer')
      and gm.membership_status in ('trial','active')
  )
);
