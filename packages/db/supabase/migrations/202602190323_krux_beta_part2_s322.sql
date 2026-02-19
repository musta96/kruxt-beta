create policy privacy_requests_select_self_or_service
on public.privacy_requests for select to authenticated
using (user_id = auth.uid() or public.is_service_role());
