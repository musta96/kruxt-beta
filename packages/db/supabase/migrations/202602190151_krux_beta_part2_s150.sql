create policy social_connections_delete_party
on public.social_connections for delete to authenticated
using (follower_user_id = auth.uid() or followed_user_id = auth.uid());
