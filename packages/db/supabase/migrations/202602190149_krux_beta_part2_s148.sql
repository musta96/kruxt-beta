create policy social_connections_update_party
on public.social_connections for update to authenticated
using (follower_user_id = auth.uid() or followed_user_id = auth.uid())
with check (follower_user_id = auth.uid() or followed_user_id = auth.uid());
