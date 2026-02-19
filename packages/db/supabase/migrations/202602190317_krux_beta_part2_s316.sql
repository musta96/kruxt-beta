create policy consents_select_self
on public.consents for select to authenticated
using (user_id = auth.uid() or public.is_service_role());
