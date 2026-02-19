create policy refunds_select_self_or_staff
on public.refunds for select to authenticated
using (
  exists (
    select 1
    from public.payment_transactions pt
    where pt.id = refunds.payment_transaction_id
      and ((pt.user_id is not null and pt.user_id = auth.uid()) or public.is_gym_staff(pt.gym_id, auth.uid()))
  )
);
