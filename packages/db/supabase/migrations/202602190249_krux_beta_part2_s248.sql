create policy contract_acceptances_select_self_or_staff
on public.contract_acceptances for select to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.contracts c
    where c.id = contract_acceptances.contract_id
      and public.is_gym_staff(c.gym_id, auth.uid())
  )
);
