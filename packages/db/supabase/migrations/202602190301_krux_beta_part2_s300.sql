create policy user_blocks_select_party
on public.user_blocks for select to authenticated
using (blocker_user_id = auth.uid() or blocked_user_id = auth.uid());
