create policy profiles_insert_self
on public.profiles for insert to authenticated
with check (id = auth.uid());
