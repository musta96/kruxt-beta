create policy user_blocks_delete_self
on public.user_blocks for delete to authenticated
using (blocker_user_id = auth.uid());
