create policy payment_transactions_select_self_or_staff
on public.payment_transactions for select to authenticated
using ((user_id is not null and user_id = auth.uid()) or public.is_gym_staff(gym_id, auth.uid()));
