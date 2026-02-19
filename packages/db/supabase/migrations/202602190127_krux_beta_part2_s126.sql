create policy profiles_delete_self
on public.profiles for delete to authenticated
using (id = auth.uid());
