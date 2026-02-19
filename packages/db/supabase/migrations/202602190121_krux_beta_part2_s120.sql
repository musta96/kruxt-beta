create policy profiles_select_public_or_self
on public.profiles for select to authenticated
using (is_public or id = auth.uid());
