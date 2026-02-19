create policy class_waitlist_insert_self
on public.class_waitlist for insert to authenticated
with check (user_id = auth.uid());
