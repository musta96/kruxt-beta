create policy refunds_manage_service_or_staff
on public.refunds for all to authenticated
using (
  public.is_service_role()
  or exists (
    select 1
    from public.payment_transactions pt
    where pt.id = refunds.payment_transaction_id
      and public.is_gym_staff(pt.gym_id, auth.uid())
  )
)
with check (
  public.is_service_role()
  or exists (
    select 1
    from public.payment_transactions pt
    where pt.id = refunds.payment_transaction_id
      and public.is_gym_staff(pt.gym_id, auth.uid())
  )
);
