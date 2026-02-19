create policy invoices_manage_service_or_staff
on public.invoices for all to authenticated
using (public.is_service_role() or public.is_gym_staff(gym_id, auth.uid()))
with check (public.is_service_role() or public.is_gym_staff(gym_id, auth.uid()));
