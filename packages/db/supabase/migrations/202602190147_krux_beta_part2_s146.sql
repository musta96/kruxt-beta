create policy social_connections_insert_self
on public.social_connections for insert to authenticated
with check (follower_user_id = auth.uid());
