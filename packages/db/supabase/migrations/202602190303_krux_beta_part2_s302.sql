create policy user_blocks_insert_self
on public.user_blocks for insert to authenticated
with check (blocker_user_id = auth.uid());
