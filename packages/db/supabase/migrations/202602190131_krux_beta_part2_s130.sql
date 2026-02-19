create policy gyms_insert_owner_self
on public.gyms for insert to authenticated
with check (owner_user_id = auth.uid());
