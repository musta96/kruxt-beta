create policy privacy_requests_insert_self
on public.privacy_requests for insert to authenticated
with check (user_id = auth.uid() or public.is_service_role());
