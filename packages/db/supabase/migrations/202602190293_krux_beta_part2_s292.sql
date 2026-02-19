create policy external_activity_imports_select_self
on public.external_activity_imports for select to authenticated
using (user_id = auth.uid());
