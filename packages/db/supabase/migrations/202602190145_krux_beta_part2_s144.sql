create policy social_connections_select
on public.social_connections for select to authenticated
using (
  status = 'accepted'
  or follower_user_id = auth.uid()
  or followed_user_id = auth.uid()
);
