create policy access_logs_insert_staff_or_service
on public.access_logs for insert to authenticated
with check (public.is_service_role() or public.is_gym_staff(gym_id, auth.uid()));
