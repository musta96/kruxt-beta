create policy invoices_select_self_or_staff
on public.invoices for select to authenticated
using (user_id = auth.uid() or public.is_gym_staff(gym_id, auth.uid()));
